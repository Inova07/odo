# Odo — driver tax tracker

Shift & expense tracker for Australian food-delivery drivers. **Web app first**
(install from the browser with "Add to Home Screen"), with the Capacitor
iOS/Android build still available later.

## What's new in v1.2

- **Quick tour:** a spotlight walkthrough on first launch. Users can replay it from Settings → How to use Odo.
- **ⓘ tooltips:** short explanations on the key numbers (tax back, distance, km rate, cap, marginal rate, business-use %).
- **In-app guide:** a searchable "How to use Odo" screen. The same content is published as **guide.html**, which you can link from your website or socials.
- **Privacy policy:** **privacy.html**, linked from sign-up, Settings and Support. Fill in `BUSINESS_NAME`, `ABN`, `SUPPORT_EMAIL` and `BUSINESS_STATE` in `odo-config.js`. Anything missing shows up highlighted in red on the page.
- **Account → Download my data / Delete my account:** covers the access and deletion rights promised in the policy. Deletion requests arrive as support tickets; delete the user in Supabase → Authentication → Users within 30 days.
- **2026–27 tax figures:** the ATO km rate is now set per financial year (91c for 2026–27, 88c for the two years before), and the lowest tax bracket is 15%. Each June, add the new year to `AU_RATES` in `src/App.jsx`.

**Editing the guide:** change `src/guide.js`. It updates both the in-app guide and guide.html on the next `npm run build`.

**Promises the privacy policy makes, so set these up:** turn on two-factor authentication for your Supabase and Stripe logins, choose the **Sydney** region for Supabase, and delete support tickets older than 2 years.

---

## What's new in v1.1

- **Accounts + cloud backup** (Supabase). Odo still works without an account; signing in backs data up and syncs it to a new phone.
- **Odo Pro subscription** (Stripe). Free covers logging shifts and expenses and the tax-back estimate; Pro unlocks exports. There's a 7-day trial.
- **Help & support.** Users send a message with optional diagnostics, and you reply from the Supabase dashboard. They see your reply in the app.
- **Error log.** The app keeps the last 25 errors on the device and attaches them to support requests.
- **Offline support.** A service worker lets the web version open with no signal.
- **Local mode.** Until you fill in `odo-config.js`, the app runs exactly as before: no accounts, everything unlocked.

---

## Going live: setup checklist (about an hour, all in the browser)

### Step 1 — Host the web app
Use **Netlify** (netlify.com → "Deploy manually" → drag the `odo-web` folder in)
or **Cloudflare Pages**. Both are free and support a custom domain. Note your URL,
e.g. `https://odo-app.netlify.app`.

> tiiny.host works for testing, but you need a proper host to edit
> `odo-config.js` and attach a domain.

### Step 2 — Supabase (accounts, backup, support tickets)
1. supabase.com → New project (region: **Sydney**).
2. **SQL Editor** → New query → paste `supabase/setup.sql` → **Run**.
3. **Authentication → URL Configuration** → Site URL = your app URL.
4. **Project Settings → API** → copy the **Project URL** and **anon public** key
   into `odo-config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

### Step 3 — Stripe (payments)
1. stripe.com → create account (business details, Australian bank account).
2. **Product catalogue** → add product "Odo Pro" with two recurring prices:
   A$4.99 / month and A$39.99 / year (tick "include tax" if registered for GST).
3. **Payment Links** → create one link per price:
   - Tick **"Include a free trial"** → 7 days
   - **After payment** → "Don't show confirmation page" → redirect to
     `https://YOUR-APP-URL/?checkout=success`
   - Paste the links into `STRIPE_MONTHLY_LINK` / `STRIPE_YEARLY_LINK`.
4. **Settings → Billing → Customer portal** → activate → copy the **login link**
   into `STRIPE_PORTAL_LINK` (lets users cancel / change card themselves).

### Step 4 — Connect Stripe → Supabase (marks people as Pro)
1. Supabase → **Edge Functions** → Deploy a new function → name `stripe-webhook`
   → paste `supabase/functions/stripe-webhook/index.ts` → **turn off "Verify JWT"** → Deploy.
   Copy its URL (`https://xxxx.supabase.co/functions/v1/stripe-webhook`).
2. Stripe → **Developers → Webhooks** → Add endpoint → that URL. Events:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the **signing secret** (`whsec_…`).
3. Supabase → Edge Functions → **Secrets** → add
   `STRIPE_SECRET_KEY` (Stripe → Developers → API keys → Secret key) and
   `STRIPE_WEBHOOK_SECRET` (the `whsec_…`).

**Test first:** do all of Step 3–4 in Stripe **Test mode** and buy with card
`4242 4242 4242 4242`. Switch to live keys/links once it works.

### Step 5 — Upload the edited `odo-config.js` and you're live.

---

## Running it day to day

| You want to… | Where |
|---|---|
| See who's paying, MRR, churn, refunds | Stripe dashboard (Home / Billing → Subscriptions) |
| See every user + plan | Supabase → Table Editor → `profiles` (or SQL: `select * from admin_subscribers`) |
| Give someone free Pro (beta tester) | `profiles` row → `plan` = `pro`, `pro_until` empty, `note` = "comp" |
| See open support requests | SQL: `select * from admin_open_tickets` (or Table Editor → `support_tickets`) |
| Reply to a user | Edit the ticket's `admin_reply` and set `status` (`in_progress`, `waiting_on_user`, `resolved`) — they see it in Help & support |
| Monthly bookkeeping | Stripe → Reports → Balance / Payouts → export CSV |

