# Organization Folder Overview
This folder is responsible for the organization device handling. Mostly actions are triggered by the "Admin" dashboard.

## Files
The Organization folder contains the following files:
* Register a organization - register.ts
* Edit a organization - edit.ts
* Remove a organization - remove.ts

### Diagram

:::mermaid
sequenceDiagram
    participant RUN Application
    participant Handler Analysis
    participant Organization Script Folder
    participant TagoIO
        alt register.ts
            RUN Application ->> Handler Analysis: "Create New" command trigger
            Handler Analysis ->> Organization Script Folder: Redirects
            Organization Script Folder -->> TagoIO: Creates new organization device (listed on "Organization List" table)
            Organization Script Folder -->> TagoIO: Creates org_id data
        end
        alt edit.ts
            RUN Application ->> Handler Analysis: Controls "Edit" command trigger
            Handler Analysis ->> Organization Script Folder: Redirects
            Organization Script Folder -->> TagoIO: Edit org_id data
            Organization Script Folder -->> TagoIO: Edit organization parameters
        end
        alt delete.ts
            RUN Application ->> Handler Analysis: Controls "Delete" command trigger
            Handler Analysis ->> Organization Script Folder: Redirects
            Organization Script Folder -->> TagoIO: Delete org_id data
            Organization Script Folder -->> TagoIO: Delete organization's users
            Organization Script Folder -->> TagoIO: Delete organization's sensor device
            Organization Script Folder -->> TagoIO: Delete organization's group device
            Organization Script Folder -->> TagoIO: Delete organization device
        end
    