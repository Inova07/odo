import { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, Car, Receipt, Download, Plus, Settings, Fuel, Smartphone,
  Shield, Wrench, ShoppingBag, MapPin, Bike, Tag, ChevronLeft, ChevronRight,
  X, Play, Square, Trash2, Clock, TrendingUp, Info, Check, Copy,
  User, LifeBuoy, Lock, BookOpen, Download as DownloadIcon, UserX, FileText, Crown, Cloud, CloudOff, RefreshCw, LogOut, Mail, ExternalLink,
} from "lucide-react";
import { store } from "./storage.js";
import { CONFIG, CLOUD_ON, APP_VERSION } from "./config.js";
import * as cloud from "./cloud.js";
import { collectDiagnostics, logError } from "./diagnostics.js";
import { GUIDE, TOUR, GUIDE_UPDATED } from "./guide.js";

/* ---------- design tokens (grounded in the driver's world) ---------- */
const C = {
  bg: "#EEF1F6",
  surface: "#FFFFFF",
  ink: "#141A2E",
  inkSoft: "#5A6076",
  line: "#E3E7F0",
  night: "#141A2E",
  nightCell: "#0B0F1E",
  nightSoft: "#232B47",
  amber: "#F5A300",
  amberSoft: "#FFE7B8",
  go: "#16B364",
  goSoft: "#DBF4E5",
  alert: "#E5484D",
  white: "#FFFFFF",
};
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/* ---------- regional defaults (indicative — all editable in Settings) ---------- */
const REGIONS = {
  AU: { name: "Australia", symbol: "$", unit: "km", rate: 0.91, cap: 5000, fyM: 7, fyD: 1, autoRate: true },
  NZ: { name: "New Zealand", symbol: "$", unit: "km", rate: 1.17, cap: 14000, fyM: 4, fyD: 1 },
  UK: { name: "United Kingdom", symbol: "£", unit: "mi", rate: 0.45, cap: 10000, fyM: 4, fyD: 6 },
  US: { name: "United States", symbol: "$", unit: "mi", rate: 0.70, cap: 0, fyM: 1, fyD: 1 },
  CA: { name: "Canada", symbol: "$", unit: "km", rate: 0.70, cap: 5000, fyM: 1, fyD: 1 },
  IE: { name: "Ireland", symbol: "€", unit: "km", rate: 0, cap: 0, fyM: 1, fyD: 1 },
  OTHER: { name: "Other", symbol: "$", unit: "km", rate: 0, cap: 0, fyM: 1, fyD: 1 },
};

/* ATO cents-per-km rate by financial year (key = year the FY starts, 2026 = FY 26–27).
   Add a line each June when the ATO announces the next year's rate. */
const AU_RATES = { 2022: 0.78, 2023: 0.85, 2024: 0.88, 2025: 0.88, 2026: 0.91 };
const AU_LATEST = Math.max(...Object.keys(AU_RATES).map(Number));
/* Rate that applies to a given FY: automatic ATO rate for AU (unless switched off), else the user's own. */
const rateFor = (s, fyStartYear) =>
  s.region === "AU" && s.autoRate !== false ? (AU_RATES[fyStartYear] ?? AU_RATES[AU_LATEST]) : num(s.rate);
/* ATO resident brackets from 1 July 2026 (16% → 15%). Medicare levy (2%) is extra. */
const AU_BRACKETS = [15, 30, 37, 45];

const CATS = [
  { id: "fuel", label: "Fuel", icon: Fuel, pct: 100, running: true },
  { id: "phone", label: "Phone & internet", icon: Smartphone, pct: 80, running: false },
  { id: "insurance", label: "Rego & insurance", icon: Shield, pct: 100, running: true },
  { id: "repairs", label: "Servicing & repairs", icon: Wrench, pct: 100, running: true },
  { id: "gear", label: "Delivery gear & bags", icon: ShoppingBag, pct: 100, running: false },
  { id: "parking", label: "Parking & tolls", icon: MapPin, pct: 100, running: false },
  { id: "bike", label: "Bike & e-bike", icon: Bike, pct: 100, running: false },
  { id: "other", label: "Other", icon: Tag, pct: 100, running: false },
];
const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

const PLATFORMS = ["Uber Eats", "DoorDash", "Menulog", "Deliveroo", "Grubhub", "Just Eat", "Amazon Flex", "Other"];

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

function fyBounds(startYear, m, d) {
  const start = new Date(startYear, m - 1, d);
  const end = new Date(startYear + 1, m - 1, d);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  const label = m === 1 ? `${startYear}` : `FY ${String(startYear).slice(2)}–${String(startYear + 1).slice(2)}`;
  return { start, end, label };
}
function currentFYStartYear(m, d) {
  const now = new Date();
  const start = new Date(now.getFullYear(), m - 1, d);
  return now < start ? now.getFullYear() - 1 : now.getFullYear();
}

/* ---------- count-up (for the odometer) ---------- */
function useCountUp(target) {
  const [val, setVal] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = ref.current, to = target;
    if (reduce || from === to) { ref.current = to; setVal(to); return; }
    const t0 = performance.now(); let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 600);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else ref.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

function Odometer({ value, symbol }) {
  const v = useCountUp(value);
  const str = Math.round(v).toLocaleString();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 800, color: C.amber, marginRight: 2 }}>{symbol}</span>
      {str.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} style={{
            fontFamily: MONO, fontSize: 40, fontWeight: 800, color: C.amber, background: C.nightCell,
            borderRadius: 8, padding: "6px 4px", minWidth: 30, textAlign: "center",
            boxShadow: "inset 0 -6px 10px rgba(0,0,0,.45), inset 0 6px 8px rgba(255,255,255,.04)",
          }}>{ch}</span>
        ) : (
          <span key={i} style={{ fontFamily: MONO, fontSize: 34, fontWeight: 800, color: C.amber, padding: "0 1px" }}>{ch}</span>
        )
      )}
    </div>
  );
}

/* ---------- small UI atoms ---------- */
const Card = ({ children, style }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: 18, ...style }}>{children}</div>
);
const Label = ({ children, style }) => (
  <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, ...style }}>{children}</div>
);
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
const inputStyle = {
  width: "100%", boxSizing: "border-box", fontFamily: SANS, fontSize: 16, color: C.ink,
  background: C.bg, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", outline: "none",
};

