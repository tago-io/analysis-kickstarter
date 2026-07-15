# `app/` — Analyses

Deno workspace (`@app/application`) containing every TagoIO Analysis the Kickstarter ships. Each analysis is a single, self-contained TypeScript file under `analysis/`. There is no
build step: to deploy, you **copy the file's contents and paste it into the matching Analysis on the TagoIO admin panel**.

## Layout

```
app/
├── analysis/
│   ├── dashboard/                       # Dashboard widget interactions (input forms, buttons, list actions)
│   │   ├── crud-organization.ts
│   │   ├── crud-group.ts
│   │   ├── crud-sensor.ts
│   │   ├── crud-alert.ts
│   │   └── crud-user.ts
│   ├── actions/                         # Triggered by TagoIO Actions on data events
│   │   ├── uplink-handler.ts
│   │   └── alert-dispatcher.ts
│   └── scheduled/                       # Triggered by a Scheduled Action (cron)
│       └── check-inactive-sensors.ts
└── deno.json
```

## The self-contained file convention

Every analysis under `analysis/` is a single TypeScript file with **no relative imports**. Constants, Zod schemas, helpers and handlers all live in the same file, grouped by
section headers. The goal is to let a developer new to TagoIO read one analysis top-to-bottom and understand every step it performs — and to make it trivial to copy/paste the whole
file into a TagoIO Analysis.

Practical consequences:

- Cross-analysis code duplication is intentional. Do not factor shared helpers into a `lib/` folder — keep each file self-explanatory.
- The only imports allowed are `npm:@tago-io/sdk`, `npm:zod`, `npm:luxon`, `npm:phone`, and `npm:json-2-csv`.
- `*.test.ts` files sit next to the analysis they cover and run with `deno task test`.

## Handlers

| File                                  | Trigger type                     | What it does                                                                              |
| ------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `dashboard/crud-organization.ts`      | Dashboard widget callbacks       | Create / edit / delete Organization devices (`device_type=organization`).                 |
| `dashboard/crud-group.ts`             | Dashboard widget callbacks       | Create / edit / delete Group devices (`device_type=group`) inside an Organization.        |
| `dashboard/crud-sensor.ts`            | Dashboard widget callbacks       | Create / edit / delete Sensor devices (`device_type=device`) inside a Group.              |
| `dashboard/crud-alert.ts`             | Dashboard widget callbacks       | Persist alert rules on the Organization device, provision per-alert Actions.              |
| `dashboard/crud-user.ts`              | Dashboard widget callbacks       | Invite / edit / delete Run Users (Org Admin or Guest). Uses SendGrid for the invite mail. |
| `actions/uplink-handler.ts`           | Action — Trigger by Variable     | Writes `cold_room_card_data` rows on the Group and Organization devices on every uplink.  |
| `actions/alert-dispatcher.ts`         | Action — created by `crud-alert` | Renders the alert message and sends an in-app notification to each recipient.             |
| `scheduled/check-inactive-sensors.ts` | Scheduled Action (hourly cron)   | Marks sensors that missed the configured threshold as offline, refreshes the summary.     |

## Dashboard analyses and `AnalysisRouter`

The five `crud-*.ts` analyses are called by TagoIO widgets on a dashboard. The SDK's `AnalysisRouter` (`@tago-io/sdk` → `Utils`) inspects the `scope` of the incoming data and
dispatches to the right handler based on the widget identifier:

| Widget type      | Router method              | Identifier convention |
| ---------------- | -------------------------- | --------------------- |
| Input Form       | `whenInputFormID`          | `create-<resource>`   |
| Custom Button    | `whenCustomBtnID`          | `edit-<resource>`     |
| Device/User List | `whenDeviceListIdentifier` | `delete-<resource>`   |

For example, `crud-organization.ts` routes to `createOrganization`, `editOrganization`, and `deleteOrganization` based on whether the dashboard fired the `create-org` form, the
`edit-org` button, or the `delete-org` list action. The same shape repeats for groups, sensors, alerts and users.

Every dashboard analysis reads `context.environment` through `Utils.envToJson` and validates the required env vars early (typically `config_id`, plus `T_ANALYSIS_TOKEN` which the
runtime injects). `crud-user.ts` additionally requires `SENDGRID_API_KEY` and `sendgrid_from_email`; `crud-alert.ts` additionally requires `alert_dispatcher_id`.

## Action and scheduled analyses

- `uplink-handler.ts` is wired to a TagoIO Action of type _Trigger by Variable_ that targets sensor devices (tag `device_type=device`) and listens to `temperature`, `compressor`
  and `door`. On each match the analysis writes one `cold_room_card_data` record on both the parent Group device and the parent Organization device — that record powers the Cold
  Rooms widget.
- `alert-dispatcher.ts` is wired by `crud-alert.ts` at alert creation time, **one Action per alert**. The Action condition encodes the rule the user picked on the dashboard; when
  it fires, the analysis loads the persisted alert row, replaces placeholders (`#device_name#`, `#device_id#`, `#sensor_type#`, `#value#`, `#variable#`) and sends an in-app
  notification to every recipient.
- `check-inactive-sensors.ts` runs hourly. It compares each sensor's last uplink against the per-org inactivity rules (or the global fallback stored on the settings device) and
  writes the `last_uplink` parameter and the `device_connectivity_summary` row consumed by the Sensors dashboard.

## Deploy

To get an analysis running on TagoIO:

1. Open the matching Analysis on the TagoIO admin panel (or create one with the same name).
2. Copy the contents of the `.ts` file from `analysis/` and paste it into the Analysis code editor.
3. Configure the Analysis environment variables expected by the handler (see each file's docstring; `T_ANALYSIS_TOKEN` is injected by TagoIO).
4. Save.

There is no automated deploy and nothing to build locally — what you read in `analysis/` is what runs on TagoIO.

## Tasks

Run from `app/` (or as `deno task <name>:app` from the repo root):

| Task                    | What it does                                      |
| ----------------------- | ------------------------------------------------- |
| `deno task test`        | Run every `*.test.ts` in the workspace            |
| `deno task test:single` | `deno test --allow-all` — pass a path to scope it |
| `deno task linter`      | Lint (skips tests, allows `any`)                  |
| `deno task linter-fix`  | Lint with `--fix`                                 |

## Dependencies

Declared in `app/deno.json`:

- `@tago-io/sdk` (inherited from root) — Analysis runtime primitives, `Resources`, `Services`, `Utils.AnalysisRouter`.
- `zod` — Schema validation for every form payload.
- `luxon` — Date/time math used across handlers.
- `phone` — Phone number normalization in `crud-user.ts`.
- `json-2-csv` — CSV import/export (when needed by a handler).

## Rules that bite

- **No in-memory state between runs** — analyses are ephemeral (Lambda-style). Persist via device data or entity records.
- **Always set `qty` on data queries** — the default of 15 silently truncates.
- **Buckets are deprecated** — use device storage directly. Flag any legacy bucket reference for migration.
- **Explicit block braces** on every `if` / `for` / `while`, even single-line.
