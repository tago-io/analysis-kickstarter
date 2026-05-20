# 🏢 Organizations

## 💡 What is an Organization?

An **Organization** is the top-level entity in this application. It represents a customer, a site, a team, or any tenant that owns a set of groups, sensors, dashboards, and users.
Everything in the application — devices, data, alerts, access — is scoped to one Organization, which is what makes this template multi-tenant by default.

If you are building an IoT application where each of your customers should see only their own data, the Organization is the unit you create for each customer.

## 🛠️ What can I do on this dashboard?

This dashboard is your starting point for managing every organization in the application.

- 📋 **Organization List** — A table with the name and address of every organization. From here, you can:
  - **View** an organization (the icon on the left) — opens the Groups dashboard already filtered for that organization.
  - **Edit** the name or address (the pencil icon under _Controls_).
  - **Delete** the organization (the trash icon under _Controls_). Deleting an organization also removes its dummy device and any data linked to it.
- 🗺️ **Map View** — Shows every organization as a pin on a map, based on its address. Click a pin to open a popup with the organization name, the last update timestamp, and a _Go
  to organization_ link that opens the Groups dashboard. Use this view when you want a geographic overview of all your tenants.
- ➕ **Create Organization** — Opens a form to add a new organization. You provide a name and an address; the address is geocoded so the new organization appears on the Map View.

## ⚙️ How it works behind the scenes

Each organization is stored as a TagoIO **device** of type `mutable` with the tag `device_type = organization`. This device acts as a small store for the organization's metadata
(name, address, location) and as the anchor for everything that belongs to it.

When you create an organization, the `createOrganization` analysis function runs and:

1. ✅ Validates the form fields using a Zod schema.
2. 🔍 Checks that the name is unique inside this application.
3. 🏷️ Creates the device, applies the `organization_id` and `device_type` tags, and stores the address as a device parameter.

Groups, sensors, and run users that you create later carry the matching `organization_id` tag, which is how Access Policies isolate data between tenants.

## ❓ Common questions

**Where does the data come from?** From the application's settings device (the dummy device passed in the URL as `settings_dev`). The list and the map both read the same
`organization` data variable that the analysis writes when you create or edit an organization.

**Why can't I find a group or a sensor on this dashboard?** This dashboard only shows organizations. To see what belongs to an organization, click _View_ on its row — you will land
on the Groups dashboard scoped to that organization.

**What happens if I delete an organization that already has groups and sensors?** The delete action removes the organization device and triggers cleanup, but you should remove its
groups and sensors first to avoid orphan devices. Check the _Groups_ dashboard inside the organization before deleting it.

## 💎 Tips

- Keep organization names clear and unique. They are shown across every dashboard and used in notifications.
- Use a real address when creating an organization — it powers the Map View and helps users locate sites quickly.
- This dashboard is intended for application administrators (the `admin` access level). Org admins and guests typically land directly on the Groups dashboard of their own
  organization.
