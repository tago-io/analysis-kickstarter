/**
 * CRUD User Analysis
 *
 * Educational single-file Analysis that handles the full lifecycle of a
 * Run User in the TagoIO Kickstarter project: create, edit and delete.
 * This file is intentionally self-contained — it has no relative imports.
 *
 * How it is triggered
 * -------------------
 * A dashboard sends Data points to this Analysis. The Analysis Router from
 * `@tago-io/sdk` inspects the scope and runs the matching handler:
 *
 *   - Input Form "create-user"              -> createUser
 *   - User List edit action "edit-user"     -> editUser
 *   - User List delete action "delete-user" -> deleteUser
 *
 * Required environment variables
 * ------------------------------
 *   - config_id           : ID of the configuration device that stores the
 *                           dashboard's per-organization data and is used to
 *                           publish validation messages back to the UI.
 *   - SENDGRID_API_KEY    : Secret used to send the invite email.
 *   - sendgrid_from_email : Verified sender address used by SendGrid.
 *   - T_ANALYSIS_TOKEN    : Provided automatically by the TagoIO runtime.
 *
 * NOTE
 * ----
 * This file is optimized for clarity, not performance. The goal is for a
 * developer new to TagoIO to read it top-to-bottom and understand every step.
 */

import { Analysis, type Data, type TagoContext, type TagsObj, type UserListScope } from "npm:@tago-io/sdk";
import { Resources, type RouterConstructor, Services, Utils } from "npm:@tago-io/sdk";
import { DateTime } from "npm:luxon";
import { phone as parsePhone } from "npm:phone";
import z, { ZodError } from "npm:zod";

// ============================================================================
// Validation schema
// ============================================================================

/**
 * Allowed access levels. Each maps to a different Access Policy on TagoIO
 * Run, which controls which dashboards, devices and entities the user can
 * see.
 */
const userAccessModel = z.enum(["admin", "org_admin", "guest"], { error: "#VAL.USER_ACCESS_INVALID#" });

const userModel = z.object({
  name: z
    .string({ error: "#VAL.NAME_REQUIRED#" })
    .min(3, { message: "#VAL.NAME_MIN_3#" })
    .max(40, { message: "#VAL.NAME_MAX_40#" }),
  email: z.email({ message: "#VAL.EMAIL_INVALID#" }),
  // Phone is optional. When present, it must start with the country code
  // and be a valid international number. The transform normalizes the
  // value into the canonical `+CCNNN...` shape returned by `phone`.
  phone: z.preprocess(
    (x) => (x === undefined || x === null || x === "" ? undefined : String(x)),
    z
      .string()
      .refine((x) => x.startsWith("+"), { message: "#VAL.PHONE_COUNTRY_CODE#" })
      .refine((x) => parsePhone(x).isValid, { message: "#VAL.PHONE_INVALID#" })
      .transform((val) => parsePhone(val).phoneNumber ?? val)
      .optional(),
  ),
  access: userAccessModel,
});

/** Partial schema reused by the Edit flow. */
const userEditModel = userModel.partial();

// ============================================================================
// Helpers — error handling
// ============================================================================

/**
 * Extracts a short, human-readable message from a Zod or generic error and
 * re-throws it as a plain `Error`. Only the first Zod issue is surfaced
 * to the user.
 */
function getZodErrorMessage(error: unknown): never {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Validation error";
    throw new Error(message);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Unknown error occurred");
}

// ============================================================================
// Helpers — feedback to the dashboard
// ============================================================================

type ValidationLevel = "success" | "danger" | "warning";

interface ValidationConfig {
  validationVariable: string;
  deviceID: string;
  sessionID?: string;
}

/**
 * Creates a `validate(message, level)` function tied to a specific
 * validation variable on the configuration device. The dashboard listens
 * to this variable through a Validation widget and renders the messages
 * to the user.
 *
 * Each call cleans up old validation entries (>1 minute) and writes a new
 * one with a small timestamp offset, so multiple messages from the same
 * run still appear in the correct order on the dashboard.
 */