/* ================================================================= */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [settings, setSettings] = useState({ region: "AU", ...REGIONS.AU, marginal: 30 });
  const [ledger, setLedger] = useState({ shifts: [], expenses: [], active: null });
  const [fyYear, setFyYear] = useState(null);
  const [modal, setModal] = useState(null); // {type:'shift'|'expense'|'start'|'settings', ...}
  const [toast, setToast] = useState(null); // {msg, undo}
  const [now, setNow] = useState(Date.now());

  /* quick tour — shown once on first launch, replayable from the guide */
  const [touring, setTouring] = useState(false);
  const tourSteps = useMemo(() => TOUR.filter((t) => !t.cloudOnly || CLOUD_ON), []);
  const startTour = () => { setTab("home"); setModal(null); setTimeout(() => setTouring(true), 60); };
  const endTour = () => { setTouring(false); store.set("odo_tour_done", "1"); };

  /* account + subscription + sync */
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sync, setSync] = useState(CLOUD_ON ? "signed-out" : "off"); // off | signed-out | syncing | synced | offline | error
  const isPro = !CLOUD_ON || cloud.isProProfile(profile); // local mode = everything unlocked
  const ledgerRef = useRef(ledger), settingsRef = useRef(settings), userRef = useRef(null);
  const updatedAtRef = useRef(0), pushTimer = useRef(null), pendingPush = useRef(false), linkedUid = useRef(null);
  useEffect(() => { ledgerRef.current = ledger; }, [ledger]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { userRef.current = user; }, [user]);

  const pushNow = async () => {
    const u = userRef.current; if (!u) return;
    clearTimeout(pushTimer.current);
    if (!navigator.onLine) { pendingPush.current = true; setSync("offline"); return; }
    setSync("syncing");
    try {
      await cloud.pushLedger(u.id, { settings: settingsRef.current, ledger: ledgerRef.current }, updatedAtRef.current);
      pendingPush.current = false; setSync("synced");
    } catch (e) { pendingPush.current = true; setSync("error"); }
  };
  const touch = () => {
    updatedAtRef.current = Date.now();
    store.set("odo_updated_at", String(updatedAtRef.current));
    if (userRef.current) { pendingPush.current = true; clearTimeout(pushTimer.current); pushTimer.current = setTimeout(pushNow, 1500); }
  };

  const refreshProfile = async (u = userRef.current) => {
    if (!u) return null;
    try { const p = await cloud.fetchProfile(u.id); setProfile(p); store.set("odo_profile_cache", JSON.stringify(p || null)); return p; }
    catch (e) { return null; }
  };

  /* First sign-in on this device merges; after that, newest copy wins. */
  const linkAccount = async (u) => {
    setUser(u); userRef.current = u;
    if (linkedUid.current === u.id) return;
    linkedUid.current = u.id;
    refreshProfile(u);
    setSync("syncing");
    try {
      const remote = await cloud.pullLedger(u.id);
      const lastUid = await store.get("odo_last_uid");
      const localUpdated = updatedAtRef.current;
      const rData = remote?.data;
      if (!rData) {
        await pushNow();
      } else if (!lastUid) {
        const merged = cloud.mergeLedgers(ledgerRef.current, rData.ledger);
        const hasLocal = ledgerRef.current.shifts.length + ledgerRef.current.expenses.length > 0;
        const sv = hasLocal ? settingsRef.current : (rData.settings || settingsRef.current);
        applyData(sv, merged); touch(); await pushNow();
      } else if (lastUid !== u.id || (remote.client_updated_at || 0) > localUpdated) {
        applyData(rData.settings || settingsRef.current, rData.ledger || { shifts: [], expenses: [], active: null });
        updatedAtRef.current = remote.client_updated_at || Date.now();
        store.set("odo_updated_at", String(updatedAtRef.current));
        setSync("synced");
      } else if (localUpdated > (remote.client_updated_at || 0)) {
        await pushNow();
      } else setSync("synced");
      store.set("odo_last_uid", u.id);
    } catch (e) { setSync(navigator.onLine ? "error" : "offline"); }
  };
  const applyData = (sv, lv) => {
    setSettings(sv); settingsRef.current = sv; store.set("odo_settings", JSON.stringify(sv));
    setLedger(lv); ledgerRef.current = lv; store.set("odo_ledger", JSON.stringify(lv));
    setFyYear(currentFYStartYear(sv.fyM, sv.fyD));
  };

  const doSignOut = async () => {
    if (pendingPush.current) await pushNow();
    await cloud.signOut();
    linkedUid.current = null; setUser(null); userRef.current = null; setProfile(null);
    applyData({ region: "AU", ...REGIONS.AU, marginal: 30 }, { shifts: [], expenses: [], active: null });
    updatedAtRef.current = 0;
    await Promise.all([store.remove("odo_last_uid"), store.remove("odo_profile_cache"), store.set("odo_updated_at", "0")]);
    setSync("signed-out"); setModal(null); setToast({ msg: "Signed out — your data is safe in your account" });
  };

  /* load */
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const s = await store.get("odo_settings");
      const l = await store.get("odo_ledger");
      const ua = await store.get("odo_updated_at");
      const pc = await store.get("odo_profile_cache");
      let sv = settings;
      if (s) { try { sv = JSON.parse(s); setSettings(sv); settingsRef.current = sv; } catch (e) {} }
      if (l) { try { const lv = JSON.parse(l); setLedger(lv); ledgerRef.current = lv; } catch (e) {} }
      updatedAtRef.current = Number(ua) || 0;
      if (pc) { try { setProfile(JSON.parse(pc)); } catch (e) {} } // works offline
      setFyYear(currentFYStartYear(sv.fyM, sv.fyD));
      setLoaded(true);
      if (!(await store.get("odo_tour_done")) && !window.location.search.includes("checkout=")) setTimeout(() => setTouring(true), 500);
      if (CLOUD_ON) {
        unsub = cloud.onAuthChange((event, u) => {
          if (event === "PASSWORD_RECOVERY") { if (u) linkAccount(u); setModal({ type: "newpass" }); return; }
          if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && u) linkAccount(u);
          if (event === "INITIAL_SESSION" && !u) { setSync("signed-out"); setProfile(null); }
        });
      }
    })();
    return () => unsub();
  }, []);

  /* back online → push anything waiting; coming back to the app → recheck subscription */
  useEffect(() => {
    if (!CLOUD_ON) return;
    const onOnline = () => { if (pendingPush.current) pushNow(); };
    const onVisible = () => { if (document.visibilityState === "visible" && userRef.current) refreshProfile(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  /* returning from Stripe checkout (?checkout=success) → wait for the webhook to mark them Pro */
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    window.history.replaceState({}, "", window.location.pathname);
    setToast({ msg: "Payment received — activating Pro…" });
    let tries = 0;
    const id = setInterval(async () => {
      tries++;
      const p = await refreshProfile(user);
      if (cloud.isProProfile(p)) { clearInterval(id); setToast({ msg: "You're on Odo Pro 🎉" }); }
      else if (tries >= 10) { clearInterval(id); setToast({ msg: "Still processing — pull down or reopen in a minute" }); }
    }, 3000);
    return () => clearInterval(id);
  }, [user]);

  const saveSettings = (sv) => { setSettings(sv); settingsRef.current = sv; store.set("odo_settings", JSON.stringify(sv)); touch(); };
  const saveLedger = (fn) => {
    setLedger((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; store.set("odo_ledger", JSON.stringify(next)); ledgerRef.current = next; return next; });
    touch();
  };

  /* live clock while a shift is active */
  useEffect(() => {
    if (!ledger.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ledger.active]);

  /* toast auto-clear */
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 4500); return () => clearTimeout(id); }, [toast]);

  const s = settings;
  const sym = s.symbol, unit = s.unit;
  const money = (n) => sym + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const distTxt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " " + unit;

  const fy = useMemo(() => fyBounds(fyYear ?? currentFYStartYear(s.fyM, s.fyD), s.fyM, s.fyD), [fyYear, s.fyM, s.fyD]);
  const inFY = (iso) => { const d = new Date(iso + "T12:00:00"); return d >= fy.start && d <= fy.end; };

  const shiftsFY = useMemo(() => ledger.shifts.filter((x) => inFY(x.date)).sort((a, b) => b.date.localeCompare(a.date)), [ledger.shifts, fy]);
  const expFY = useMemo(() => ledger.expenses.filter((x) => inFY(x.date)).sort((a, b) => b.date.localeCompare(a.date)), [ledger.expenses, fy]);

  const totalDist = shiftsFY.reduce((a, x) => a + num(x.km), 0);
  const cappedDist = s.cap > 0 ? Math.min(totalDist, s.cap) : totalDist;
  const rate = rateFor(s, fy.start.getFullYear());
  const distDeduction = cappedDist * rate;
  const runningCosts = expFY.filter((e) => catOf(e.category).running).reduce((a, e) => a + num(e.amount) * num(e.pct) / 100, 0);
  const expenseDeduction = expFY.reduce((a, e) => a + num(e.amount) * num(e.pct) / 100, 0);
  const totalDeductions = distDeduction + expenseDeduction;
  const income = shiftsFY.reduce((a, x) => a + num(x.earnings), 0);
  const net = income - totalDeductions;
  const taxBack = totalDeductions * num(s.marginal) / 100;

  const months = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => { const dt = new Date(fy.start); dt.setMonth(dt.getMonth() + i); return { label: dt.toLocaleString(undefined, { month: "short" })[0], total: 0 }; });
    shiftsFY.forEach((x) => { const d = new Date(x.date + "T12:00:00"); let idx = (d.getMonth() - fy.start.getMonth() + 12) % 12; arr[idx].total += num(x.earnings); });
    return arr;
  }, [shiftsFY, fy]);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  const elapsed = ledger.active ? (now - ledger.active.startTime) / 3600000 : 0;
  const elapsedTxt = (() => { const h = Math.floor(elapsed); const m = Math.floor((elapsed - h) * 60); return `${h}h ${String(m).padStart(2, "0")}m`; })();

  /* actions */
  const removeWithUndo = (kind, id) => {
    saveLedger((prev) => {
      const list = prev[kind];
      const idx = list.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const item = list[idx];
      const next = { ...prev, [kind]: list.filter((x) => x.id !== id) };
      setToast({ msg: "Deleted", undo: () => saveLedger((p) => ({ ...p, [kind]: [...p[kind].slice(0, idx), item, ...p[kind].slice(idx)] })) });
      return next;
    });
  };

  if (!loaded) {
    return <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, color: C.inkSoft }}>Loading Odo…</div>;
  }

  const tabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "shifts", label: "Shifts", icon: Car },
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "export", label: "Export", icon: Download },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center" }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        .odo-input:focus { border-color: ${C.amber} !important; box-shadow: 0 0 0 3px ${C.amberSoft}; }
        .odo-scroll::-webkit-scrollbar { width: 0; }
        .odo-press:active { transform: scale(.97); }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.35 } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 448, background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 6px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <span style={{ fontFamily: SANS, fontSize: 26, fontWeight: 800, color: C.ink, letterSpacing: -0.5 }}>Od</span>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.amber, display: "inline-block", position: "relative", top: 2, boxShadow: `0 0 0 4px ${C.amberSoft}` }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {CLOUD_ON && !isPro && (
              <button onClick={() => setModal({ type: "paywall" })} className="odo-press"
                style={{ background: C.ink, color: C.amber, border: "none", borderRadius: 12, height: 40, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                <Crown size={15} /> Go Pro
              </button>
            )}
            {CLOUD_ON && isPro && (
              <span style={{ background: C.amberSoft, color: C.ink, borderRadius: 999, padding: "5px 10px", fontFamily: SANS, fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>PRO</span>
            )}
            {CLOUD_ON && (
              <button onClick={() => setModal({ type: "account" })} className="odo-press" aria-label="Account" data-tour="account" style={iconBtn}>
                <User size={18} color={C.ink} />
                <span style={{ position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: "50%", border: `2px solid ${C.surface}`, background: { synced: C.go, syncing: C.amber, offline: C.inkSoft, error: C.alert }[sync] || C.line }} />
              </button>
            )}
            <button onClick={() => setModal({ type: "settings" })} className="odo-press" aria-label="Settings" data-tour="settings" style={iconBtn}>
              <Settings size={18} color={C.ink} />
            </button>
          </div>
        </div>

        <div className="odo-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 18px 110px" }}>
          {tab === "home" && (
            <Home_ {...{ fy, fyYear, setFyYear, s, income, net, totalDeductions, distDeduction, expenseDeduction, totalDist, cappedDist, taxBack, sym, unit, money, distTxt, ledger, elapsedTxt, months, maxMonth, setModal, saveLedger, setNow }} />
          )}
          {tab === "shifts" && (
            <ListView title="Shifts" empty="No shifts logged this period. Start a shift from the Home tab, or add one manually."
              onAdd={() => setModal({ type: "shift", form: newShiftForm() })} addLabel="Add shift" items={shiftsFY} money={money}
              render={(x) => (
                <Row key={x.id} onDelete={() => removeWithUndo("shifts", x.id)}
                  icon={<Car size={18} color={C.ink} />}
                  title={x.platform || "Shift"} sub={`${x.date} · ${distTxt(x.km)}${x.hours ? " · " + x.hours + "h" : ""}`}
                  right={money(x.earnings)} rightColor={C.ink} />
              )} />
          )}
          {tab === "expenses" && (
            <ListView title="Expenses" empty="No expenses yet. Log fuel, phone bills, gear and more so they count at tax time."
              onAdd={() => setModal({ type: "expense", form: newExpenseForm() })} addLabel="Add expense" items={expFY} money={money}
              render={(x) => { const cat = catOf(x.category); const I = cat.icon; return (
                <Row key={x.id} onDelete={() => removeWithUndo("expenses", x.id)}
                  icon={<I size={18} color={C.ink} />}
                  title={cat.label} sub={`${x.date} · ${x.pct}% business${x.note ? " · " + x.note : ""}`}
                  right={money(x.amount)} rightColor={C.amber} />
              ); }} />
          )}
          {tab === "export" && (
            <ExportView {...{ rate, fy, s, shiftsFY, expFY, income, totalDeductions, distDeduction, expenseDeduction, totalDist, cappedDist, net, taxBack, runningCosts, sym, unit, money, distTxt, setToast, isPro, onUpgrade: () => setModal({ type: "paywall" }) }} />
          )}
        </div>

        {/* bottom nav */}
        <div style={{ position: "sticky", bottom: 0, background: "rgba(238,241,246,.9)", backdropFilter: "blur(8px)", borderTop: `1px solid ${C.line}`, display: "flex", padding: "8px 8px 14px" }}>
          {tabs.map((t) => { const I = t.icon; const on = tab === t.id; return (
            <button key={t.id} onClick={() => setTab(t.id)} data-tour={`nav-${t.id}`}
              style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0" }}>
              <div style={{ background: on ? C.ink : "transparent", borderRadius: 12, padding: "6px 16px", transition: "background .15s" }}>
                <I size={20} color={on ? C.amber : C.inkSoft} />
              </div>
              <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: on ? C.ink : C.inkSoft }}>{t.label}</span>
            </button>
          ); })}
        </div>

        {/* toast */}
        {toast && (
          <div role="status" style={{ position: "fixed", top: "calc(14px + env(safe-area-inset-top))", left: "50%", maxWidth: "calc(100% - 32px)", transform: "translateX(-50%)", background: C.ink, color: C.white, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, fontFamily: SANS, fontSize: 14, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
            <span>{toast.msg}</span>
            {toast.undo && <button onClick={() => { toast.undo(); setToast(null); }} style={{ background: "none", border: "none", color: C.amber, fontWeight: 800, fontFamily: SANS, fontSize: 14, cursor: "pointer" }}>Undo</button>}
          </div>
        )}

        {/* modals */}
        {modal?.type === "start" && <StartSheet {...{ s, setModal, saveLedger }} />}
        {modal?.type === "shift" && <ShiftSheet {...{ s, unit, sym, modal, setModal, saveLedger }} rate={rateFor(s, currentFYStartYear(s.fyM, s.fyD))} />}
        {modal?.type === "expense" && <ExpenseSheet {...{ s, sym, modal, setModal, saveLedger }} />}
        {modal?.type === "settings" && <SettingsSheet {...{ settings, saveSettings, setModal, setFyYear, saveLedger, setToast, ledger, user }} />}
        {modal?.type === "account" && <AccountSheet {...{ user, profile, isPro, sync, setModal, setToast, pushNow, refreshProfile, doSignOut, linkAccount, settings, ledger }} />}
        {modal?.type === "paywall" && <PaywallSheet {...{ user, setModal }} />}
        {modal?.type === "support" && <SupportSheet {...{ user, profile, settings, ledger, setModal, setToast }} />}
        {modal?.type === "newpass" && <NewPasswordSheet {...{ setModal, setToast }} />}
        {modal?.type === "guide" && <GuideSheet setModal={setModal} startTour={startTour} initial={modal.section} />}
        {touring && <Tour steps={tourSteps} onClose={endTour} />}
      </div>
    </div>
  );
}

