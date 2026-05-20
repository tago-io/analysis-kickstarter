# 🧩 Groups

## 💡 What is a Group?

A **Group** is a subdivision inside an Organization. It represents a physical or logical area where sensors are installed — for example, a cold room, a warehouse, a production
line, a floor, or a zone. Each sensor in the application belongs to exactly one group, and each group belongs to exactly one organization.

Groups are the layer that makes large deployments manageable. Instead of looking at every sensor at once, users navigate Organization → Group → Sensor, which keeps each screen
focused on the right scope.

## 🛠️ What can I do on this dashboard?

This dashboard shows every group that belongs to the organization selected at the top. It is split into three tabs:

- ❄️ **Cold Rooms tab** — A live-monitoring view showing every sensor in the organization grouped by its parent group. Each group is rendered as a section header with a count
  (e.g: _"5 SENSORS"_) followed by one card per sensor. Every card surfaces the sensor name, time since the last uplink, current temperature (°F), compressor status (ON/OFF), and door
  status (OPEN/CLOSED). A search button in the top-right filters the cards by sensor name, which is handy when an organization has many sensors. This is the tab to open first
  when a user wants to know the current state of their cold rooms.
- 🏢 **Organization selector** — The dropdown at the top lets you switch between organizations without leaving this dashboard. It uses TagoIO's Blueprint feature: changing the
  organization rewrites every widget in place to show that organization's groups.
- 📋 **Overview tab — Group List** — A table with the name and address of every group inside the current organization. From here, you can:
  - **View** a group (the icon on the left) — opens the Sensors dashboard already filtered for that group.
  - **Edit** the group's name (the pencil icon under _Controls_).
  - **Delete** the group (the trash icon under _Controls_). Deleting a group also deletes every sensor that belongs to it.
- ➕ **Create Group** — Opens a form to add a new group to the current organization. You provide a name and an address; the group is created inside the organization you are
  viewing.

## ⚙️ How it works behind the scenes

Each group is stored as a TagoIO **device** of type `mutable` with the tags `device_type = group` and `organization_id = <parent org>`. This device stores the group's metadata
(name, address) and acts as the anchor for every sensor that belongs to it.

When you create a group, the `createGroup` analysis function runs and:

1. ✅ Validates the form fields using a Zod schema.
2. 🔍 Checks that the name is unique inside the parent organization (the same name is allowed in different organizations).
3. 🏷️ Creates the device, applies the `organization_id`, `group_id`, and `device_type` tags, and stores the address as a device parameter.

Sensors that you create later carry the matching `group_id` tag, which is how this dashboard's Sensors view knows what to display.

The **Cold Rooms tab** is powered by a TagoIO **custom widget** that reads the `cold_room_card_data` variable from the organization device. That variable is written by the
`uplink-handler` analysis on every sensor uplink: one record per sensor, grouped by sensor id, with metadata for the sensor name, parent group name, temperature, compressor
status, and door status. The widget uses the `group_name` field to cluster the cards by group at render time — no extra query is needed.

## ❓ Common questions

**Why is the organization selector at the top?** Because this same dashboard is reused for every organization. The selector tells the dashboard which organization to scope to, and
the Blueprint feature reloads every widget with that organization's data. This is a TagoIO pattern that lets you keep one dashboard configuration while serving many tenants.

**Can two groups have the same name?** Two groups in the _same_ organization cannot share a name — the analysis blocks it. Two groups in _different_ organizations can share a name
without any conflict.

**What happens if I delete a group that already has sensors?** The delete action removes every sensor inside the group along with the group device itself. The action is
irreversible, so make sure you are deleting the right one. If you only want to move sensors to another group, edit the sensors first.

**Why does a sensor card on the Cold Rooms tab show stale data or `— Xh ago`?** The card mirrors whatever the sensor last reported. If the time-since-last-uplink keeps climbing,
the device is likely offline or out of battery — open the Sensors view for that group to investigate.

**A new sensor doesn't appear on the Cold Rooms tab. Why?** The card only shows up after the sensor produces its first uplink (the `uplink-handler` writes the
`cold_room_card_data` record on the organization device the first time it sees a value from that sensor). Once the device sends data, the card appears automatically.

## 💎 Tips

- Use names that match the real world (for example, _Cold Room A_, _Floor 2 — North Wing_). The group name is shown across the application and in notifications.
- The address is informative only at this level — the Sensors dashboard does not show it on a map. Still, providing an accurate address makes the data easier to interpret later.
- An organization can have any number of groups. Start with the structure that mirrors your physical sites, then refine as you learn what your users need.
- Use the search field on the Cold Rooms tab to jump straight to a sensor by name when the organization has many sensors — much faster than scrolling.
