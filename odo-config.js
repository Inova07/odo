// ============================================================
//  ODO CONFIG — edit this file after uploading, no rebuild needed.
//  Leave a value as "" to switch that feature off.
//  While SUPABASE_URL is empty the app runs in "local mode":
//  no accounts, data stays on the phone, and every feature is unlocked.
// ============================================================
window.ODO_CONFIG = {
  // Supabase → Project Settings → API
  SUPABASE_URL: "https://hegcotgcyhpbqidiznxo.supabase.co",          // e.g. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_Jd1uL9neHjRde3ngbTlL_A_yFzfMkiX",     // the "anon / public" key (safe to publish)

  // Stripe → Payment Links (set "After payment" to redirect to your app URL + ?checkout=success)
  STRIPE_MONTHLY_LINK: "https://buy.stripe.com/test_9B6dR926yelaaTKb1m8IU00",   // e.g. "https://buy.stripe.com/abc123"
  STRIPE_YEARLY_LINK: "https://buy.stripe.com/test_28E9ATaD40uk7Hy2uQ8IU01",
  // Stripe → Settings → Billing → Customer portal → "Login link"
  STRIPE_PORTAL_LINK: "https://billing.stripe.com/p/login/test_9B6dR926yelaaTKb1m8IU00",
  STRIPE_TAXPACK_LINK: "https://buy.stripe.com/test_14A7sL7qS2Csge41qM8IU02",
  
  // Shown on the paywall
  PRICE_MONTHLY: "A$4.99",
  PRICE_YEARLY: "A$39.99",
  TRIAL_DAYS: 7,

  // Where support requests go if the cloud isn't set up (and shown to users)
  SUPPORT_EMAIL: "",         // e.g. "support@odoapp.com.au"

  // Shown on the Privacy Policy page (privacy.html)
  BUSINESS_NAME: "Odo Pty Ltd",         // legal name, e.g. "Rickie Smith trading as Odo" or "Odo Apps Pty Ltd"
  ABN: "1111 1111 1111",                   // e.g. "12 345 678 901"
  BUSINESS_STATE: "NSW",     // state/territory you operate from
  PRIVACY_UPDATED: "12 November 2026",
};