/* ---------- HOME ---------- */
function Home_(props) {
  const { fy, fyYear, setFyYear, s, income, net, totalDeductions, distDeduction, expenseDeduction, totalDist, cappedDist, taxBack, sym, unit, money, distTxt, ledger, elapsedTxt, months, maxMonth, setModal, saveLedger, setNow } = props;
  const active = ledger.active;

  return (
    <div>
      {/* FY switcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "8px 0 14px" }}>
        <button onClick={() => setFyYear((fyYear ?? 0) - 1)} className="odo-press" style={navBtn}><ChevronLeft size={18} color={C.ink} /></button>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 15, color: C.ink, minWidth: 96, textAlign: "center" }}>{fy.label}</div>
        <button onClick={() => setFyYear((fyYear ?? 0) + 1)} className="odo-press" style={navBtn}><ChevronRight size={18} color={C.ink} /></button>
      </div>

      {/* hero — the signature odometer */}
      <div data-tour="hero" style={{ background: C.night, borderRadius: 24, padding: 22, position: "relative", boxShadow: "0 14px 30px rgba(20,26,46,.28)" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden", pointerEvents: "none" }}><div style={{ position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,163,0,.28), transparent 70%)" }} /></div>
        <Label style={{ color: C.amber, marginBottom: 14, position: "relative" }}>Estimated tax back <Tip dark text="Your total deductions × your marginal tax rate (set in Settings). It's roughly how much less tax you'll pay thanks to your work claims, not your exact refund." /></Label>
        <Odometer value={taxBack} symbol={sym} />
        <div style={{ fontFamily: SANS, fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 14, lineHeight: 1.5 }}>
          {money(totalDeductions)} in deductions × {s.marginal}% marginal rate. An estimate — your real refund depends on your full return.
        </div>
      </div>

      {/* quick stats */}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Stat label="Income" value={money(income)} color={C.ink} />
        <Stat label="Deductions" value={money(totalDeductions)} color={C.amber} />
        <Stat label="Net" value={money(net)} color={net >= 0 ? C.ink : C.alert} />
      </div>

      {/* ignition / shift control */}
      <div style={{ marginTop: 12 }} data-tour="start">
        {active ? (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.go, animation: "pulse 1.6s infinite" }} />
                <span style={{ fontFamily: SANS, fontWeight: 800, color: C.ink, fontSize: 15 }}>On shift · {active.platform}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: C.ink, marginTop: 4 }}>{elapsedTxt}</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.inkSoft }}>Start odo {active.startOdo || "—"}</div>
            </div>
            <button className="odo-press" onClick={() => setModal({ type: "shift", form: { ...newShiftForm(), platform: active.platform, method: "odo", startOdo: String(active.startOdo || ""), hours: elapsedHoursStr(active.startTime) }, fromActive: true })}
              style={{ background: C.go, color: C.white, border: "none", borderRadius: 14, padding: "14px 18px", fontFamily: SANS, fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <Square size={16} fill={C.white} /> End shift
            </button>
          </div>
        ) : (
          <button className="odo-press" onClick={() => { setNow(Date.now()); setModal({ type: "start" }); }}
            style={{ width: "100%", background: C.amber, color: C.night, border: "none", borderRadius: 20, padding: "18px", fontFamily: SANS, fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", boxShadow: "0 8px 20px rgba(245,163,0,.35)" }}>
            <Play size={20} fill={C.night} /> Start shift
          </button>
        )}
      </div>

      {/* breakdown */}
      <div data-tour="breakdown"><Card style={{ marginTop: 12 }}>
        <Label style={{ marginBottom: 12 }}>What's driving your claim <Tip text={`Distance = work ${unit} × the ATO cents-per-km rate (capped at ${s.cap ? s.cap.toLocaleString() + " " + unit : "no limit"}). Expenses = the business-use share of everything in the Expenses tab.`} /></Label>
        <BreakRow icon={<Car size={16} color={C.amber} />} label={`Distance · ${distTxt(totalDist)}${s.cap > 0 && totalDist > s.cap ? ` (capped at ${s.cap})` : ""}`} value={money(distDeduction)} />
        <BreakRow icon={<Receipt size={16} color={C.amber} />} label="Logged expenses" value={money(expenseDeduction)} />
        <div style={{ height: 1, background: C.line, margin: "6px 0" }} />
        <BreakRow bold icon={<TrendingUp size={16} color={C.ink} />} label="Total deductions" value={money(totalDeductions)} />
      </Card></div>

      {/* earnings sparkline */}
      <Card style={{ marginTop: 12 }}>
        <Label style={{ marginBottom: 14 }}>Earnings by month</Label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
          {months.map((m, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: "100%", height: `${(m.total / maxMonth) * 74}px`, minHeight: m.total > 0 ? 4 : 0, background: m.total > 0 ? C.amber : "transparent", borderRadius: 4, transition: "height .4s" }} />
              <span style={{ fontFamily: SANS, fontSize: 9, color: C.inkSoft }}>{m.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const iconBtn = { position: "relative", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, width: 40, height: 40, display: "grid", placeItems: "center", cursor: "pointer" };
const navBtn = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer" };
function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 10px" }}>
      <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color, marginTop: 4, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}
function BreakRow({ icon, label, value, bold }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{icon}<span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: bold ? 800 : 500, color: C.ink }}>{label}</span></div>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: bold ? C.ink : C.inkSoft }}>{value}</span>
    </div>
  );
}