Tip: Supabase → Database → Webhooks can email/Slack you whenever a new
`support_tickets` row arrives.

## Before charging the public
- A **Privacy Policy** and **Terms** page (you're storing personal and financial data; the Australian Privacy Act may apply). Link them from your site and the Stripe checkout settings.
- Stripe will ask for an ABN or sole-trader details.
- GST: register once your *app's* turnover reaches A$75k/yr. Stripe Tax can calculate it.

---

## Development

```bash
npm install
npm run dev      # local preview
npm run build    # → dist/  (upload this folder; edit dist/odo-config.js)
```

`odo-config.js` is loaded at runtime, so you can change keys or prices on the host without rebuilding.

Key files: `src/App.jsx` (UI), `src/cloud.js` (Supabase/Stripe), `src/diagnostics.js`
(error log + support snapshot), `src/config.js`, `public/odo-config.js`, `supabase/`.

---

# Native iOS / Android build (optional, later)

## 1. Prerequisites

- **Node.js 18 or newer** (`node -v` to check)
- **To build for iOS:** a Mac with **Xcode** (from the Mac App Store) + CocoaPods
  (`sudo gem install cocoapods`)
- **To build for Android:** **Android Studio** (any OS)

You can do everything except the final iOS build on Windows/Linux.

## 2. Install and run in a browser

```bash
npm install
npm run dev
```

Open the printed URL. This is the fastest way to try changes. Your data is
saved on the device (via Capacitor Preferences), so it persists between runs.

## Get an APK on your phone (no Play Store)

Two ways to turn this code into an installable `.apk`. Neither needs Google Play.

### Option A — cloud build (easiest, nothing to install)

A GitHub Action (`.github/workflows/android.yml`) builds the APK on GitHub's
servers for you.

1. Put this project in a GitHub repo: `git init && git add . && git commit -m "odo" && git push`
   to a repo you've created.
2. On GitHub, open the **Actions** tab → **Build Android APK** → **Run workflow**
   (it also runs automatically on every push to `main`).
3. When it finishes (~3–5 min), open the run and download the **odo-debug-apk**
   artifact. It's a zip — unzip it to get `app-debug.apk`.
4. Send that file to your Android phone and tap it. Allow "install from unknown
   sources" when asked. Installed. 🎉

### Option B — build locally in one command

Needs **Android Studio** installed once (open it so it downloads the SDK) + a JDK.

```bash
npm install
npm run apk
```

That builds everything and leaves **`odo-debug.apk`** in this folder. Copy it to
your phone and tap to install.

> These are **debug** APKs — perfect for your own phone and for testers. To
> publish on the Play Store later you'd make a signed *release* build (step 7),
> but you don't need that to use the app today.

---

## 3. Add the phone platforms (once)

```bash
npm run build          # creates the dist/ folder Capacitor ships
npx cap add ios        # Mac only
npx cap add android
```

This generates native `ios/` and `android/` folders. Commit them to git.

## 4. Build & run on a device or simulator

Whenever you change the app, rebuild and sync, then open the native project:

```bash
# iOS  (Mac only) — opens Xcode
npm run ios

# Android — opens Android Studio
npm run android
```

In Xcode / Android Studio press **Run** to launch on a simulator/emulator or a
plugged-in phone. (`npm run ios` / `npm run android` just run
`build → cap sync → cap open` for you.)

## 5. App icon & splash screen

Drop a 1024×1024 `icon.png` (and optional `splash.png`) in an `assets/` folder,
then:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate
```

## 6. Rename / rebrand

Edit `capacitor.config.json`:

- `appId` — reverse-domain bundle id, e.g. `au.com.yourname.odo`
  (set this **before** `cap add`, or you'll need to re-add the platforms)
- `appName` — the name under the icon

## 7. Publishing

- **Google Play:** one-time US$25 developer account. Build a signed `.aab` from
  Android Studio → *Build → Generate Signed Bundle*.
- **Apple App Store:** US$99/yr Apple Developer Program. Archive from Xcode →
  *Product → Archive* → upload to App Store Connect.

---

## Project layout

```
odo-app/
├─ index.html            # app shell
├─ capacitor.config.json # app id, name, web dir
├─ vite.config.js        # base:"./" so assets load in the WebView
├─ src/
│  ├─ main.jsx           # React entry
│  ├─ App.jsx            # the whole Odo app (UI + logic)
│  ├─ storage.js         # device storage (swap here for a cloud backend later)
│  └─ index.css          # reset + notch/safe-area handling
└─ (ios/ android/)       # created by `cap add`
```

## Where to take it next

- **Cloud sync / backup:** replace `src/storage.js` with calls to a backend
  (Supabase or Firebase are quick) — the rest of the app won't need changing.
- **Receipt photos:** add `@capacitor/camera` and attach an image to each expense.
- **GPS auto-distance:** `@capacitor/geolocation` to track km without the odometer.
- **Reminders:** `@capacitor/local-notifications` to nudge "log your shift".

## Not tax advice

Rates and rules are indicative and change. Confirm current figures on
[ato.gov.au](https://www.ato.gov.au) or with a registered tax agent before you lodge.