function initializeValidation(config: ValidationConfig) {
  let messageIndex = 0;

  return async (message: string, level: ValidationLevel = "success"): Promise<string> => {
    if (!message?.trim()) {
      throw new Error("Validation message cannot be empty");
    }

    const now = DateTime.now();
    // Each subsequent message is pushed 200ms forward so the dashboard
    // renders them in insertion order even if the API timestamps collide.
    const timeOffset = ++messageIndex * 200;

    await Promise.allSettled([
      Resources.devices.deleteDeviceData(config.deviceID, {
        variables: config.validationVariable,
        qty: 999,
        end_date: now.minus({ minutes: 1 }).toJSDate(),
      }),
      Resources.devices.sendDeviceData(config.deviceID, {
        variable: config.validationVariable,
        value: message,
        time: now.plus({ milliseconds: timeOffset }).toJSDate(),
        metadata: {
          type: level,
          session_id: config.sessionID,
          show_markdown: false,
        },
      }),
    ]);

    return message;
  };
}

/**
 * Sends an in-app notification to the Run User who triggered the
 * Analysis. Falls back to a developer notification if no user can be
 * identified — useful for edit/delete flows where the dashboard doesn't
 * expose a Validation widget.
 */
async function sendNotificationFeedback(params: { environment: Record<string, string>; title?: string; message: string }): Promise<void> {
  const { environment, title, message } = params;
  const userID = environment?._user_id;

  if (!userID) {
    const services = new Services({ token: Deno.env.get("T_ANALYSIS_TOKEN") });
    await services.notification.send({ title: title || "#VAL.OPERATION_ERROR#", message });
    return;
  }

  const user = await Resources.run.userInfo(userID).catch(() => null);
  if (!user) {
    const services = new Services({ token: Deno.env.get("T_ANALYSIS_TOKEN") });
    await services.notification.send({ title: title || "#VAL.OPERATION_ERROR#", message });
    return;
  }

  await Resources.run.notificationCreate(userID, {
    title: title || "#VAL.OPERATION_ERROR#",
    message,
  });
}

// ============================================================================
// Helpers — invite flow
// ============================================================================

/**
 * Detects the TagoIO "exceeded the maximum limit of Run users" failure,
 * which happens when the profile reached its Run user quota. TagoIO
 * reports it as e.g. "You have exceeded the maximum limit of Run users (2)".
 */
function isUserLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /maximum limit of run users/i.test(message);
}

/**
 * Generates a random temporary password used as the initial credential
 * for the invited user. The password always includes at least one
 * uppercase letter, lowercase letter, digit and special character.
 */
function generatePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "@!&";
  const all = upper + lower + digits + symbols;

  const randomIndex = (max: number): number => {
    const bytes = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let value = 0;
    do {
      globalThis.crypto.getRandomValues(bytes);
      value = bytes[0];
    } while (value >= limit);
    return value % max;
  };
  const pick = (chars: string) => chars[randomIndex(chars.length)];

  const out = Array.from({ length: 12 }, () => pick(all));
  // Force the first four characters to one of each pool so the password
  // satisfies a typical "at least one of each" policy.
  out[0] = pick(upper);
  out[1] = pick(lower);
  out[2] = pick(digits);
  out[3] = pick(symbols);

  return out.join("");
}

interface InviteEmailParams {
  context: TagoContext;
  toEmail: string;
  name: string;
  password: string;
  runURL: string;
}

/**
 * Sends the welcome email with the temporary password through SendGrid.
 * The template `user_registration` must already exist in the SendGrid
 * account and accept `name`, `email`, `password` and `url_platform`
 * params.
 */
