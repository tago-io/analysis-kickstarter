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
* **uplinkHandler**: The script handles uplinks from devices, like geolocation for outdoor tracking.
* **userSignUp**: The script handles users that sign up in the application, if it is enabled in your Run configuration.

# Analysis Template
You can get the template for each analysis, with all the Environment Variables in place (you still need to update environment variables parameters).

* **Uplink Handler**: https://admin.tago.io/template/61c1c1346aec8f001844ea3b 
* **User Signup**:  https://admin.tago.io/template/61b327b8e3f46d00192153b7
* **Send Report**: https://admin.tago.io/template/61b2f6199e269200196d4344
* **Handler**: https://admin.tago.io/template/61b2f617e3f46d00191d997c 
* **Data Retention**: https://admin.tago.io/template/61c310d6d6df77001acb54a4
* **Device Updater**: https://admin.tago.io/template/61b2f6124edcc00019b44f0b
* **Alert Trigger**: https://admin.tago.io/template/61b2f610a14c040018c6672f

# Dashboard Template
You can get the dashboard templates to use with the analysis in the following links:
* **Administrator**: https://admin.tago.io/template/61b2f61c9da1b800183a3284
* **Alerts**: https://admin.tago.io/template/61b2f61c9e269200196d434d
* **Groups**: https://admin.tago.io/template/61b2f61da14c040018c6680c
* **Group** View: https://admin.tago.io/template/61b2f61e9da1b800183a32c1
* **User List for Administrators**: https://admin.tago.io/template/61b2f61f561da800197abfde
* **User List**: https://admin.tago.io/template/61b2f622e3f46d00191d9aa7
* **Plan Management**: https://admin.tago.io/template/61b2f620e3f46d00191d9a1f
* **Sensor** List: https://admin.tago.io/template/61b2f621561da800197ac053
* **Reports**: https://admin.tago.io/template/61bc7b19dd44bf0019a56d22
* **Organization** Details: https://admin.tago.io/template/61c0d2c05fb101001b417fbd

# Sensor dashboard templates
The following templates are optional, for specific sensor dashboards. You can use as an example for building your own.
* Door Sensor: https://admin.tago.io/template/61b2f61c9da1b800183a329a
