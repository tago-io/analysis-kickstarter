interface SensorInfo {
  [key: string]: { desc: string; icon: string; color: string };
}

export const sensor_status_true: SensorInfo = {
  motion: { desc: "motion", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/person_motion.svg", color: "#E40C13" },
  leak: { desc: "leakage", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/water.svg", color: "#E40C13" },
  door: { desc: "open", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/door_open.svg", color: "" },
  window: { desc: "open", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/Opened%20Window.svg", color: "#E40C13" },
};

export const sensor_status_false: SensorInfo = {
  motion: { desc: "normal(no motion)", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/person_no_motion.svg", color: "#B8B8B8" },
  leak: { desc: "normal(no leakage)", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/No%20Water.svg", color: "#B8B8B8" },
  door: { desc: "close", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/door_close.svg", color: "#0E9A43" },
  window: { desc: "close", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/Closed%20Window.svg", color: "#0E9A43" },
  tracker: { desc: "-", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/wifi.svg", color: "#2F3065" },
  humidity_temp: { desc: "-", icon: "https://api.tago.io/file/612e6ab5ce34b90011757801/thermometer-snow.svg", color: "#2F3065" },
};
