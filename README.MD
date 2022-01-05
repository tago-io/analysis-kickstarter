# Starter Kit Application for TagoIO
This is a starter application to be used at TagoIO. It contains main features needed for an regular application to run, and it is meant to be easy setting up new sensors within the application.
You can use the scripts provided for learning or to develop your own solution with the foundations provided here.

# Components
The application contains the following features:
* Two levels: Organization and Groups.
* Three access levels: Super Administrator, Organization Administrator and User.
* Organization plans for managing sms, email and data retetion.
* Setup alerts.
* Generate scheduled reports.
* Navigation between dashboards and Run Buttons enabled.

### Installation
* Install Node.JS.
* Download the repository.
* Open your terminal and enter the folder of the repository.
* Run `npm install`.
* Generate a account-profile token at TagoIO **My Settings** -> **Your Profile** -> **Tokens**. Make sure to generate a token with `Expire at` set to never.
* Open the `build.ts` and replace `Your-Account-Profile-Token` by a token of your profile.
* Go back to your terminal and run the template with `npm start`.
* It should take a few minutes for the script to build and import all the analysis and dashboards to your account.

### Updating
* Make sure you have the `build.ts` with your account profile token.
* Update the repository with last version.
* Go back to your terminal and run the template with `npm start`.
* It should take a few minutes for the script to build and import all the analysis and dashboards to your account.

### How to use the application
The documentation on how to use the application is avaiable to download in the following link []().

### How to learn from this code
You will three folders in the `src/` folder.
* **analysis**: contains each analysis that must be present in your account.
* **lib**: useful list of functions commonly used between the scripts.
* **services**: services folders that are used in the analysis. Each service is related 
### Support
You can open an issue or question at [https://github.com/tago-io/analysis-ekit/issues](https://github.com/tago-io/analysis-ekit/issues).

### License

