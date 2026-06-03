# 👥 Users

## 💡 What is a User?

A **User** is a person who logs into your application through TagoRUN — a customer, a technician, an operator, or anyone who needs to see data. Every user belongs to one
organization (with the exception of Application Admins, who are not tied to any) and has an **access level** that decides what they can do.

This dashboard is where you invite users, change what they can see, and remove access when needed.

## 🛠️ What can I do on this dashboard?

This dashboard shows every user that belongs to the organization selected at the top.

- 🏢 **Organization selector** — The dropdown at the top scopes the dashboard to a single organization. Switching it reloads the list with that organization's users without leaving
  the page.
- 📋 **Users List** — A table with name, email, phone, and access level for every user. From here, you can:
  - **Change password** (the key icon under _Controls_) — opens a small dialog to set a new password for the user, bypassing the email flow.
  - **Edit** (the pencil icon under _Controls_) — opens a form to update the name, phone, or access level. Email is fixed once the user is created.
  - **Delete** (the trash icon under _Controls_) — removes the user account from TagoRUN. The action is irreversible.
- 🛡️ **All Users (Admin)** — An admin-only tab that lists every user in the application, including Application Admins not tied to any organization. Use it when you need a global
  view.
- ➕ **Create User** — Opens a form to invite a new user. You provide name, email, an optional phone, and the access level. The new user receives an email with a link to set their
  password.

## 🔐 Access levels

The kickstarter ships with three levels, defined in the user model. Pick the one that matches the user's role:

- **Application Admin** — full access to every organization in the application. Use it for the team that maintains the platform itself.
- **Organization Admin** — full access to a single organization. Can create, edit, and delete groups, sensors, and other users _inside that organization_.
- **Guest** — read-only access to a single organization. Can view dashboards but cannot create, edit, or delete anything.

The access level is stored as a tag (`access`) on the run user. Org Admin and Guest also receive an `organization_id` tag that scopes their visibility through Access Policies.

## ⚙️ How it works behind the scenes

When you create a user, the `createUser` analysis function runs and:

1. ✅ Validates name, email, phone, and access level using a Zod schema. The phone must include a country code (for example, `+1` for US numbers); the email must be a valid
   address.
2. 🔍 Checks that the email is not already in use anywhere in the application.
3. 🏷️ Creates the run user, applies the `access` tag, and (for Org Admin and Guest) the `organization_id` and `user_organization_id` tags that link them to the current
   organization.
4. 📧 Sends an invite email with the temporary password. **The reference implementation uses SendGrid**, but the call lives in a single helper (`sendInviteEmail`) — swap it for any
   provider (Mailgun, SES, Resend, SMTP, etc.) without touching the rest of the flow.

When you edit a user, only the fields you changed are sent. If validation fails, the analysis runs `undoUserChanges` to restore the previous values, so the UI never drifts out of
sync with the backend.

## 📧 Email provider (SendGrid)

The kickstarter expects two analysis environment variables:

- `SENDGRID_API_KEY` — API key with _Mail Send_ scope.
- `sendgrid_from_email` — verified sender address.

**Errors you may see:**

- Missing vars → `[Error] Missing secrets 'SENDGRID_API_KEY' or 'sendgrid_from_email'.`
- SendGrid rejects (wrong key, unverified sender, missing template) → log shows `Email sending failed: ...` check the analysis logs to see the SendGrid response.

## ❓ Common questions

**Why isn't there a phone number for some users?** Phone is optional on the form. If you don't fill it in, the user is created without a phone — you can add one later through the
edit dialog.

**The invite email never arrives. What now?** Check the SendGrid configuration in the application's environment variables (`SENDGRID_API_KEY` and `sendgrid_from_email`). Without
them set, the invite step fails. As a fallback, you can also use _Change password_ to set a password directly and share it with the user out of band.

**Can I change a user's email?** No. Email is the primary identifier in TagoRUN and is fixed after creation. If a user changes email, the cleanest path is to delete the old account
and invite them again.

**Can I move a user to a different organization?** There is no built-in flow for that. The user's `organization_id` tag would need to be edited directly. Delete and re-invite is
the safest path today.

## 💎 Tips

- Use _Organization Admin_ sparingly. It gives full control inside the organization, including the power to delete every group and sensor.
- _Guest_ is the right level for stakeholders who only need to look at dashboards — they cannot break anything.
- _Application Admin_ is unscoped. Only assign it to the team that maintains the platform; everyone else should have an organization tag.
- Keep names readable. The user name shows up in audit logs and notifications, so "Maria — Field Tech" is clearer than just "Maria".
