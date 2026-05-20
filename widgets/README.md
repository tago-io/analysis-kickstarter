# `widgets/` — Custom Dashboard Widgets

Each widget is a self-contained React app (TypeScript + Vite + Tailwind v4) that TagoIO loads inside a dashboard iframe. Every widget is built independently so its `_dist/<name>/`
folder is fully self-contained and can be uploaded as a single bundle.

## Layout

```
widgets/
├── <widget-name>/              # One folder per widget — each is its own Vite app
│   ├── index.html              # Vite entry; <div id="root"> only
│   ├── main.tsx                # createRoot + <TagoIOProvider>
│   ├── App.tsx                 # widget root component
│   ├── styles.css              # @import "tailwindcss";
│   ├── components/             # Only when code actually moves out of App.tsx
│   └── deno.json               # Per-widget imports + Deno LSP compilerOptions
├── shared/                     # Cross-widget helpers (imported as @/shared/... from each widget)
├── _dist/                      # Build output, one folder per widget (git-ignored)
├── build.ts                    # Builds every widget in one pass
├── vite.config.ts              # Shared Vite config — picks a widget via WIDGET env
└── deno.json                   # Workspace-level tasks + shared npm imports
```

Current widgets:

- **sensor-status** — Sensors dashboard / Overview tab. Three KPI cards (registered / active / inactive) fed by `device_connectivity_summary`.
- **cold-room-card-data** — Groups dashboard / Cold Rooms tab. One card per sensor (temperature, compressor, door, last seen) grouped by Group.
- **cold-room-monitor** — Sensor Detail dashboard / Overview tab. Temperature gauge plus compressor and door state for a single sensor.

## The iframe model (why some rules are absolute)

The TagoIO dashboard renders the widget title, `⋮` menu, and background **outside** the iframe. Two consequences every widget must respect:

- **No widget title or page background inside the component** — you'll get visible duplicates.
- **No fixed pixel sizes on the root** — the iframe is resized live when the user drags the widget edges. Use `h-dvh w-dvw` plus container queries and `ResizeObserver` for
  canvases.

## The four root files

These four files live at the widget's root — no exceptions:

| File         | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| `index.html` | Vite entry point. One `<div id="root">`, no body styles. |
| `main.tsx`   | `createRoot` + `<TagoIOProvider>` wrapping `<App />`.    |
| `App.tsx`    | Widget root. Uses SDK hooks to read config/data.         |
| `styles.css` | `@import "tailwindcss";` only.                           |

Add `components/`, `hooks/`, `lib/`, or `features/` **only** when code actually needs to move out of `App.tsx`. Cross-widget helpers go in [`widgets/shared/`](./shared) (imported
as `@/shared/...`), never inside another widget.

## Data access: hooks only

All TagoIO interaction goes through hooks from `@tago-io/custom-widget-react` — never call `window.TagoIO.*` in components. `<TagoIOProvider>` in `main.tsx` wires them up.

| Need                             | Hook                                                  |
| -------------------------------- | ----------------------------------------------------- |
| Widget config + live data (most) | `useWidgetData()`                                     |
| Config only                      | `useWidget()`                                         |
| Live data only                   | `useRealtimeData()`                                   |
| Send / edit / delete data        | `useSendData()` / `useEditData()` / `useDeleteData()` |
| Edit account resources           | `useEditResourceData()`                               |
| Trigger an analysis              | `useRunAnalysis()`                                    |
| Open a dashboard / close a modal | `useNavigation()`                                     |
| User locale, token, preferences  | `useUserInformation()`                                |
| Blueprint device selection       | `useBlueprintDevices()`                               |
| i18n                             | `useDictionary()`                                     |
| Surface SDK errors               | `useWidgetErrors()`                                   |

`records` from `useWidgetData` / `useRealtimeData` is a **flat array mixing all variables together** — group by `record.variable` for per-variable handling.

Import TagoIO types (`TDataRecord`, `TUserInformation`, etc.) from the SDK — don't redeclare them.

## Tasks

Run from `widgets/` (or as `deno task <name>:widgets` from the repo root):

| Task                  | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `deno task dev`       | Start Vite dev server on port 1234. Requires `WIDGET=<folder-name>`. |
| `deno task build`     | Run `build.ts` — builds every widget into its own `_dist/<name>/`.   |
| `deno task build:one` | Build one widget (requires `WIDGET=<folder-name>`).                  |
| `deno task preview`   | Preview the last build.                                              |

Example:

```bash
WIDGET=sensor-status deno task dev         # Dev server for sensor-status
WIDGET=sensor-status deno task build:one   # Build just sensor-status
deno task build                            # Build every widget
```

## Testing against a real TagoIO dashboard

TagoIO only loads widgets from **HTTPS** endpoints, so pointing a dashboard at `http://localhost:1234` won't work — the iframe will refuse to load. For dev you need an HTTPS tunnel
in front of the Vite server.

The dev server is pre-configured for this: it binds to all interfaces (`host: true`) and trusts any `Host` header (`allowedHosts: true`), so tunnels route to it without extra
config.

Typical flow with [ngrok](https://ngrok.com/):

```bash
# Terminal 1 — dev server
WIDGET=sensor-status deno task dev

# Terminal 2 — expose it over HTTPS
ngrok http 1234
```

Copy the `https://<something>.ngrok-free.app` URL ngrok prints and paste it into the widget's **URL** field in the TagoIO dashboard. Cloudflare Tunnel
(`cloudflared tunnel --url http://localhost:1234`) works the same way. Keep in mind: free ngrok tunnel URLs change on every restart — you'll need to re-paste after each session.

## Adding a new widget

1. Create `widgets/<name>/` with the four root files (copy from `sensor-status/`).
2. Add a `deno.json` with the widget's npm imports and `compilerOptions` for the Deno LSP (Deno doesn't inherit these from the parent).
3. Register the widget path in the root `deno.json` workspace array.
4. `WIDGET=<name> deno task dev` — iterate.

## Build output

`build.ts` discovers every folder under `widgets/` that contains an `index.html`, then invokes Vite once per widget with `WIDGET=<name>`. Each build writes to
`widgets/_dist/<name>/` with a flat layout (`base: "./"`, `assetsDir: ""`) so the whole folder can be uploaded to TagoIO file storage or any static host.

## Stack

- React 19 — declared at the workspace `deno.json` and inherited by every widget
- TypeScript
- Vite (via `@vitejs/plugin-react`)
- Tailwind v4 (via `@tailwindcss/vite`)
- `@tago-io/custom-widget-react` — `<TagoIOProvider>` and all hooks

Per-widget extras are declared in each widget's own `deno.json` when needed (e.g. charting or date libraries).

## What never to do

- No widget title or page background inside the iframe — the dashboard chrome already shows them.
- No fixed pixel sizes on the root.
- No router. Each widget is its own `index.html`; routing inside one means you actually have two widgets.
- No `window.TagoIO.*` in components when a hook exists.
- No cross-widget global state — each iframe is a separate runtime. Coordinate via TagoIO data.
- No `window.parent` navigation. Use `useNavigation().openLink(url)`.