/* ---------- LIST + ROW ---------- */
function ListView({ title, items, render, onAdd, addLabel, empty, money }) {
  const total = items.reduce((a, x) => a + num(x.earnings ?? x.amount), 0);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 12px" }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 800, color: C.ink }}>{title}</div>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.inkSoft }}>{items.length} entries · {money(total)}</div>
        </div>
        <button className="odo-press" onClick={onAdd} style={{ background: C.ink, color: C.amber, border: "none", borderRadius: 14, padding: "11px 14px", fontFamily: SANS, fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <Plus size={16} /> {addLabel}
        </button>
      </div>
      {items.length === 0 ? (
        <Card style={{ padding: 26, textAlign: "center" }}>
          <div style={{ fontFamily: SANS, fontSize: 14, color: C.inkSoft, lineHeight: 1.6 }}>{empty}</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{items.map(render)}</div>
      )}
    </div>
  );
}
function Row({ icon, title, sub, right, rightColor, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: C.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: C.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: rightColor }}>{right}</div>
      <button onClick={() => (confirm ? onDelete() : setConfirm(true))} onMouseLeave={() => setConfirm(false)}
        style={{ background: confirm ? C.alert : "transparent", border: "none", borderRadius: 9, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
        {confirm ? <Check size={16} color={C.white} /> : <Trash2 size={16} color={C.inkSoft} />}
      </button>
    </div>
  );
}

/* ---------- SHEETS (modals) ---------- */
function Sheet({ title, onClose, children, footer }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,26,46,.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="odo-scroll" style={{ width: "100%", maxWidth: 448, background: C.bg, borderRadius: "24px 24px 0 0", padding: "8px 18px 24px", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 4, margin: "8px auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: SANS, fontSize: 19, fontWeight: 800, color: C.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer" }}><X size={18} color={C.ink} /></button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}
const primaryBtn = { width: "100%", background: C.amber, color: C.night, border: "none", borderRadius: 14, padding: "15px", fontFamily: SANS, fontWeight: 800, fontSize: 16, cursor: "pointer", marginTop: 4 };

const newShiftForm = () => ({ date: todayISO(), platform: "Uber Eats", method: "odo", startOdo: "", endOdo: "", km: "", earnings: "", hours: "", note: "" });
const newExpenseForm = () => ({ date: todayISO(), category: "fuel", amount: "", pct: "100", note: "" });
const elapsedHoursStr = (start) => (Math.round(((Date.now() - start) / 3600000) * 10) / 10).toString();

function StartSheet({ s, setModal, saveLedger }) {
  const [platform, setPlatform] = useState("Uber Eats");
  const [startOdo, setStartOdo] = useState("");
  const begin = () => { saveLedger((p) => ({ ...p, active: { startTime: Date.now(), startOdo: startOdo, platform } })); setModal(null); };
  return (
    <Sheet title="Start shift" onClose={() => setModal(null)}
      footer={<button className="odo-press" style={{ ...primaryBtn, marginTop: 8 }} onClick={begin}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Play size={18} fill={C.night} /> Clock on</span></button>}>
      <Field label="Platform">
        <select className="odo-input" style={inputStyle} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>
      <Field label={`Starting odometer (${s.unit}) — optional`}>
        <input className="odo-input" style={inputStyle} inputMode="decimal" placeholder="e.g. 84210" value={startOdo} onChange={(e) => setStartOdo(e.target.value)} />
      </Field>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>Odo keeps counting your time. When you clock off you'll pop in the end reading and your earnings.</div>
    </Sheet>
  );
}

function ShiftSheet({ s, unit, sym, modal, setModal, saveLedger, rate }) {
  const [f, setF] = useState(modal.form);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const computedKm = f.method === "odo" ? Math.max(0, num(f.endOdo) - num(f.startOdo)) : num(f.km);
  const save = () => {
    const rec = { id: uid(), date: f.date, platform: f.platform, km: computedKm, earnings: num(f.earnings), hours: f.hours, note: f.note, startOdo: f.startOdo, endOdo: f.endOdo };
    saveLedger((p) => ({ ...p, shifts: [...p.shifts, rec], active: modal.fromActive ? null : p.active }));
    setModal(null);
  };
  return (
    <Sheet title={modal.fromActive ? "Clock off" : "Add shift"} onClose={() => setModal(null)}
      footer={<button className="odo-press" style={primaryBtn} onClick={save}>Save shift · {sym}{(num(f.earnings)).toLocaleString()}</button>}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Date"><input className="odo-input" style={inputStyle} type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Platform">
          <select className="odo-input" style={inputStyle} value={f.platform} onChange={(e) => set("platform", e.target.value)}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
        </Field></div>
      </div>

      <Field label={<>Distance ({unit}) <Tip text="Only count kilometres driven for work. The trip from home to your first job (and home at the end) may be private — check with the ATO or your tax agent if unsure." /></>}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["odo", "direct"].map((m) => (
            <button key={m} onClick={() => set("method", m)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${f.method === m ? C.amber : C.line}`, background: f.method === m ? C.amberSoft : C.surface, fontFamily: SANS, fontWeight: 700, fontSize: 13, color: C.ink, cursor: "pointer" }}>
              {m === "odo" ? "Odometer" : `Enter ${unit}`}
            </button>
          ))}
        </div>
        {f.method === "odo" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="odo-input" style={inputStyle} inputMode="decimal" placeholder="Start" value={f.startOdo} onChange={(e) => set("startOdo", e.target.value)} />
            <span style={{ color: C.inkSoft }}>→</span>
            <input className="odo-input" style={inputStyle} inputMode="decimal" placeholder="End" value={f.endOdo} onChange={(e) => set("endOdo", e.target.value)} />
          </div>
        ) : (
          <input className="odo-input" style={inputStyle} inputMode="decimal" placeholder={`Distance in ${unit}`} value={f.km} onChange={(e) => set("km", e.target.value)} />
        )}
        <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.amber, fontWeight: 700, marginTop: 6 }}>= {computedKm.toLocaleString()} {unit} · claim ≈ {sym}{(computedKm * rate).toFixed(2)}</div>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Earnings"><input className="odo-input" style={inputStyle} inputMode="decimal" placeholder={sym + "0"} value={f.earnings} onChange={(e) => set("earnings", e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Hours"><input className="odo-input" style={inputStyle} inputMode="decimal" placeholder="e.g. 4.5" value={f.hours} onChange={(e) => set("hours", e.target.value)} /></Field></div>
      </div>
      <Field label="Note (optional)"><input className="odo-input" style={inputStyle} placeholder="Area, conditions…" value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
    </Sheet>
  );
}

function ExpenseSheet({ s, sym, modal, setModal, saveLedger }) {
  const [f, setF] = useState(modal.form);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const pickCat = (id) => setF((p) => ({ ...p, category: id, pct: String(catOf(id).pct) }));
  const deductible = num(f.amount) * num(f.pct) / 100;
  const save = () => { saveLedger((p) => ({ ...p, expenses: [...p.expenses, { id: uid(), date: f.date, category: f.category, amount: num(f.amount), pct: num(f.pct), note: f.note }] })); setModal(null); };
  return (
    <Sheet title="Add expense" onClose={() => setModal(null)}
      footer={<button className="odo-press" style={primaryBtn} onClick={save}>Save · {sym}{deductible.toFixed(2)} deductible</button>}>
      <Field label="Category">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {CATS.map((c) => { const I = c.icon; const on = f.category === c.id; return (
            <button key={c.id} onClick={() => pickCat(c.id)} style={{ padding: "12px 4px", borderRadius: 14, border: `1.5px solid ${on ? C.amber : C.line}`, background: on ? C.amberSoft : C.surface, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <I size={20} color={on ? C.ink : C.inkSoft} />
              <span style={{ fontFamily: SANS, fontSize: 9.5, fontWeight: 700, color: C.ink, textAlign: "center", lineHeight: 1.1 }}>{c.label}</span>
            </button>
          ); })}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Amount"><input className="odo-input" style={inputStyle} inputMode="decimal" placeholder={sym + "0"} value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Date"><input className="odo-input" style={inputStyle} type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field></div>
      </div>
      <Field label={<>Business use — {f.pct}% <Tip text="The share of this cost that's for work. Use your phone 70% for deliveries? Set 70%. Odo only counts that share as a deduction. Keep receipts for 5 years." /></>}>
        <input type="range" min="0" max="100" step="5" value={f.pct} onChange={(e) => set("pct", e.target.value)} style={{ width: "100%", accentColor: C.amber }} />
      </Field>
      <Field label="Note (optional)"><input className="odo-input" style={inputStyle} placeholder="Vendor, what it was for…" value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
    </Sheet>
  );
}

function SettingsSheet({ settings, saveSettings, setModal, setFyYear, saveLedger, setToast, ledger, user }) {
  const [f, setF] = useState(settings);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const pickRegion = (r) => setF((p) => ({ ...p, region: r, ...REGIONS[r] }));
  const save = () => { saveSettings(f); setFyYear(currentFYStartYear(f.fyM, f.fyD)); setModal(null); };
  const clearAll = () => {
    const snapshot = ledger;
    saveLedger({ shifts: [], expenses: [], active: null });
    setModal(null);
    setToast({ msg: "All entries cleared", undo: () => saveLedger(snapshot) });
  };
  return (
    <Sheet title="Settings" onClose={() => setModal(null)} footer={
      <>
        <button className="odo-press" style={primaryBtn} onClick={save}>Save settings</button>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft, textAlign: "center", marginTop: 12 }}>Odo v{APP_VERSION}{CLOUD_ON ? "" : " · local mode"} · <a href="privacy.html" target="_blank" rel="noopener" style={{ color: C.inkSoft }}>Privacy policy</a></div>
      </>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        <MenuRow icon={<BookOpen size={18} color={C.ink} />} label="How to use Odo" sub="Step-by-step guide & quick tour" onClick={() => setModal({ type: "guide" })} />
        <MenuRow icon={<LifeBuoy size={18} color={C.ink} />} label="Help & support" sub="Report a problem or ask a question" onClick={() => setModal({ type: "support" })} />
        {CLOUD_ON && <MenuRow icon={<User size={18} color={C.ink} />} label="Account & subscription" sub={user ? user.email : "Sign in to back up your data"} onClick={() => setModal({ type: "account" })} />}
      </div>
      <Field label="Region (sets sensible defaults)">
        <select className="odo-input" style={inputStyle} value={f.region} onChange={(e) => pickRegion(e.target.value)}>
          {Object.entries(REGIONS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
        </select>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Currency"><input className="odo-input" style={inputStyle} value={f.symbol} onChange={(e) => set("symbol", e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Distance unit">
          <select className="odo-input" style={inputStyle} value={f.unit} onChange={(e) => set("unit", e.target.value)}><option value="km">km</option><option value="mi">mi</option></select>
        </Field></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label={<>Rate per {f.unit} <Tip text={`The amount you can claim for each work ${f.unit}. In Australia this is the ATO "cents per km" rate, which already covers fuel, rego, insurance, servicing and depreciation.`} /></>}>
          {f.region === "AU" && f.autoRate !== false
            ? <div style={{ ...inputStyle, color: C.inkSoft }}>Auto · ATO</div>
            : <input className="odo-input" style={inputStyle} inputMode="decimal" value={f.rate} onChange={(e) => set("rate", e.target.value)} />}
        </Field></div>
        <div style={{ flex: 1 }}><Field label={<>Distance cap <Tip text="The most distance you can claim per year with this method. The ATO caps cents-per-km claims at 5,000 km per car. Drive more? A logbook may give a bigger claim — ask your tax agent. 0 = no cap." /></>}><input className="odo-input" style={inputStyle} inputMode="decimal" value={f.cap} onChange={(e) => set("cap", num(e.target.value))} /></Field></div>
      </div>
      {f.region === "AU" && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: SANS, fontSize: 12.5, color: C.ink, margin: "-4px 0 14px", lineHeight: 1.45, cursor: "pointer" }}>
          <input type="checkbox" checked={f.autoRate !== false} onChange={(e) => set("autoRate", e.target.checked)} style={{ width: 18, height: 18, accentColor: C.amber, flexShrink: 0 }} />
          <span>Use the ATO rate for each financial year automatically ({Object.entries(AU_RATES).slice(-3).map(([y, r]) => `FY${String(+y).slice(2)}–${String(+y + 1).slice(2)}: ${Math.round(r * 100)}c`).join(" · ")})</span>
        </label>
      )}
      <Field label={<>Your marginal tax rate — {f.marginal}% <Tip text="The tax rate on your last dollar of income, across ALL your work (not just deliveries). Odo multiplies your deductions by this to estimate your tax back. Not sure? Pick the bracket for your expected total income this year." /></>}>
        <input type="range" min="0" max="50" step="1" value={f.marginal} onChange={(e) => set("marginal", num(e.target.value))} style={{ width: "100%", accentColor: C.amber }} />
      </Field>
      {f.region === "AU" && (
        <div style={{ marginTop: -4, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
            {AU_BRACKETS.map((r) => (
              <button key={r} onClick={() => set("marginal", r)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1.5px solid ${f.marginal === r ? C.amber : C.line}`, background: f.marginal === r ? C.amberSoft : C.surface, fontFamily: SANS, fontWeight: 700, fontSize: 13, color: C.ink, cursor: "pointer" }}>{r}%</button>
            ))}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>ATO resident brackets from 1 July 2026: 15% ($18.2k–45k), 30% ($45k–135k), 37% ($135k–190k), 45% ($190k+), plus ~2% Medicare levy.</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="FY start month (1–12)"><input className="odo-input" style={inputStyle} inputMode="numeric" value={f.fyM} onChange={(e) => set("fyM", num(e.target.value))} /></Field></div>
        <div style={{ flex: 1 }}><Field label="FY start day"><input className="odo-input" style={inputStyle} inputMode="numeric" value={f.fyD} onChange={(e) => set("fyD", num(e.target.value))} /></Field></div>
      </div>

      <div style={{ background: C.amberSoft, borderRadius: 14, padding: 12, display: "flex", gap: 10, marginBottom: 16 }}>
        <Info size={18} color={C.ink} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink, lineHeight: 1.5 }}>Rates and dates here are indicative starting points, not tax advice. Confirm the current figures with your tax authority or accountant.</div>
      </div>

      <button onClick={clearAll} style={{ width: "100%", background: "transparent", color: C.alert, border: `1.5px solid ${C.alert}`, borderRadius: 14, padding: "12px", fontFamily: SANS, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Clear all entries</button>
    </Sheet>
  );
}

