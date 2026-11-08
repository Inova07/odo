// Runtime config comes from public/odo-config.js so it can be edited after a build.
const raw = (typeof window !== "undefined" && window.ODO_CONFIG) || {};

export const CONFIG = {
  SUPABASE_URL: raw.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: raw.SUPABASE_ANON_KEY || "",
  STRIPE_MONTHLY_LINK: raw.STRIPE_MONTHLY_LINK || "",
  STRIPE_YEARLY_LINK: raw.STRIPE_YEARLY_LINK || "",
  STRIPE_PORTAL_LINK: raw.STRIPE_PORTAL_LINK || "",
  PRICE_MONTHLY: raw.PRICE_MONTHLY || "A$4.99",
  PRICE_YEARLY: raw.PRICE_YEARLY || "A$39.99",
  TRIAL_DAYS: raw.TRIAL_DAYS ?? 7,
  SUPPORT_EMAIL: raw.SUPPORT_EMAIL || "",
};

/* Cloud = accounts + sync + subscriptions + support tickets. Off = local mode. */
export const CLOUD_ON = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

/* eslint-disable no-undef */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
