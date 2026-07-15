import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@shared/auth/AuthProvider";
import App from "./App";
import { CloudRaceListProvider } from "./sync/CloudRaceListContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CloudRaceListProvider>
        <App />
      </CloudRaceListProvider>
    </AuthProvider>
  </StrictMode>,
);
