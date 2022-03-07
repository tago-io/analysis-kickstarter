# Uplink Folder Overview
This folder is responsible for the sensor's uplink handling. Everytime a sensor sends a variable which has an action ([TagoIO] - Sensor Uplink Status Trigger) created to listen to it, an uplink script will be triggered to process the information sent.

## Files
The Report folder contains the following files:

* sensorUplinkLocation.ts
* sensorUplinkStatus.ts
* sensorUplinkTempHum.ts

### Diagram

:::mermaid
sequenceDiagram
    participant Sensor Uplink
    participant Action (Sensor Uplink Status Trigger)
    participant Uplink Handler Analysis
    participant Uplink Script Folder
    participant TagoIO
            Sensor Uplink ->> Action (Sensor Uplink Status Trigger): Watched variable (e.g. status, temperature, humidity and location)
            Action (Sensor Uplink Status Trigger) ->> Uplink Handler Analysis: Triggers
            Uplink Handler Analysis -->> Uplink Script Folder: Redirects
            Uplink Script Folder -->> TagoIO: Process the data and create new customized variables
    