/* ---------- EXPORT ---------- */
function ExportView(props) {
  const { rate, fy, s, shiftsFY, expFY, income, totalDeductions, distDeduction, expenseDeduction, totalDist, cappedDist, net, taxBack, runningCosts, sym, unit, money, distTxt, setToast, isPro, onUpgrade } = props;

  const csvCell = (v) => { const str = String(v ?? ""); return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str; };
  const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

  const shiftRows = [["Date", "Platform", "Start odo", "End odo", `Distance (${unit})`, "Earnings", "Hours", "Note"],
    ...shiftsFY.slice().sort((a, b) => a.date.localeCompare(b.date)).map((x) => [x.date, x.platform, x.startOdo, x.endOdo, x.km, x.earnings, x.hours, x.note])];
  const expRows = [["Date", "Category", "Amount", "Business %", "Deductible", "Note"],
    ...expFY.slice().sort((a, b) => a.date.localeCompare(b.date)).map((x) => [x.date, catOf(x.category).label, x.amount, x.pct, (num(x.amount) * num(x.pct) / 100).toFixed(2), x.note])];

  const summary =
`ODO — TAX SUMMARY
${fy.label}  (${fy.start.toISOString().slice(0, 10)} to ${fy.end.toISOString().slice(0, 10)})
Region: ${REGIONS[s.region]?.name || s.region}

INCOME
  Total earnings ................. ${money(income)}   (${shiftsFY.length} shifts)

DEDUCTIONS
  Distance ....................... ${distTxt(totalDist)}${s.cap > 0 && totalDist > s.cap ? ` (capped at ${s.cap} ${unit})` : ""}
    at ${sym}${rate.toFixed(2)}/${unit} ............ ${money(distDeduction)}
  Logged expenses ................ ${money(expenseDeduction)}
  ------------------------------------------
  TOTAL DEDUCTIONS ............... ${money(totalDeductions)}

Net business income (pre-tax) .... ${money(net)}
Est. tax saving @ ${s.marginal}% ......... ${money(taxBack)}
${s.region === "AU" ? `
GST: Food delivery isn't "taxi travel", so you only register for GST once
your turnover reaches $75,000/yr. Figures above exclude GST.
` : ""}
NOTE: Estimates only — not tax advice. Confirm rates and rules with your
tax authority or accountant before lodging.`;

  const download = (name, text, type) => {
    try {
      const blob = new Blob([text], { type: type || "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast({ msg: `${name} downloaded` });
    } catch (e) { setToast({ msg: "Download blocked — copy from the box below" }); }
  };
  const copy = () => { try { navigator.clipboard.writeText(summary); setToast({ msg: "Summary copied" }); } catch (e) { setToast({ msg: "Select the text to copy it" }); } };

  const conflict = distDeduction > 0 && runningCosts > 0;

  return (
    <div>
      <div style={{ margin: "8px 0 12px" }}>
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 800, color: C.ink }}>Export</div>
        <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.inkSoft }}>{fy.label} · ready for your accountant or tax return</div>
      </div>

      <div style={{ background: C.night, borderRadius: 22, padding: 20, marginBottom: 12 }}>
        <Label style={{ color: C.amber, marginBottom: 12 }}>This year at a glance</Label>
        {[["Earnings", money(income)], ["Distance", distTxt(totalDist)], ["Deductions", money(totalDeductions)], ["Est. tax back", money(taxBack)]].map(([k, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
            <span style={{ fontFamily: SANS, fontSize: 13, color: "rgba(255,255,255,.65)" }}>{k}</span>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: i === 3 ? C.amber : C.white }}>{v}</span>
          </div>
        ))}
      </div>

      {conflict && (
        <div style={{ background: C.amberSoft, borderRadius: 14, padding: 12, display: "flex", gap: 10, marginBottom: 12 }}>
          <Info size={18} color={C.ink} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
            You're claiming distance <b>and</b> running costs (fuel, servicing, insurance). Many tax systems make you pick <b>one</b> method — not both. Check which gives the bigger claim.
          </div>
        </div>
      )}

      {isPro ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <ExportBtn label="Download shifts (CSV)" onClick={() => download(`odo-shifts-${fy.label.replace(/\s/g, "")}.csv`, toCSV(shiftRows))} />
            <ExportBtn label="Download expenses (CSV)" onClick={() => download(`odo-expenses-${fy.label.replace(/\s/g, "")}.csv`, toCSV(expRows))} />
            <ExportBtn label="Download summary (TXT)" onClick={() => download(`odo-summary-${fy.label.replace(/\s/g, "")}.txt`, summary, "text/plain")} />
            <ExportBtn label="Copy summary" icon={<Copy size={16} color={C.ink} />} onClick={copy} />
          </div>

          <Label style={{ marginBottom: 8 }}>Preview (copy from here if a download is blocked)</Label>
          <textarea readOnly value={summary} style={{ width: "100%", boxSizing: "border-box", height: 220, fontFamily: MONO, fontSize: 11.5, color: C.ink, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, resize: "vertical" }} />
        </>
      ) : (
        <div>
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: 18, textAlign: "center", marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: C.ink, display: "grid", placeItems: "center", margin: "0 auto 10px" }}><Lock size={20} color={C.amber} /></div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 16, color: C.ink }}>Accountant-ready exports</div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, margin: "6px 0 12px" }}>CSV + tax summary for your return. Part of Odo Pro — and the subscription is itself tax-deductible.</div>
            <button className="odo-press" onClick={onUpgrade} style={{ ...primaryBtn, marginTop: 0 }}>Try Pro free for {CONFIG.TRIAL_DAYS} days</button>
          </div>
          <div aria-hidden style={{ filter: "blur(3px)", opacity: 0.45, pointerEvents: "none", userSelect: "none" }}>
            {["Download shifts (CSV)", "Download expenses (CSV)", "Download summary (TXT)"].map((l) => (
              <div key={l} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "15px 16px", fontFamily: SANS, fontWeight: 700, fontSize: 15, color: C.ink, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>{l}<Lock size={16} color={C.inkSoft} /></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function ExportBtn({ label, onClick, icon }) {
  return (
    <button className="odo-press" onClick={onClick} style={{ width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "15px 16px", fontFamily: SANS, fontWeight: 700, fontSize: 15, color: C.ink, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
      <span>{label}</span>
      {icon || <Download size={16} color={C.ink} />}
    </button>
  );
}

/* =================================================================
   ACCOUNT · PAYWALL · SUPPORT
   ================================================================= */
function MenuRow({ icon, label, sub, onClick, right }) {
  return (
    <button className="odo-press" onClick={onClick} style={{ width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: C.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{label}</div>
        {sub && <div style={{ fontFamily: SANS, fontSize: 12, color: C.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
      {right || <ChevronRight size={18} color={C.inkSoft} />}
    </button>
  );
}
const ErrorNote = ({ children }) => children ? (
  <div style={{ background: "#FDECEC", color: C.alert, borderRadius: 12, padding: "10px 12px", fontFamily: SANS, fontSize: 13, marginBottom: 12, lineHeight: 1.4 }}>{children}</div>
) : null;
const friendly = (e) => {
  const m = e?.message || String(e);
  if (/invalid login/i.test(m)) return "Email or password is incorrect.";
  if (/already registered/i.test(m)) return "That email already has an account — try signing in.";
  if (/password should be/i.test(m)) return "Password needs at least 6 characters.";
  if (/fetch|network/i.test(m)) return "Can't reach the server. Check your connection.";
  return m;
};

function AccountSheet({ user, profile, isPro, sync, setModal, setToast, pushNow, refreshProfile, doSignOut, linkAccount, settings, ledger }) {
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const submit = async () => {
    setErr(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signin") { const u = await cloud.signIn(email.trim(), pw); await linkAccount(u); setToast({ msg: "Signed in · data backed up" }); setModal(null); }
      else if (mode === "signup") {
        const res = await cloud.signUp(email.trim(), pw);
        if (res.session) { await linkAccount(res.user); setToast({ msg: "Account created" }); setModal(null); }
        else setInfo("Check your email to confirm your account, then come back and sign in.");
      } else { await cloud.sendPasswordReset(email.trim()); setInfo("If that email has an account, a reset link is on its way."); }
    } catch (e) { setErr(friendly(e)); }
    setBusy(false);
  };

  if (!user) {
    const title = { signin: "Sign in", signup: "Create account", reset: "Reset password" }[mode];
    return (
      <Sheet title={title} onClose={() => setModal(null)}
        footer={<button className="odo-press" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={submit}>{busy ? "Please wait…" : title}</button>}>
        {mode !== "reset" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[["signin", "Sign in"], ["signup", "New account"]].map(([k, l]) => (
              <button key={k} onClick={() => { setMode(k); setErr(""); setInfo(""); }} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${mode === k ? C.amber : C.line}`, background: mode === k ? C.amberSoft : C.surface, fontFamily: SANS, fontWeight: 700, fontSize: 13.5, color: C.ink, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        )}
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, display: "flex", gap: 10, marginBottom: 16 }}>
          <Cloud size={18} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>Free account: your shifts and expenses are backed up and follow you to a new phone. Anything you've already logged is kept.</div>
        </div>
        <ErrorNote>{err}</ErrorNote>
        {info && <div style={{ background: C.goSoft, color: C.ink, borderRadius: 12, padding: "10px 12px", fontFamily: SANS, fontSize: 13, marginBottom: 12 }}>{info}</div>}
        <Field label="Email"><input className="odo-input" style={inputStyle} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        {mode !== "reset" && <Field label="Password"><input className="odo-input" style={inputStyle} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" /></Field>}
        {mode === "signup" && <div style={{ fontFamily: SANS, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginBottom: 10 }}>By creating an account you agree to our <a href="privacy.html" target="_blank" rel="noopener" style={{ color: C.ink }}>Privacy Policy</a>.</div>}
        <button onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setErr(""); setInfo(""); }} style={{ background: "none", border: "none", color: C.inkSoft, fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 8px", textDecoration: "underline" }}>
          {mode === "reset" ? "Back to sign in" : "Forgot password?"}
        </button>
      </Sheet>
    );
  }

  const syncLabel = { syncing: "Syncing…", synced: "Backed up", offline: "Offline — will sync when you're back online", error: "Sync problem — tap to retry" }[sync] || "—";
  const portal = cloud.portalUrl(user);
  const until = profile?.pro_until ? new Date(profile.pro_until).toLocaleDateString() : null;
  return (
    <Sheet title="Account" onClose={() => setModal(null)}>
      <div style={{ background: C.night, borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <Label style={{ color: C.amber, marginBottom: 6 }}>Signed in as</Label>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 16, color: C.white, wordBreak: "break-all" }}>{user.email}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <span style={{ background: isPro ? C.amber : C.nightSoft, color: isPro ? C.night : C.white, borderRadius: 999, padding: "4px 10px", fontFamily: SANS, fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>{isPro ? "PRO" : "FREE"}</span>
          <span style={{ fontFamily: SANS, fontSize: 12, color: "rgba(255,255,255,.65)" }}>
            {isPro ? (profile?.sub_status === "trialing" ? `Free trial · ends ${until}` : profile?.sub_status === "canceled" || profile?.sub_status === "cancel_at_period_end" ? `Cancelled · Pro until ${until}` : until ? `Renews ${until}` : "Pro") : "Upgrade for exports"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <MenuRow icon={sync === "synced" ? <Cloud size={18} color={C.go} /> : <CloudOff size={18} color={sync === "error" ? C.alert : C.inkSoft} />} label="Backup" sub={syncLabel}
          right={<RefreshCw size={16} color={C.inkSoft} />} onClick={async () => { await pushNow(); await refreshProfile(); }} />
        {!isPro && <MenuRow icon={<Crown size={18} color={C.amber} />} label="Upgrade to Odo Pro" sub={`${CONFIG.TRIAL_DAYS}-day free trial`} onClick={() => setModal({ type: "paywall" })} />}
        {portal && <MenuRow icon={<ExternalLink size={18} color={C.ink} />} label="Manage subscription" sub="Change plan, update card, cancel, invoices" onClick={() => window.open(portal, "_blank", "noopener")} />}
        <MenuRow icon={<LifeBuoy size={18} color={C.ink} />} label="Help & support" sub="We'll reply here in the app" onClick={() => setModal({ type: "support" })} />
        <MenuRow icon={<DownloadIcon size={18} color={C.ink} />} label="Download my data" sub="Everything Odo holds about you, as a file" right={<span />} onClick={() => {
          const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: user.email, id: user.id }, subscription: profile, settings, ledger }, null, 2)], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `odo-my-data-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
          setToast({ msg: "Your data file is downloading" });
        }} />
        <MenuRow icon={<LogOut size={18} color={C.alert} />} label="Sign out" sub="Your data stays in your account" onClick={doSignOut} right={<span />} />
        <MenuRow icon={<UserX size={18} color={C.inkSoft} />} label="Delete my account" sub="Permanently erase your account and data" right={<span />} onClick={async () => {
          if (!window.confirm("Request permanent deletion of your Odo account and all your records? Cancel any subscription first under Manage subscription.")) return;
          try {
            await cloud.submitTicket({ user, subject: "Account deletion request", message: `Please permanently delete account ${user.email} (${user.id}) and all associated data.`, diagnostics: null });
            setToast({ msg: "Request sent — we'll confirm by email within 30 days" });
          } catch (e) { setToast({ msg: "Couldn't send — please try again or email support" }); }
        }} />
      </div>
    </Sheet>
  );
}

function PaywallSheet({ user, setModal }) {
  const [plan, setPlan] = useState("yearly");
  const m = parseFloat(String(CONFIG.PRICE_MONTHLY).replace(/[^\d.]/g, "")) || 0;
  const y = parseFloat(String(CONFIG.PRICE_YEARLY).replace(/[^\d.]/g, "")) || 0;
  const save = m && y ? Math.round((1 - y / (m * 12)) * 100) : 0;
  const ready = Boolean(CONFIG.STRIPE_MONTHLY_LINK || CONFIG.STRIPE_YEARLY_LINK);
  const go = () => {
    if (!user) { setModal({ type: "account" }); return; }
    const url = cloud.checkoutUrl(plan, user);
    if (url) window.location.assign(url);
  };
  const perks = ["Accountant-ready CSV exports", "One-page ATO-style tax summary", "Priority support"];
  return (
    <Sheet title="Odo Pro" onClose={() => setModal(null)}
      footer={
        <>
          <button className="odo-press" disabled={!ready} style={{ ...primaryBtn, opacity: ready ? 1 : 0.5 }} onClick={go}>
            {!user ? "Create a free account to continue" : `Start ${CONFIG.TRIAL_DAYS}-day free trial`}
          </button>
          <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.inkSoft, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
            {ready ? "Secure checkout by Stripe. Cancel anytime from Account → Manage subscription." : "Payments aren't switched on yet."}
          </div>
        </>
      }>
      <div style={{ background: C.night, borderRadius: 20, padding: 18, marginBottom: 14 }}>
        {perks.map((p) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
            <Check size={16} color={C.amber} /><span style={{ fontFamily: SANS, fontSize: 14, color: C.white }}>{p}</span>
          </div>
        ))}
        <div style={{ fontFamily: SANS, fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 10, lineHeight: 1.5 }}>Tip: Odo Pro is a work expense — log it as an expense and claim it.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[["yearly", "Yearly", CONFIG.PRICE_YEARLY, "/yr", save > 0 ? `Save ${save}%` : ""], ["monthly", "Monthly", CONFIG.PRICE_MONTHLY, "/mo", ""]].map(([k, l, price, per, badge]) => (
          <button key={k} onClick={() => setPlan(k)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 16, border: `2px solid ${plan === k ? C.amber : C.line}`, background: plan === k ? C.amberSoft : C.surface, cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 15, color: C.ink }}>{l}</span>
              {badge && <span style={{ background: C.go, color: C.white, borderRadius: 999, padding: "2px 8px", fontFamily: SANS, fontWeight: 800, fontSize: 10.5 }}>{badge}</span>}
            </span>
            <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 16, color: C.ink }}>{price}<span style={{ fontSize: 12, color: C.inkSoft }}>{per}</span></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function SupportSheet({ user, profile, settings, ledger, setModal, setToast }) {
  const [topic, setTopic] = useState("Something's not working");
  const [msg, setMsg] = useState("");
  const [attach, setAttach] = useState(true);
  const [showDiag, setShowDiag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tickets, setTickets] = useState(null);
  const diag = useMemo(() => collectDiagnostics({ user, plan: cloud.isProProfile(profile) ? "pro" : "free", ledger, settings }), [user, profile, ledger, settings]);
  const canTicket = CLOUD_ON && user;

  useEffect(() => { if (canTicket) cloud.myTickets(user.id).then(setTickets).catch(() => setTickets([])); }, []);

  const send = async () => {
    if (!msg.trim()) { setErr("Tell us a little about what's happening."); return; }
    setErr(""); setBusy(true);
    try {
      if (canTicket) {
        await cloud.submitTicket({ user, subject: topic, message: msg.trim(), diagnostics: attach ? diag : null });
        setToast({ msg: "Sent — we'll reply here in Help & support" }); setModal(null);
      } else if (CONFIG.SUPPORT_EMAIL) {
        const body = `${msg.trim()}\n\n---\n${attach ? JSON.stringify(diag, null, 2) : ""}`;
        window.location.href = `mailto:${CONFIG.SUPPORT_EMAIL}?subject=${encodeURIComponent("Odo: " + topic)}&body=${encodeURIComponent(body)}`;
      } else {
        await navigator.clipboard.writeText(`${topic}\n\n${msg}\n\n${JSON.stringify(diag, null, 2)}`);
        setToast({ msg: "Copied — paste it into a message to support" });
      }
    } catch (e) { logError("support send: " + e?.message); setErr(friendly(e)); }
    setBusy(false);
  };

  const statusColor = { open: C.amber, in_progress: C.amber, waiting_on_user: C.alert, resolved: C.go, closed: C.inkSoft };
  return (
    <Sheet title="Help & support" onClose={() => setModal(null)}
      footer={<button className="odo-press" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={send}>{busy ? "Sending…" : canTicket ? "Send to support" : CONFIG.SUPPORT_EMAIL ? "Email support" : "Copy for support"}</button>}>
      {CLOUD_ON && !user && (
        <div style={{ background: C.amberSoft, borderRadius: 14, padding: 12, fontFamily: SANS, fontSize: 12.5, color: C.ink, lineHeight: 1.5, marginBottom: 14 }}>
          Sign in so we can reply inside the app. Otherwise this opens your email.
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <MenuRow icon={<BookOpen size={18} color={C.ink} />} label="Check the guide first" sub="Most answers are a tap away" onClick={() => setModal({ type: "guide" })} />
      </div>
      {tickets && tickets.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Label style={{ marginBottom: 8 }}>Your requests</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tickets.map((t) => (
              <div key={t.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13.5, color: C.ink }}>#{t.id} · {t.subject}</span>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 10.5, color: statusColor[t.status] || C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{String(t.status).replace(/_/g, " ")}</span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: C.inkSoft, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.message}</div>
                {t.admin_reply && <div style={{ background: C.goSoft, borderRadius: 10, padding: "8px 10px", marginTop: 8, fontFamily: SANS, fontSize: 13, color: C.ink, lineHeight: 1.45, whiteSpace: "pre-wrap" }}><b>Odo support:</b> {t.admin_reply}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <ErrorNote>{err}</ErrorNote>
      <Field label="What's it about?">
        <select className="odo-input" style={inputStyle} value={topic} onChange={(e) => setTopic(e.target.value)}>
          {["Something's not working", "Billing or subscription", "Question about my tax numbers", "Feature idea", "Other"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Message">
        <textarea className="odo-input" style={{ ...inputStyle, height: 110, resize: "vertical" }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="What happened, and what did you expect?" />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: SANS, fontSize: 13.5, color: C.ink, marginBottom: 6, cursor: "pointer" }}>
        <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} style={{ width: 18, height: 18, accentColor: C.amber }} />
        Include diagnostics (helps us fix it faster)
      </label>
      <button onClick={() => setShowDiag(!showDiag)} style={{ background: "none", border: "none", color: C.inkSoft, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "2px 0 10px", textDecoration: "underline" }}>
        {showDiag ? "Hide" : "See exactly what's sent"}
      </button>
      {showDiag && (
        <pre style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, fontFamily: MONO, fontSize: 10.5, color: C.inkSoft, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 180, overflowY: "auto", margin: "0 0 12px" }}>{JSON.stringify(diag, null, 2)}</pre>
      )}
      <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
        Diagnostics include app version, device and entry counts — never the contents of your shifts or expenses. See our <a href="privacy.html" target="_blank" rel="noopener" style={{ color: C.ink }}>privacy policy</a>.
        {CONFIG.SUPPORT_EMAIL && <> You can also email <a href={`mailto:${CONFIG.SUPPORT_EMAIL}`} style={{ color: C.ink }}>{CONFIG.SUPPORT_EMAIL}</a>.</>}
      </div>
    </Sheet>
  );
}

function NewPasswordSheet({ setModal, setToast }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr("");
    try { await cloud.setNewPassword(pw); setToast({ msg: "Password updated" }); setModal(null); }
    catch (e) { setErr(friendly(e)); }
    setBusy(false);
  };
  return (
    <Sheet title="Set a new password" onClose={() => setModal(null)}
      footer={<button className="odo-press" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={save}>Save password</button>}>
      <ErrorNote>{err}</ErrorNote>
      <Field label="New password"><input className="odo-input" style={inputStyle} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" /></Field>
    </Sheet>
  );
}

/* =================================================================
   IN-APP GUIDE · TOUR · INFO TIPS
   ================================================================= */

/* ⓘ button that pops a short explanation. Positioned to stay on screen. */
function Tip({ text, dark }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  useEffect(() => {
    if (!pos) return;
    const close = (e) => { if (!btn.current?.contains(e.target)) setPos(null); };
    const closeNow = () => setPos(null);
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", closeNow, true);
    window.addEventListener("resize", closeNow);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("scroll", closeNow, true); window.removeEventListener("resize", closeNow); };
  }, [pos]);
  const toggle = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btn.current.getBoundingClientRect();
    const W = Math.min(270, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - W / 2, window.innerWidth - W - 12));
    const below = window.innerHeight - r.bottom > 170;
    setPos({ left, W, top: below ? r.bottom + 8 : undefined, bottom: below ? undefined : window.innerHeight - r.top + 8 });
  };
  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-label="What's this?" aria-expanded={Boolean(pos)}
        style={{ display: "inline-grid", placeItems: "center", width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${dark ? "rgba(245,163,0,.7)" : C.inkSoft}`, background: "transparent", color: dark ? C.amber : C.inkSoft, fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 11, lineHeight: 1, padding: 0, marginLeft: 4, verticalAlign: "middle", cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>i</button>
      {pos && (
        <div role="tooltip" onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", zIndex: 95, left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.W, boxSizing: "border-box", background: dark ? C.white : C.ink, color: dark ? C.ink : C.white, borderRadius: 14, padding: "11px 13px", fontFamily: SANS, fontSize: 13, fontWeight: 500, lineHeight: 1.5, textTransform: "none", letterSpacing: 0, boxShadow: "0 12px 30px rgba(0,0,0,.3)", textAlign: "left" }}>
          {text}
        </div>
      )}
    </>
  );
}

/* **bold** → <b> */
function Rich({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}</>;
}
function GuideBlock({ b }) {
  const txt = { fontFamily: SANS, fontSize: 14, color: C.ink, lineHeight: 1.6 };
  if (b.p) return <p style={{ ...txt, margin: "0 0 10px" }}><Rich text={b.p} /></p>;
  if (b.steps) return (
    <ol style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
      {b.steps.map((st, i) => (
        <li key={i} style={{ ...txt, display: "flex", gap: 10, marginBottom: 8 }}>
          <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: C.ink, color: C.amber, fontFamily: MONO, fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center", marginTop: 1 }}>{i + 1}</span>
          <span><Rich text={st} /></span>
        </li>
      ))}
    </ol>
  );
  if (b.list) return (
    <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
      {b.list.map((li, i) => <li key={i} style={{ ...txt, marginBottom: 4 }}><Rich text={li} /></li>)}
    </ul>
  );
  if (b.tip || b.warn) return (
    <div style={{ background: b.tip ? C.goSoft : C.amberSoft, borderRadius: 12, padding: "10px 12px", display: "flex", gap: 9, margin: "0 0 12px" }}>
      <Info size={16} color={C.ink} style={{ flexShrink: 0, marginTop: 3 }} />
      <span style={{ ...txt, fontSize: 13 }}><Rich text={b.tip || b.warn} /></span>
    </div>
  );
  return null;
}

function GuideSheet({ setModal, startTour, initial }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(initial || null);
  const blockText = (b) => [b.p, b.tip, b.warn, ...(b.steps || []), ...(b.list || [])].filter(Boolean).join(" ");
  const ql = q.trim().toLowerCase();
  const sections = ql ? GUIDE.filter((s) => (s.title + " " + s.blocks.map(blockText).join(" ")).toLowerCase().includes(ql)) : GUIDE;
  return (
    <Sheet title="How to use Odo" onClose={() => setModal(null)}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="odo-press" onClick={() => { setModal(null); startTour(); }} style={{ flex: 1, background: C.ink, color: C.amber, border: "none", borderRadius: 14, padding: "12px", fontFamily: SANS, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Play size={14} fill={C.amber} /> Replay quick tour
        </button>
        <button className="odo-press" onClick={() => setModal({ type: "support" })} style={{ flex: 1, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px", fontFamily: SANS, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <LifeBuoy size={15} /> Ask support
        </button>
      </div>
      <input className="odo-input" style={{ ...inputStyle, marginBottom: 12 }} type="search" placeholder="Search the guide… e.g. GST, cap, receipts" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sections.length === 0 && <div style={{ fontFamily: SANS, fontSize: 13.5, color: C.inkSoft, textAlign: "center", padding: 16 }}>No matches. Try different words, or ask support.</div>}
        {sections.map((s) => {
          const isOpen = ql ? true : open === s.id;
          return (
            <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
              <button onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}
                style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 15, color: C.ink }}>{s.title}</span>
                <ChevronRight size={18} color={C.inkSoft} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </button>
              {isOpen && <div style={{ padding: "0 16px 6px" }}>{s.blocks.map((b, i) => <GuideBlock key={i} b={b} />)}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.inkSoft, textAlign: "center", margin: "16px 0 4px", lineHeight: 1.6 }}>
        Guide updated {GUIDE_UPDATED} · <a href="guide.html" target="_blank" rel="noopener" style={{ color: C.ink }}>Open in browser</a> · <a href="privacy.html" target="_blank" rel="noopener" style={{ color: C.ink }}>Privacy</a>
      </div>
    </Sheet>
  );
}

/* Spotlight tour: dims the screen, cuts out the target element, explains it. */
function Tour({ steps, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => {
    let raf;
    const measure = () => {
      const el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
    raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [i]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft" && i > 0) setI(i - 1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const next = () => (last ? onClose() : setI(i + 1));

  const vw = window.innerWidth, vh = window.innerHeight, PAD = 6;
  const W = Math.min(330, vw - 32);
  let card = { left: (vw - W) / 2, top: Math.max(24, vh / 2 - 110) };
  if (rect) {
    const spaceBelow = vh - rect.bottom, spaceAbove = rect.top;
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - W / 2, vw - W - 16));
    card = spaceBelow > 210 || spaceBelow > spaceAbove ? { left, top: rect.bottom + PAD + 12 } : { left, bottom: vh - rect.top + PAD + 12 };
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Quick tour" style={{ position: "fixed", inset: 0, zIndex: 90 }}>
      {rect ? (
        <div style={{ position: "fixed", left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, borderRadius: 18, boxShadow: `0 0 0 3px ${C.amber}, 0 0 0 9999px rgba(11,15,30,.74)`, transition: "all .25s ease", pointerEvents: "none" }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,15,30,.74)" }} />
      )}
      <div style={{ position: "fixed", ...card, width: W, boxSizing: "border-box", background: C.surface, borderRadius: 20, padding: 18, boxShadow: "0 18px 40px rgba(0,0,0,.35)" }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 17, color: C.ink, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontFamily: SANS, fontSize: 14, color: C.inkSoft, lineHeight: 1.55 }}>{step.body}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {steps.map((_, k) => <span key={k} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 3, background: k === i ? C.amber : C.line, transition: "width .2s" }} />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!last && <button onClick={onClose} style={{ background: "none", border: "none", color: C.inkSoft, fontFamily: SANS, fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: "8px 6px" }}>Skip</button>}
            {i > 0 && <button onClick={() => setI(i - 1)} style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 12, fontFamily: SANS, fontWeight: 800, fontSize: 13.5, cursor: "pointer", padding: "8px 12px" }}>Back</button>}
            <button className="odo-press" onClick={next} autoFocus style={{ background: C.amber, border: "none", color: C.night, borderRadius: 12, fontFamily: SANS, fontWeight: 800, fontSize: 13.5, cursor: "pointer", padding: "8px 14px" }}>
              {i === 0 ? "Show me" : last ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
