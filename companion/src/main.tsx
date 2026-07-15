import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthCallbackRouter } from "@shared/auth/AuthCallbackRouter";
import { AuthProvider } from "@shared/auth/AuthProvider";
import App from "./App";
import { PwaUpdateProvider } from "./pwa/PwaUpdateProvider";
import { CloudRaceListProvider } from "./sync/CloudRaceListContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AuthCallbackRouter variant="dark">
        <PwaUpdateProvider>
          <CloudRaceListProvider>
            <App />
          </CloudRaceListProvider>
        </PwaUpdateProvider>
      </AuthCallbackRouter>
    </AuthProvider>
  </StrictMode>,
);
