import { createClient } from "@supabase/supabase-js";
import { CONFIG, CLOUD_ON } from "./config.js";
import { logError } from "./diagnostics.js";

/* Supabase does three jobs for Odo:
 *   1. accounts (email + password)
 *   2. a backup copy of each user's shifts/expenses/settings ("ledgers" table)
 *   3. subscription status ("profiles" table, written only by the Stripe webhook)
 *   4. support tickets ("support_tickets" table)
 * See supabase/setup.sql for the tables and security rules. */
export const sb = CLOUD_ON
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const fail = (where, error) => { logError(`${where}: ${error?.message || error}`); throw error; };

/* ---------- auth ---------- */
export async function getUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}
export function onAuthChange(cb) {
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
  if (error) fail("signUp", error);
  return data; // data.session is null when email confirmation is required
}
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) fail("signIn", error);
  return data.user;
}
export async function sendPasswordReset(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) fail("reset", error);
}
export async function setNewPassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) fail("updatePassword", error);
}
export async function signOut() { if (sb) await sb.auth.signOut(); }

export const appUrl = () => window.location.origin + window.location.pathname;

/* ---------- subscription ---------- */
export async function fetchProfile(userId) {
  const { data, error } = await sb.from("profiles").select("plan, pro_until, sub_status").eq("id", userId).maybeSingle();
  if (error) fail("fetchProfile", error);
  return data;
}
export function isProProfile(p) {
  if (!p || p.plan !== "pro") return false;
  return !p.pro_until || new Date(p.pro_until).getTime() > Date.now();
}
export function checkoutUrl(kind, user) {
  const base = kind === "yearly" ? CONFIG.STRIPE_YEARLY_LINK : CONFIG.STRIPE_MONTHLY_LINK;
  if (!base) return "";
  const u = new URL(base);
  u.searchParams.set("client_reference_id", user.id); // ties the payment to this account
  if (user.email) u.searchParams.set("prefilled_email", user.email);
  return u.toString();
}
export function portalUrl(user) {
  if (!CONFIG.STRIPE_PORTAL_LINK) return "";
  const u = new URL(CONFIG.STRIPE_PORTAL_LINK);
  if (user?.email) u.searchParams.set("prefilled_email", user.email);
  return u.toString();
}

/* ---------- backup / sync ---------- */
export async function pullLedger(userId) {
  const { data, error } = await sb.from("ledgers").select("data, client_updated_at").eq("user_id", userId).maybeSingle();
  if (error) fail("pullLedger", error);
  return data; // { data: {settings, ledger}, client_updated_at } | null
}
export async function pushLedger(userId, payload, clientUpdatedAt) {
  const { error } = await sb.from("ledgers").upsert(
    { user_id: userId, data: payload, client_updated_at: clientUpdatedAt, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) fail("pushLedger", error);
}
/* Used once, when someone who's been using Odo without an account signs in:
 * keep everything from both sides so nothing is lost. */
export function mergeLedgers(a, b) {
  const byId = (x, y) => { const m = new Map(); [...(x || []), ...(y || [])].forEach((r) => m.set(r.id, r)); return [...m.values()]; };
  return { shifts: byId(a?.shifts, b?.shifts), expenses: byId(a?.expenses, b?.expenses), active: a?.active || b?.active || null };
}

/* ---------- support ---------- */
export async function submitTicket({ user, subject, message, diagnostics }) {
  const { error } = await sb.from("support_tickets").insert({
    user_id: user.id, email: user.email, subject, message, diagnostics,
  });
  if (error) fail("submitTicket", error);
}
export async function myTickets(userId) {
  const { data, error } = await sb.from("support_tickets")
    .select("id, subject, message, status, admin_reply, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) fail("myTickets", error);
  return data || [];
}
