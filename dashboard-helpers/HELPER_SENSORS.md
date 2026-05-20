# 📡 Sensors

## 💡 What is a Sensor?

A **Sensor** is an IoT device that sends data to TagoIO — a temperature probe, a GPS tracker, an energy meter, or any hardware that produces measurements. In this application each
sensor belongs to one group, which in turn belongs to one organization, so the data is always scoped to the right tenant and the right area.

Each sensor is identified by a unique **EUI**, the hardware code printed on the device. The EUI is what TagoIO uses to route incoming packets to the correct sensor.

## 🛠️ What can I do on this dashboard?

This dashboard shows every sensor inside the group you opened from the Groups dashboard.

- 📊 **Sensor Status cards** — A summary at the top with three counts: total _Registered_, _Active_ (sending data right now), and _Inactive_ (not sending data). The total is
  updated automatically every time you create or delete a sensor.
- 📋 **Sensor List** — A table with name, EUI, network, model, last seen, and battery for every sensor in the group. From here, you can:
  - **View** a sensor (the icon on the left) — opens the sensor's detail dashboard with charts and recent data.
  - **Edit** the sensor's name (the pencil icon under _Controls_).
  - **Delete** the sensor (the trash icon under _Controls_). Deletion is irreversible — the device and all its stored data are removed.
- 🛡️ **All Devices (Admin)** — An admin-only tab that lists every device of this group, including dummy devices (like the group's own device). Use it only when you need to inspect
  or repair the underlying TagoIO objects.
- ➕ **Create Sensor** — Opens a form to add a new sensor. You provide a name, pick the network and model, and enter the EUI. The sensor is created inside the current group.

## ⚙️ How it works behind the scenes

Each sensor is stored as a TagoIO **device** of type `immutable` (time-series storage) with the tags `device_type = device`, `sensor_id`, `device_eui`, `group_id`, and
`organization_id`. The network and connector chosen on the form define how incoming payloads are decoded.

When you create a sensor, the `createSensor` analysis function runs and:

1. ✅ Validates the form fields using a Zod schema (name length, EUI format, network, connector).
2. 🔍 Checks that the name is unique inside the parent group, and that the EUI is unique across the whole application (no two sensors can share a hardware code).
3. 🏷️ Creates the device, applies the tags above, and stores the EUI and a deep-link to the sensor dashboard as device parameters.
4. 🔄 Updates the group's `device_connectivity_summary` record so the Sensor Status cards reflect the new total.

The delete flow runs in reverse: it removes the device and then refreshes the same summary record on the group, so the counter goes down right away.

## ❓ Common questions

**What is the EUI and where do I find it?** The EUI is a 16-character hexadecimal identifier (`0123456789ABCDEF`). It is printed on the device itself or on its box, and the
manufacturer guarantees it is unique. You can also scan it with the _Scan QR Code_ button if the device has a QR code.

**Why does the Sensor Status widget show `—` for the active and inactive counts?** The total registered count is maintained by the create and delete analyses, but the active and
inactive counts come from a separate monitoring flow that watches each sensor's last uplink. In a fresh installation, those values will stay as `—` until a monitoring action starts
updating them.

**Can two sensors have the same EUI?** No. The application enforces uniqueness at creation time, because the EUI is what links incoming data to the right sensor. If two sensors
shared an EUI, their data would collide.

**What happens if I delete a sensor?** The device, all its time-series data, parameters, and tags are removed. The action is irreversible, so make sure you exported anything you
need before deleting.

## 💎 Tips

- Use names that describe the role and the location, like _Freezer 02 — Top Shelf_. The sensor name shows up in dashboards, alerts, and notifications.
- The model defines which decoder is applied to incoming data. Choosing the right model is what makes the sensor's data show up in the correct units.
- If a sensor stops appearing in _Active_, check the _Last seen_ column first — long gaps usually mean the device is offline or out of battery.
