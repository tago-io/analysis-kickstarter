# Analysis
The files in this folder represents analysis scripts that must be uploaded to your account.

* **handler**: The script that handles actions take on the dashboards, such clicking in a button to create/delete/edit a user and other entities.
* **alertCentral**: Same as handler, but it handles alert buttons.
* **dataRetention**: When ran, it will make sure all the devices has the correct data retention set. It must paired with a scheduled action.
* **deviceUpdater**: When ran, it will update all device configuration parameters with last checkin, battery, and also send alerts if any. It must paired with a scheduled action.
* **sendReport**: Send the scheduled report of an organization. The handler script will automatically generate actions for this analysis.
* **alertTrigger**:  Send an alert of an organization. The alertCentral script will automatically generate actions for this analysis.
* **sendReport**: Responsible to generate the PDF report via email.
* **monthlyUsageReset**: Responsible for reset the monthly usage of SMS and Email from all clients.