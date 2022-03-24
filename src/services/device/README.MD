# Device Folder Overview
This folder is responsible for the Sensor device handling. Mostly actions are triggered by the "Groups" dashboard.

## Files
The Device folder contains the following files:
* Register a sensor - register.ts
* Edit a sensor - edit.ts
* Remove a sensor - remove.ts
* Place a sensor (pin) on a group plan - placeSensor.ts
* Stores sensor's pin information - deviceInfo.ts

### Diagram

:::mermaid
sequenceDiagram
    participant RUN Application
    participant Handler Analysis
    participant Device Script Folder
    participant TagoIO
        alt register.ts
            RUN Application ->> Handler Analysis: "Create New" command trigger
            Handler Analysis ->> Device Script Folder: Redirects
            Device Script Folder -->> TagoIO: Create dev_id data
            Device Script Folder -->> TagoIO: Creates new device on TagoIO
        end
        alt edit.ts
            RUN Application ->> Handler Analysis: Controls "Edit" command trigger
            Handler Analysis ->> Device Script Folder: Redirects
            Device Script Folder -->> TagoIO: Edit dev_id data
            Device Script Folder -->> TagoIO: Edit sensor's device parameters
        end
        alt delete.ts
            RUN Application ->> Handler Analysis: Controls "Delete" command trigger
            Handler Analysis ->> Device Script Folder: Redirects
            Device Script Folder -->> TagoIO: Delete dev_id data
            Device Script Folder -->> TagoIO: Delete sensor's device
        end
    