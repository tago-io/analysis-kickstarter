# 🔍 Freezer Simulator

## 💡 What is this dashboard?

The **Freezer Simulator** dashboard is the deep-dive view of a single sensor. You land here by clicking the **View** icon next to a sensor on the Sensors dashboard — there is no entry
for it on the sidebar because it always needs a specific sensor in scope.

## 🛠️ What can I do on this dashboard?

The header keeps the breadcrumb selectors (Organization, Group, Sensor) populated from the deep-link, so you always know which sensor you are looking at. The dashboard itself has
two tabs:

- 📊 **Overview tab** — the default view, made up of three areas:
  - **Live Cold Room Monitor** (custom widget) — three large cards at the top: _TEMPERATURE_ (gauge + value in °F), _COMPRESSOR STATUS_ (ON/OFF), and _DOOR STATUS_
    (OPEN/CLOSED). Each card shows a "— Xm ago" label so you can tell at a glance whether the value is fresh.
  - **Sensor History table** — a paginated list of the last readings with columns _Temperature_, _Door Status_, _Compressor Status_, and _Date and Time_. The table loads up to
    1,000 records, paginated; scroll back through the pages to see older uplinks.
  - **Temperature History (header button)** — opens a 24-hour line chart of the temperature in a modal over the dashboard. It supports drag-to-zoom; a _Reset Zoom_ button brings
    you back to the full window. Use it when you need to spot trends, drops, or warm-ups that a single value cannot show.
- 📘 **Helper tab** — this document.

## ⚙️ How it works behind the scenes

There is no per-sensor dashboard *device* — the dashboard reads the sensor's own device directly. The deep-link from the Sensors table sets `sensor_dev=<sensorID>` in the URL, and
every widget on this page is bound to that scope through TagoIO Blueprints.

- The three **live cards** in the Cold Room Monitor are fed by the sensor device's latest values for the variables `temperature`, `compressor`, and `door`. The custom widget
  formats them and computes the "X minutes ago" label from each value's timestamp.
- The **Sensor History table** queries those same variables on the sensor device, ordered by time descending. It is a regular TagoIO data table, which is why pagination and the
  total record count work out of the box.
- The **Temperature History chart** is a Line Chart widget bound to the `temperature` variable on the sensor device, configured for the last 24 hours.

Because every widget reads the sensor device directly, no analysis runs when you open this dashboard. The data you see was written by the `uplink-handler` analysis (and by the
decoder) when the sensor pushed its uplinks.

## ❓ Common questions

**Why isn't this dashboard in the sidebar?** It only makes sense for one sensor at a time, and that sensor comes from the URL parameters set by the Sensors dashboard. Without
that scope the dashboard would have nothing to render, so it is intentionally accessed only via the **View** icon.

**The cards show "— Xh ago" with a large number. What does that mean?** The sensor hasn't pushed an uplink for that long. It is the same signal the Cold Rooms tab uses on the
Groups dashboard. Check the device's connectivity (network, battery) if the time keeps climbing.

**Why does the Temperature History chart only cover 24 hours?** It is configured for a 24-hour window because that matches the most common operational question (_"what has
this freezer done today?"_).

**Can I edit the sensor from here?** No — this is a read-only operational view. To rename or delete the sensor, go back to the Sensors dashboard and use the row controls.

**My table is empty even though the cards show data. Why?** The cards read the *latest* value, while the table queries the last 1,000 ordered by time. If you just provisioned the
sensor and only one uplink arrived, the table will have a single row.

## 💎 Tips

- Use the Temperature History modal as your first stop when investigating an alert: a chart usually answers _"is this a spike or a sustained problem?"_ faster than scrolling the
  table.
- The Sensor History table lines up _Temperature_, _Door Status_, and _Compressor Status_ on the same row, so it is the right place to correlate events — for example, to check
  whether a temperature spike coincided with the door opening or the compressor turning off.
- The `— Xm ago` label is your fastest health check. Two of the three cards lagging behind usually means the sensor itself is offline; one card alone usually means a decoder or
  payload issue.
