# Kickstarter

Multi-tenant IoT template that runs on TagoIO. It ships the three things a complete TagoIO application needs: **Analyses** (Deno serverless handlers), **custom Dashboard
Widgets** (React iframes), and **dashboard helper docs** (the markdown rendered inside each dashboard's `Helper` tab in the application).

The runtime is Deno end-to-end. Widgets add a Vite/React toolchain on top for the browser bundle. Everything is wired as a Deno workspace so analyses and widgets can share
types without a publish step.

## Layout

```
analysis-kickstarter/
├── app/                 # Deno workspace — Analyses + bundle script
├── widgets/             # Vite/React workspace — one subfolder per widget
├── dashboard-helpers/   # Markdown files rendered inside each dashboard's Helper tab in the application
└── deno.json            # Root workspace + top-level tasks
```

Detailed docs live next to the code:

- [`app/README.md`](./app/README.md) — analyses, triggers, AnalysisRouter, bundling
- [`widgets/README.md`](./widgets/README.md) — widget stack, dev server, multi custom widget build

## Application model

Two complementary views of the same thing. The TagoIO side (devices and tags) is what the analyses manipulate; the navigation side is what a user sees in the browser.

```
TagoIO resources                            User navigation (TagoRUN)
─────────────────                            ───────────────────────────
Settings device (settings_dev)              Welcome
└── Organization device                     └── Organizations  ──► Groups
    (tag device_type=organization)              ├── Map View       └── Sensors (per group)
    ├── Run users                               └── Create/Edit        ├── Sensor List
    │   (Super Admin │ Org Admin │ Guest)                              ├── Sensor Detail
    ├── Alert rows (stored on the org device)                          │   (Temp gauge / Compressor / Door)
    └── Group device                                                   └── All Devices (Admin)
        (tag device_type=group)                                ──► Alerts (Sensor + Global)
        └── Sensor device                                      ──► Users (Org Admin / Guest)
            (real device — tag device_type=device,
             network, model, EUI)
```

The hierarchy is enforced through device tags: `organization_id` and `group_id` propagate down so TagoIO Access Policies isolate tenants automatically.

## Dashboards

Six dashboards, every one with a `Helper` tab that renders the matching file in [`dashboard-helpers/`](./dashboard-helpers).

| Dashboard       | Tabs                                       | CRUD analysis (in [`app/analysis/dashboard/`](./app/analysis/dashboard/)) | Custom widget                                                                |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Organizations   | Overview (List + Map) · Helper             | `crud-organization.ts`                                                    | —                                                                            |
| Groups          | Cold Rooms · Overview · Helper             | `crud-group.ts`                                                           | [`cold-room-card-data`](./widgets/cold-room-card-data) on the Cold Rooms tab |
| Sensors         | Overview · All Devices (Admin) · Helper    | `crud-sensor.ts`                                                          | [`sensor-status`](./widgets/sensor-status) on Overview                       |
| Sensor Detail   | Overview · Helper                          | —                                                                         | [`cold-room-monitor`](./widgets/cold-room-monitor) on Overview               |
| Alerts          | Overview · Global Alerts · Helper          | `crud-alert.ts`                                                           | —                                                                            |
| Users           | Overview · All Users (Admin) · Helper      | `crud-user.ts`                                                            | —                                                                            |

Each CRUD analysis is dispatched by the SDK's `AnalysisRouter` based on the widget that fired the call (input form, custom button, or device-list action). The full mapping
is documented in [`app/README.md`](./app/README.md).

Three more analyses run outside of any dashboard:

- `actions/uplink-handler.ts` — Action-triggered. Turns each sensor uplink into the `cold_room_card_data` row that powers the Cold Rooms widget.
- `actions/alert-dispatcher.ts` — Action-triggered. Called by the per-alert Action created by `crud-alert.ts` whenever a condition is met.
- `scheduled/check-inactive-sensors.ts` — Scheduled (hourly). Flags sensors that haven't reported within the configured threshold and refreshes the connectivity summary
  shown on the Sensors dashboard.

## Top-level tasks

Run from the repo root:

| Task                      | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `deno task build:app`     | Bundle every analysis into `build/app/*.tagoio.js`  |
| `deno task build:widgets` | Build every widget into `widgets/_dist/<name>/`     |
| `deno task dev:widgets`   | Start the widget dev server (needs `WIDGET=<name>`) |
| `deno task test:all`      | Run app tests                                       |
| `deno task lint:all`      | Lint app and widgets                                |
| `deno task fmt`           | Format everything (`deno fmt`)                      |

Per-workspace task lists live in the folder READMEs.

## Prerequisites

- Deno (latest)
- TagoIO CLI — `npm install -g @tago-io/cli`, then `tagoio login`

## Conventions

- `kebab-case` for files and folders.
- Explicit block braces on every control structure — no single-line `if`/`for`/`while`.
- Analyses are ephemeral: no in-memory state between runs — persist via device data or entity records.
- Data queries always set `qty` explicitly; the SDK default (15) silently truncates.
- Buckets are deprecated — use device storage directly.

Full guidance lives in [`CLAUDE.md`](./CLAUDE.md).
