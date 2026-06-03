# 🚨 Alerts

## 💡 What is an Alert?

An **Alert** is a rule that watches your sensors and notifies the right people the moment something needs attention — a freezer warming up, a door left open, a compressor that
stopped, or a sensor that went silent. Each alert is scoped to one **organization**, so users in one tenant only see (and only receive) the alerts that belong to them.

You can create as many alerts as you need, mix and match sensor selections, and customize the message that goes out so the recipient knows exactly what happened and where.

## 🛠️ What can I do on this dashboard?

This dashboard lists every alert configured for the organization you opened.

- 📋 **By Sensor — Alert List** — A table with every alert: which sensor(s) it watches, the model (Temperature, Door, Compressor, Inactivity), the condition, the value, the
  recipients, and the message. From here, you can:
  - **Delete** an alert (the trash icon under _Controls_). Deletion is irreversible — the rule is removed and no more notifications fire for it.
- 🌐 **Global Alerts** — A read-only tab showing the application-wide defaults (used when an organization has no specific Inactivity rule of its own).
- ➕ **Create Alert** — Opens the form to add a new alert. You choose which sensors to watch, the model, the condition, the recipients, and the message.

## 🧩 The four alert types

| Model              | What it watches                            | Example condition                                          |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------- |
| 🌡️ **Temperature** | The `temperature` variable from the sensor | `> 80°F`, `< 20°F`, `between 30-40°F`, `= 50°F`, `!= 60°F` |
| 🚪 **Door**        | The `door` variable (open/closed)          | `door = open`                                              |
| ⚙️ **Compressor**  | The `compressor` variable (on/off)         | `compressor = off`                                         |
| ⏰ **Inactivity**  | How long since the sensor's last uplink    | `no data for 2 hours`                                      |

Temperature is always in **°F**. Door and Compressor are enums chosen from a dropdown. Inactivity is measured in hours.

## ✉️ The notification message

The message is sent **in-app** (the bell icon at the top of the dashboard) to every recipient you picked. You can personalize it with placeholders that are replaced at the moment
the alert fires:

- `#device_name#` — the friendly name of the sensor
- `#device_id#` — the sensor's internal ID
- `#sensor_type#` — the sensor's type tag (e.g. `freezer`)
- `#value#` — the value that crossed the threshold
- `#variable#` — the variable name that triggered (e.g. `temperature`)

Example: _"Freezer 02 is too hot: temperature reached #value#°F"_ becomes _"Freezer 02 is too hot: temperature reached 84°F"_.

## ⚙️ How it works behind the scenes

Each alert is one logical record on the **organization device**, written as six variables sharing the same `group` (which doubles as the alert ID). The widget table reads those
rows directly — that's why a new alert shows up on the table right after creation.

For **Temperature, Door, and Compressor** alerts, the `createAlert` analysis function also provisions a TagoIO **Action** of type `condition`:

1. ✅ Validates the form fields with a Zod schema (model, condition, value, recipients, message).
2. 💾 Writes the six alert variables on the organization device, grouped by a fresh alert ID.
3. 🏷️ If the alert targets specific sensors, it tags each chosen sensor with `alert_id = <alertID>` so the Action can find them by tag.
4. 🎬 Creates a TagoIO Action whose trigger matches either _every device in the organization_ (`device_type = device`) or _only the sensors with the matching `alert_id` tag_.
5. 📨 The Action calls the `alert-dispatcher` analysis whenever the condition is met. The dispatcher reads the alert row, substitutes the placeholders, and sends the in-app
   notification to each recipient.

**Inactivity** alerts work differently — they are NOT backed by a TagoIO Action (the platform cannot natively detect "no data for X hours"). Instead, the scheduled
`check-inactive-sensors` analysis runs periodically, reads every organization's Inactivity rules, and fires notifications using the per-organization recipients and message.

The delete flow runs in reverse: it removes the six variables from the organization device, removes the `alert_id` tag from any sensors that were tagged for it, and deletes the
TagoIO Action (when there is one).

## ❓ Common questions

**What's the difference between _All Sensors_ and _Sensors_ in "Setup alerts by"?** _All Sensors_ makes the alert watch every sensor currently in the organization, including any
sensor added later — the Action's trigger is keyed by the `device_type = device` tag. _Sensors_ lets you pick a specific list; only the sensors you check are tagged and watched.

**If I create an All Sensors alert and add a new sensor later, will it be covered?** Yes, automatically — because the Action filters by the `device_type` tag, which every sensor in
the organization already has.

**Why don't I see an Action created for my Inactivity alert?** By design. Inactivity is detected by a scheduled scan, not by a TagoIO condition Action. The rule is stored on the
organization device and read on each run of the `check-inactive-sensors` analysis.

**Do recipients receive an email or SMS?** No — only in-app notifications (the bell at the top of the dashboard). Email and SMS are out of scope for this template.

**What happens to old notifications if I delete an alert?** Already-sent notifications stay in the recipient's inbox; only future notifications stop. Deleting the alert removes the
rule, the row in the table, the Action (if any), and the `alert_id` tag on the targeted sensors.

**Can two alerts target the same sensor?** Yes — a sensor can be watched by as many alerts as you want, and each fires independently.

## 💎 Tips

- Use placeholders in the message so the same alert template works for every sensor. _"#device_name# reported #variable# = #value#"_ is more useful than a static text.
- For Temperature _Between_, set the lower bound first and the upper bound second. The alert fires when the value falls **inside** the range.
- Inactivity alerts are great as a safety net: even if a specific Temperature or Door alert is missing, an Inactivity rule will catch sensors that simply stopped reporting.
- Prefer one _All Sensors_ alert over creating a separate alert per sensor — easier to maintain and automatically covers newly added sensors.
- Keep the recipient list lean. Notification fatigue makes important alerts get ignored.