async function sendInviteEmail({ context, toEmail, name, password, runURL }: InviteEmailParams): Promise<void> {
  const environment = Utils.envToJson(context.environment);
  const sendgrid = new Services({ token: context.token }).sendgrid;

  await sendgrid
    .send({
      from: environment.sendgrid_from_email,
      to: [toEmail],
      template: {
        name: "user_registration",
        params: {
          name,
          email: toEmail,
          password,
          url_platform: runURL,
        },
      },
      sendgrid_api_key: environment.SENDGRID_API_KEY,
    })
    .catch((error) => {
      console.error("Email sending failed:", error);
    });
}

interface InviteUserParams {
  context: TagoContext;
  email: string;
  name: string;
  phone?: string;
  tags: TagsObj[];
}

/**
 * Invites a Run User: creates the account with a temporary password and,
 * once it exists, sends the welcome email carrying that password. If
 * creation fails because the user already exists, the existing user's
 * tags are merged with the new ones so the same email can be re-invited
 * into another organization — no email is sent on that path, since the
 * existing account keeps its current password.
 */
async function inviteUser({ context, email, name, phone, tags }: InviteUserParams): Promise<string> {
  const normalizedEmail = email.toLowerCase();
  const password = generatePassword();

  const accountInfo = await Resources.account.info();
  const timezone = accountInfo.timezone || "America/New_York";

  const tagoRunInfo = await Resources.run.info();
  const customPreferenceTemperature = (tagoRunInfo as any).custom_fields?.find((x: any) => x.name === "Temperature Unit")?.id;

  const userPayload = {
    active: true,
    company: "",
    email: normalizedEmail,
    language: "en",
    name,
    phone: String(phone ?? ""),
    tags,
    timezone,
    password,
    ...(customPreferenceTemperature ? { custom_preferences: { [customPreferenceTemperature]: "°F" } } : {}),
  };

  const created = await Resources.run.userCreate(userPayload).catch((error) => {
    console.error("User creation failed:", error);
    if (isUserLimitError(error)) {
      throw error;
    }
    return null;
  });

  if (created?.user) {
    // The account was created with the temporary password, so the
    // welcome email is now valid. Send it only on this path.
    await sendInviteEmail({ context, toEmail: normalizedEmail, name, password, runURL: tagoRunInfo.url });
    return created.user;
  }

  // Fallback: the user already exists. Merge the new tags into the
  // existing user so the invite still grants access to the new tenant.
  // No password is set here, so no credential email is sent — the user
  // keeps their existing password.
  const existing = (await Resources.run.listUsers({
    amount: 1,
    fields: ["id", "tags"],
    filter: { email: normalizedEmail },
  }))[0];

  if (!existing) {
    throw new Error("Failed to create or update user account");
  }

  const keptTags = (existing.tags ?? []).filter((tag) => !tags.some((next) => next.key === tag.key));
  await Resources.run.userEdit(existing.id, { tags: [...keptTags, ...tags] });
  return existing.id;
}

// ============================================================================
// CREATE flow
// ============================================================================

/**
 * Reads the form fields sent by the dashboard from the scope and runs
 * them through the Zod schema.
 */
function extractCreateFormFields(scope: Data[]) {
  const newUserName = scope.find((item: Data) => item.variable === "new_user_name")?.value;
  const newUserEmail = scope.find((item: Data) => item.variable === "new_user_email")?.value;
  const newUserPhone = scope.find((item: Data) => item.variable === "new_user_phone")?.value;
  const newUserAccess = scope.find((item: Data) => item.variable === "new_user_access")?.value;

  return userModel.parseAsync({
    name: newUserName,
    email: newUserEmail,
    phone: newUserPhone,
    access: newUserAccess,
  });
}

/**
 * Handles the "create-user" Input Form submission.
 *
 * Steps:
 *   1. Confirm the scope is a Data array sent by the form.
 *   2. Read the session id so validation messages reach the right user.
 *   3. Validate form fields with Zod; surface the first issue if any.
 *   4. Reject duplicate email addresses.
 *   5. Build the access tags. Admins are application-wide and have no
 *      organization scope; org_admin and guest are scoped to the parent
 *      organization.
 *   6. Create (or update) the Run User, sending the invite email only
 *      when a brand-new account is created.
 *   7. Send a success message back to the dashboard.
 */
