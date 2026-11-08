// Supabase Edge Function: receives Stripe events and updates profiles.plan.
// Deploy: Supabase → Edge Functions → "Deploy a new function" → name it
// `stripe-webhook`, paste this file, and turn OFF "Verify JWT" (Stripe can't send one).
// Secrets (Edge Functions → Secrets): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function periodEnd(sub: Stripe.Subscription): string | null {
  // current_period_end moved onto subscription items in newer API versions
  const ts = (sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function applySubscription(sub: Stripe.Subscription, userId?: string | null) {
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  const status = sub.cancel_at_period_end && live ? "cancel_at_period_end" : sub.status;
  const row = {
    plan: live ? "pro" : "free",
    sub_status: status,
    pro_until: periodEnd(sub),
    stripe_customer_id: String(sub.customer),
    stripe_subscription_id: sub.id,
  };
  const q = userId
    ? db.from("profiles").update(row).eq("id", userId)
    : db.from("profiles").update(row).eq("stripe_customer_id", String(sub.customer));
  const { error } = await q;
  if (error) throw error;
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, cryptoProvider);
  } catch (err) {
    return new Response(`Bad signature: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.client_reference_id; // set by the app on the Payment Link URL
        if (userId && s.customer) {
          await db.from("profiles").update({ stripe_customer_id: String(s.customer) }).eq("id", userId);
        }
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(s.subscription));
          await applySubscription(sub, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    console.error(err);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
