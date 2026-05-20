import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TagoIOProvider } from "@tago-io/custom-widget-react";
import App from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TagoIOProvider>
      <App />
    </TagoIOProvider>
  </StrictMode>,
);