async function createUser({ context, environment, scope }: RouterConstructor & { scope: Data[] }) {
  if (!("variable" in scope[0])) {
    console.error("Not a valid TagoIO Data");
    return;
  }

  if (!context) {
    throw "[Error] Missing analysis context.";
  }

  if (!environment.SENDGRID_API_KEY || !environment.sendgrid_from_email) {
    throw "[Error] Missing secrets 'SENDGRID_API_KEY' or 'sendgrid_from_email'.";
  }

  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  // The form is rendered on the per-organization Users dashboard, so
  // the organization id is the device id stored in `scope[0].device`.
  const organizationID = scope[0].device;
  if (!organizationID) {
    throw "[Error] Missing organization ID in scope.";
  }

  const sessionID = z.string().parse(scope.find((item: Data) => item.variable === "create_user_session_id")?.value);
  const validate = initializeValidation({ validationVariable: "create_user_validation", deviceID: configDevID, sessionID });

  // Friendly "working on it" message now that we have the session id.
  await validate("#VAL.ADDING_USER_WAIT#", "warning").catch(console.log);

  // Validate the form. If Zod fails, surface the first issue to the user
  // and abort the run.
  const formFields = await extractCreateFormFields(scope)
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await validate(error.message, "danger");
      throw error;
    });

  // Reject duplicate email addresses anywhere in the Run.
  const existingUsers = await Resources.run.listUsers({
    amount: 1,
    fields: ["id"],
    filter: { email: formFields.email.toLowerCase() },
  });
  if (existingUsers.length > 0) {
    throw await validate("#VAL.EMAIL_ALREADY_IN_USE#", "danger");
  }

  // Build the tag list. Application admins span every organization so
  // they don't get an `organization_id` tag; the other levels are
  // scoped to the organization that triggered the form.
  const tags: TagsObj[] = [
    { key: "access", value: formFields.access },
    { key: "visualize_user", value: "true" },
  ];
  if (formFields.access !== "admin") {
    tags.push({ key: "user_organization_id", value: organizationID });
    tags.push({ key: "organization_id", value: organizationID });
  }

  await inviteUser({
    context,
    email: formFields.email,
    name: formFields.name,
    phone: formFields.phone,
    tags,
  }).catch(async (error: unknown) => {
    console.error("Failed to invite user:", error);
    const feedback = isUserLimitError(error) ? "#VAL.USER_LIMIT_REACHED#" : "#VAL.OPERATION_ERROR#";
    throw await validate(feedback, "danger");
  });

  await validate("#VAL.USER_SUCCESSFULLY_CREATED#", "success");
}

// ============================================================================
// EDIT flow
// ============================================================================

/**
 * Restores a user to its previous state when an edit fails validation.
 * The User List widget includes the previous values under `scope[0].old`,
 * so we use that snapshot to roll back the change.
 *
 * The `tags.access` key needs special handling: tags are an array on
 * TagoIO, so the rollback merges the previous access value into the
 * existing tag set instead of overwriting all tags.
 */
async function undoUserChanges(scope: UserListScope[]): Promise<void> {
  const userID = scope[0].user;
  const old = scope[0]?.old ?? {};

  const updates: { name?: string; phone?: string } = {};
  if (typeof old.name === "string") {
    updates.name = old.name;
  }
  if (typeof old.phone === "string") {
    updates.phone = old.phone;
  }
  if (Object.keys(updates).length > 0) {
    await Resources.run.userEdit(userID, updates).catch(console.error);
  }

  const oldAccess = old["tags.access"];
  if (oldAccess !== undefined) {
    const userInfo = await Resources.run.userInfo(userID);
    const mergedTags: TagsObj[] = (userInfo.tags ?? []).map((tag) => tag.key === "access" ? { key: "access", value: String(oldAccess) } : tag);
    await Resources.run.userEdit(userID, { tags: mergedTags }).catch(console.error);
  }
}

