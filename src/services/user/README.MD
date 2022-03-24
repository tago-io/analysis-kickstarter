# Device Folder Overview
This folder is responsible for the User handling. Mostly actions are triggered by the "Users" dashboard.

## Files
The User folder contains the following files:
* Register a user - register.ts
* Edit a user - edit.ts
* Remove a user - remove.ts

### Diagram

:::mermaid
sequenceDiagram
    participant RUN Application
    participant Handler Analysis
    participant User Script Folder
    participant TagoIO
        alt register.ts
            RUN Application ->> Handler Analysis: "Create New" command trigger
            Handler Analysis ->> User Script Folder: Redirects
            User Script Folder -->> TagoIO: Send new user to "Users List" table (create user_id variable)
            User Script Folder -->> TagoIO: Creates new User on TagoIO
        end
        alt edit.ts
            RUN Application ->> Handler Analysis: Controls "Edit" command trigger
            Handler Analysis ->> User Script Folder: Redirects
            User Script Folder -->> TagoIO: Edit user_id variable
            User Script Folder -->> TagoIO: Edit TagoIO User information
        end
        alt delete.ts
            RUN Application ->> Handler Analysis: Controls "Delete" command trigger
            Handler Analysis ->> User Script Folder: Redirects
            User Script Folder -->> TagoIO: Delete user_id data
            User Script Folder -->> TagoIO: Delete TagoIO User
        end
    