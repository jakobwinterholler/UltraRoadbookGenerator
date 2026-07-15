import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthCallbackRouter } from "@shared/auth/AuthCallbackRouter";
import { AuthProvider } from "@shared/auth/AuthProvider";
import "leaflet/dist/leaflet.css";
import App from "./App";
import { AuthSyncBridge } from "./sync/AuthSyncBridge";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AuthCallbackRouter>
        <AuthSyncBridge />
        <App />
      </AuthCallbackRouter>
    </AuthProvider>
  </StrictMode>,
);
