import process from "node:process";

// Sends sensor readings with the token of the "E2E Data Seeder" Analysis, which may only send data to
// sensors (see .env.example). The profile behind E2E_BASE_URL lives in the us-e1 region.
const API_URL = "https://api.us-e1.tago.io";

export const hasSeederToken = () => Boolean(process.env.E2E_TAGOIO_ANALYSIS_TOKEN);

export interface SensorReading {
  temperatureF: number;
  compressor: "on" | "off";
  door: "open" | "closed";
}

// Sent already in the format the Freezer Simulator parser stores. Raw simulator payloads
// (temperature_1, ...) also work, but on this endpoint the raw variables are kept next to the parsed ones.
// The write triggers the Uplink Handler Analysis, like a real uplink.
export const sendSensorReading = async (sensorId: string, reading: SensorReading) => {
  const response = await fetch(`${API_URL}/device/${sensorId}/data`, {
    method: "POST",
    headers: { Authorization: process.env.E2E_TAGOIO_ANALYSIS_TOKEN ?? "", "Content-Type": "application/json" },
    body: JSON.stringify([
      { variable: "temperature", value: reading.temperatureF, unit: "°F" },
      { variable: "compressor", value: reading.compressor },
      { variable: "door", value: reading.door },
    ]),
  });
  if (!response.ok) {
    throw new Error(`Sending a reading to sensor ${sensorId} failed: ${response.status} ${await response.text()}`);
  }
};
