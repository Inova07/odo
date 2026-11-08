import { APP_VERSION } from "./config.js";

// Keeps the last few errors on the device so a support request can include them.
const KEY = "odo_errlog";
const MAX = 25;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function logError(msg, extra) {
  try {
    const list = read();
    list.push({ t: new Date().toISOString(), msg: String(msg).slice(0, 400), extra: extra ? String(extra).slice(0, 400) : undefined });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch { /* storage unavailable */ }
}
export function installErrorCapture() {
  window.addEventListener("error", (e) => logError(e.message, `${e.filename || ""}:${e.lineno || ""}`));
  window.addEventListener("unhandledrejection", (e) => logError("Unhandled promise: " + (e.reason?.message || e.reason)));
}
export function clearErrors() { try { localStorage.removeItem(KEY); } catch {} }

/* Snapshot attached to a support ticket. No shift/expense contents — just counts. */
export function collectDiagnostics({ user, plan, ledger, settings }) {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  return {
    appVersion: APP_VERSION,
    time: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userId: user?.id || null,
    email: user?.email || null,
    plan: plan || "free",
    device: navigator.userAgent,
    screen: `${window.screen?.width}x${window.screen?.height} @${window.devicePixelRatio}x`,
    installedAsApp: standalone,
    online: navigator.onLine,
    region: settings?.region,
    counts: { shifts: ledger?.shifts?.length || 0, expenses: ledger?.expenses?.length || 0, onShift: Boolean(ledger?.active) },
    recentErrors: read().slice(-10),
  };
}
