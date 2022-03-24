# Group Folder Overview
This folder is responsible for the Group device handling. Mostly actions are triggered by the "Groups" dashboard.

## Files
The Group folder contains the following files:
* Register a plan - register.ts
* Edit a plan - edit.ts
* Remove a plan - remove.ts

### Diagram

:::mermaid
sequenceDiagram
    participant RUN Application
    participant Handler Analysis
    participant Group Script Folder
    participant TagoIO
        alt register.ts
            RUN Application ->> Handler Analysis: "Create New" command trigger
            Handler Analysis ->> Group Script Folder: Redirects
            Group Script Folder -->> TagoIO: Creates new group device (listed on "Group List" table)
            Group Script Folder -->> TagoIO: Creates group_id data
        end
        alt edit.ts
            RUN Application ->> Handler Analysis: Controls "Edit" command trigger
            Handler Analysis ->> Group Script Folder: Redirects
            Group Script Folder -->> TagoIO: Edit group_id data
            Group Script Folder -->> TagoIO: Edit group's device parameters
            loop All sensors that have the Group assigned
                Group Script Folder -->> TagoIO: Edit sensor's group
            end
        end
        alt delete.ts
            RUN Application ->> Handler Analysis: Controls "Delete" command trigger
            Handler Analysis ->> Group Script Folder: Redirects
            Group Script Folder -->> TagoIO: Delete group_id data
            Group Script Folder -->> TagoIO: Delete group's device
            loop All sensors that have the Group assigned
                Group Script Folder -->> TagoIO: Remove group from the sensor
            end
        end
    