/**
 * Handles the "edit-user" action on the User List widget.
 *
 * The User List sends both the new and the old value for each edited
 * field. We validate the new values; on any failure we restore the old
 * ones and notify the user. The `access` field is stored as a tag, so
 * updates have to merge it back into the existing tag array.
 */
async function editUser({ scope, environment }: RouterConstructor & { scope: UserListScope[] }) {
  const userID = scope[0]?.user;
  if (!userID) {
    throw "[Error] Missing user ID in scope.";
  }

  const newName = scope[0]?.name;
  const newPhone = scope[0]?.phone || undefined;
  const newAccess = scope[0]?.["tags.access"];

  await userEditModel
    .parseAsync({ name: newName, phone: newPhone, access: newAccess })
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await undoUserChanges(scope);
      await sendNotificationFeedback({ environment, message: error.message });
      throw error;
    });

  if (newAccess !== undefined) {
    const userInfo = await Resources.run.userInfo(userID);
    const existingTags: TagsObj[] = userInfo.tags ?? [];
    const hasAccessTag = existingTags.some((tag) => tag.key === "access");

    const mergedTags = hasAccessTag
      ? existingTags.map((tag) => (tag.key === "access" ? { key: "access", value: String(newAccess) } : tag))
      : [...existingTags, { key: "access", value: String(newAccess) }];

    await Resources.run.userEdit(userID, { tags: mergedTags });
  }
}

// ============================================================================
// DELETE flow
// ============================================================================

/**
 * Handles the "delete-user" identifier on the User List widget.
 *
 * Steps:
 *   1. Capture the user info (email) before the account is removed, so
 *      we can include it in the success notification.
 *   2. Clean any rows the dashboard wrote to the config device keyed to
 *      this user. Without this, ghost rows would remain on widgets that
 *      group data by `user_id`.
 *   3. Delete the Run User.
 *   4. Notify the operator.
 */
async function deleteUser({ scope, environment }: RouterConstructor & { scope: UserListScope[] }) {
  const userID = scope[0]?.user;
  if (!userID) {
    throw "[Error] Missing user ID in scope.";
  }

  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  await Resources.devices
    .deleteDeviceData(configDevID, { groups: userID, qty: 9999 })
    .catch(console.error);

  await Resources.run.userDelete(userID);

  await sendNotificationFeedback({
    environment,
    title: "#VAL.USER_REMOVED_TITLE#",
    message: "#VAL.USER_SUCCESSFULLY_REMOVED#",
  });
}

// ============================================================================
// Router entrypoint
// ============================================================================

/**
 * Entrypoint invoked by the TagoIO Analysis runtime. Reads the scope and
 * environment, sets up the router, and dispatches to the matching CRUD
 * handler.
 */
async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  console.log("Running CRUD User Analysis");
  console.log("Scope:", scope);

  const environment = Utils.envToJson(context.environment);
  if (!environment.config_id) {
    throw "Missing config_id environment variable";
  }

  const router = new Utils.AnalysisRouter({ scope, context, environment });

  router.register(createUser).whenInputFormID("create-user");
  router.register(editUser).whenUserListIdentifier("edit-user");
  router.register(deleteUser).whenUserListIdentifier("delete-user");

  const result = await router.exec();
  console.log("Services found:", result.services);
}

// The Analysis runtime sets `T_TEST` during local tests so the handler is
// not wired up automatically. In production the runtime sets
// `T_ANALYSIS_TOKEN` and calls `Analysis.use` below.
if (!Deno.env.get("T_TEST")) {
  Analysis.use(startAnalysis, { token: Deno.env.get("T_ANALYSIS_TOKEN") });
}

export { startAnalysis };
