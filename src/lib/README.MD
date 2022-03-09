# Alerts Folder Overview
This folder is responsible for the alerts handling. Mostly actions are triggered by the "Alert Central" dashboard.

## Files
The Alert folder contains the following files:
* Register an alert - register.ts
* Edit an alert - edit.ts
* Remove an alert - remove.ts

### Diagram

:::mermaid
sequenceDiagram
    participant RUN Application
    participant Handler Analysis
    participant Alerts Script Folder
    participant TagoIO
        alt register.ts
            RUN Application ->> Handler Analysis: "Create New" command trigger
            Handler Analysis ->> Alerts Script Folder: Redirects
            Alerts Script Folder -->> TagoIO: Creates TagoIO action
            Alerts Script Folder -->> TagoIO: Send new alert to "Alert List" table (create action_list variable)
        end
        alt edit.ts
            RUN Application ->> Handler Analysis: Controls "Edit" command trigger
            Handler Analysis ->> Alerts Script Folder: Redirects
            Alerts Script Folder -->> TagoIO: Edit TagoIO action
            Alerts Script Folder -->> TagoIO: Edit existing alert on "Alert List" table
        end
        alt delete.ts
            RUN Application ->> Handler Analysis: Controls "Delete" command trigger
            Handler Analysis ->> Alerts Script Folder: Redirects
            Alerts Script Folder -->> TagoIO: Delete TagoIO action
            Alerts Script Folder -->> TagoIO: Delete existing alert on "Alert List" table
        end
    