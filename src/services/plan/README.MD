# Plan Folder Overview
This folder is responsible for the plan system handling. Mostly actions are triggered by the "Plan Management" dashboard.

## Files
The Plan folder contains the following files:
* Register a plan - register.ts
* Edit a plan - edit.ts
* Remove a plan - remove.ts
* Check and charge an organization service usage (email, sms and push notification) - checkAndChargeUsage.ts

### Diagram

:::mermaid
sequenceDiagram
    participant RUN Application
    participant Handler Analysis
    participant Plan Script Folder
    participant TagoIO
        alt register.ts
            RUN Application ->> Handler Analysis: "Create New" command trigger
            Handler Analysis ->> Plan Script Folder: Redirects
            Plan Script Folder -->> TagoIO: Sends new plan to "Plan List" table (create plan_data variable)
        end
        alt edit.ts
            RUN Application ->> Handler Analysis: Controls "Edit" command trigger
            Handler Analysis ->> Plan Script Folder: Redirects
            Plan Script Folder -->> TagoIO: Edit plan_data
            loop All organizations that have the plan assigned
                Plan Script Folder -->> TagoIO: Edit organization's plan information
            end
        end
        alt delete.ts
            RUN Application ->> Handler Analysis: Controls "Delete" command trigger
            Handler Analysis ->> Plan Script Folder: Redirects
            Plan Script Folder -->> TagoIO: Delete plan_data
            alt Plan is assigned to an organization
                Plan Script Folder -->> TagoIO: Send the scope back (prevent to delete)
            else Plan is not assigned to an organization
                Plan Script Folder -->> TagoIO: Return
            end
        end
    