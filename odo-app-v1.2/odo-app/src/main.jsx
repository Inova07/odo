import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { installErrorCapture } from "./diagnostics.js";

installErrorCapture();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Offline support for the web version (skipped inside the native Capacitor app).
if ("serviceWorker" in navigator && location.protocol === "https:" && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
