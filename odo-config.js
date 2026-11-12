// ============================================================
//  ODO CONFIG — edit this file after uploading, no rebuild needed.
//  Leave a value as "" to switch that feature off.
//  While SUPABASE_URL is empty the app runs in "local mode":
//  no accounts, data stays on the phone, and every feature is unlocked.
// ============================================================
window.ODO_CONFIG = {
  // Supabase → Project Settings → API
  SUPABASE_URL: "",          // e.g. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "",     // the "anon / public" key (safe to publish)

  // Stripe → Payment Links (set "After payment" to redirect to your app URL + ?checkout=success)
  STRIPE_MONTHLY_LINK: "",   // e.g. "https://buy.stripe.com/abc123"
  STRIPE_YEARLY_LINK: "",
  // Stripe → Settings → Billing → Customer portal → "Login link"
  STRIPE_PORTAL_LINK: "",

  // Shown on the paywall
  PRICE_MONTHLY: "A$4.99",
  PRICE_YEARLY: "A$39.99",
  TRIAL_DAYS: 7,

  // Where support requests go if the cloud isn't set up (and shown to users)
  SUPPORT_EMAIL: "",         // e.g. "support@odoapp.com.au"

  // Shown on the Privacy Policy page (privacy.html)
  BUSINESS_NAME: "",         // legal name, e.g. "Rickie Smith trading as Odo" or "Odo Apps Pty Ltd"
  ABN: "",                   // e.g. "12 345 678 901"
  BUSINESS_STATE: "NSW",     // state/territory you operate from
  PRIVACY_UPDATED: "12 November 2026",
};
