import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

registerSW({
  immediate: true,
  onRegistered(registration) {
    if (registration) {
      window.setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    console.info("[Companion] App shell ready for offline use.");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
