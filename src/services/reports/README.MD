# Reports Folder Overview
This folder is responsible for the report handling. Mostly actions are triggered by the "Report System" dashboard.

## Files
The Report folder contains the following files:
* Register a report - register.ts
* Edit a report - edit.ts
* Remove a report - remove.ts
* TagoIO Action structure for scheduled reports - action.model.ts

### Diagram

:::mermaid
sequenceDiagram
    participant RUN Application
    participant Handler Analysis
    participant Reports Script Folder
    participant TagoIO
        alt register.ts
            RUN Application ->> Handler Analysis: "New Scheduled Report" command trigger
            Handler Analysis ->> Reports Script Folder: Redirects
            Reports Script Folder -->> TagoIO: Creates schedule TagoIO action
            Reports Script Folder -->> TagoIO: Sends new report to "Scheduled Report List" table
        end
        alt edit.ts
            RUN Application ->> Handler Analysis: Controls "Edit" command trigger
            Handler Analysis ->> Reports Script Folder: Redirects
            Reports Script Folder -->> TagoIO: Edit schedule TagoIO action
            Reports Script Folder -->> TagoIO: Edit existing report on "Scheduled Report List" table
        end
        alt delete.ts
            RUN Application ->> Handler Analysis: Controls "Delete" command trigger
            Handler Analysis ->> Reports Script Folder: Redirects
            Reports Script Folder -->> TagoIO: Delete schedule TagoIO action
            Reports Script Folder -->> TagoIO: Delete existing report on "Scheduled Report List" table
        end
    