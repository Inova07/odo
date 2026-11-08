/* =====================================================================
   ODO USER GUIDE — single source of truth.
   Used by the in-app "How to use Odo" screen AND the public guide.html
   page (generated at build time by scripts/build-pages.mjs).
   Plain data only (no React) so both can read it.

   Block types:  { p }  { steps: [] }  { list: [] }  { tip }  { warn }
   Inline:       **bold**
   ===================================================================== */

export const GUIDE_UPDATED = "November 2026";

export const GUIDE = [
  {
    id: "start",
    title: "Getting started",
    blocks: [
      { p: "Odo tracks your delivery and rideshare shifts, the kilometres you drive for work and your work expenses. It then works out your tax deductions and gives you an accountant-ready summary at tax time." },
      { p: "**Install it on your phone** so it opens like a normal app, full screen and offline:" },
      { steps: [
        "**iPhone:** open the Odo link in **Safari** → tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.",
        "**Android:** open the link in **Chrome** → tap the **⋮ menu** → **Install app** (or **Add to Home screen**).",
        "Open Odo from the new icon on your home screen from now on.",
      ] },
      { p: "**First-time setup (1 minute):**" },
      { steps: [
        "Tap the **⚙ Settings** button (top right).",
        "Check **Region** is Australia. This sets the ATO km rate, 5,000 km cap and the July–June financial year.",
        "Pick your **marginal tax rate** (15%, 30%, 37% or 45%) based on your expected total income for the year. See \"Understanding your numbers\" if you're unsure.",
        "Tap **Save settings**.",
        "Optional but recommended: tap the **👤 Account** button and create a free account so your records are backed up.",
      ] },
      { tip: "You can replay the quick tour at any time from Settings → How to use Odo." },
    ],
  },
  {
    id: "shifts",
    title: "Logging a shift",
    blocks: [
      { p: "A shift is the main thing you record in Odo. Each one stores the date, platform, kilometres, earnings and hours." },
      { p: "**Live shift (best way):**" },
      { steps: [
        "When you start working, tap **Start shift** on the Home screen.",
        "Choose the **platform** (Uber Eats, DoorDash, Menulog…) and type your car's **starting odometer** reading.",
        "Tap **Clock on**. A green dot and a running timer show you're on shift. You can close the app, because the timer keeps going.",
        "When you finish, tap **End shift**. Enter your **ending odometer** reading and what you **earned**. Hours are filled in for you.",
        "Tap **Save shift**. Your estimated tax back updates straight away.",
      ] },
      { p: "**Forgot to start a shift?** Go to the **Shifts** tab → **Add shift** and enter it afterwards. If you don't have odometer readings, switch to **Enter km** and type the distance from your platform's trip history." },
      { p: "**Working several apps at once?** Log one shift, pick the main platform, enter your combined earnings and use the **Note** field to list the others." },
      { tip: "Take a photo of your odometer at the start and end of each shift. Your camera roll then backs up your records if the ATO ever asks." },
      { warn: "Only kilometres driven **for work** count. The trip from home to your first job, and home again afterwards, may be private travel. If you're not sure, check with the ATO or a registered tax agent." },
      { p: "**Deleting:** tap the bin icon on any shift, then tap the tick to confirm. An **Undo** button appears for a few seconds." },
    ],
  },
  {
    id: "expenses",
    title: "Logging expenses",
    blocks: [
      { p: "Use the **Expenses** tab for work costs other than driving: your phone bill, delivery bags, parking, tolls and so on." },
      { steps: [
        "Tap **Add expense**.",
        "Pick a **category**. Odo suggests a typical business-use percentage.",
        "Enter the **amount** and **date**.",
        "Adjust the **business use** slider. If you use your phone 70% for work and 30% personally, set it to 70%. Odo only counts the work share.",
        "Add a note (store name, what it was) and **Save**.",
      ] },
      { warn: "**Don't double-dip.** The ATO cents-per-km rate already covers fuel, rego, insurance, servicing, repairs and depreciation. If you claim your kilometres, don't also claim those car costs, or Odo will show a warning on the Export screen. Parking and tolls can generally still be claimed on top." },
      { p: "**Bike or e-bike riders:** the cents-per-km method is only for cars. Log your actual bike costs (repairs, batteries, gear) as expenses instead. Set your distance to 0 or skip the odometer." },
      { tip: "Keep receipts for expenses. A photo is fine. The ATO wants written evidence for most claims, and you should keep it for 5 years after you lodge." },
    ],
  },
  {
    id: "numbers",
    title: "Understanding your numbers",
    blocks: [
      { p: "**Estimated tax back** (the big odometer on Home) = your total deductions × your marginal tax rate. It shows roughly how much less tax you'll pay because of your work claims. It is **not** your exact refund, which depends on your whole tax return." },
      { p: "**Distance deduction** = work km × the ATO rate. For **2026–27 the rate is 91c per km** (it was 88c for 2024–25 and 2025–26). Odo uses the right rate for whichever year you're viewing." },
      { p: "**The 5,000 km cap:** with the cents-per-km method you can claim at most 5,000 km per car per year (2026–27 maximum: $4,550). Odo shows when you've hit it. Full-time drivers often go well past this. If so, the **logbook method** may give a bigger claim, so talk to a tax agent." },
      { p: "**Marginal tax rate** (resident rates from 1 July 2026, plus 2% Medicare levy):" },
      { list: [
        "$0 – $18,200: nil",
        "$18,201 – $45,000: **15%**",
        "$45,001 – $135,000: **30%**",
        "$135,001 – $190,000: **37%**",
        "$190,001 and over: **45%**",
      ] },
      { p: "Pick the band your **total** income for the year falls in, including any other job." },
      { p: "**Income / Deductions / Net:** income is everything you've logged as earnings. Net is income minus deductions. This is roughly the business profit you'll report." },
      { p: "**GST:** food delivery riders only need to register for GST once their turnover reaches **$75,000 a year**. **Rideshare drivers** (carrying passengers) must register for GST from their **first dollar**, whatever they earn." },
    ],
  },
  {
    id: "years",
    title: "Financial years",
    blocks: [
      { p: "Australian financial years run from **1 July to 30 June**. Odo shows one year at a time, labelled like **FY 26–27**." },
      { p: "Use the **‹ ›** arrows at the top of the Home screen to move between years. The Shifts, Expenses and Export tabs follow the year you choose." },
      { tip: "Lodging last year's return? Tap ‹ to go back to that year before exporting." },
    ],
  },
  {
    id: "export",
    title: "Tax time: exporting your records",
    blocks: [
      { p: "The **Export** tab turns your year into files for your tax agent, or for yourself if you lodge through myTax. Exports are part of **Odo Pro**." },
      { list: [
        "**Shifts CSV:** every shift with dates, platforms, odometer readings, km, earnings and hours. Opens in Excel or Google Sheets.",
        "**Expenses CSV:** every expense with category, amount, business % and the deductible amount.",
        "**Summary:** a one-page overview of income, km, deductions and estimated tax saving. Copy it into an email to your accountant.",
      ] },
      { steps: [
        "Make sure the right **financial year** is selected.",
        "Open **Export** and tap the file you need. On iPhone, choose **Save to Files** or share it straight to Mail.",
        "Send it to your tax agent, or use the totals when you fill in myTax (sole trader / business income section).",
      ] },
      { tip: "The ATO says you need to show how you worked out your business kilometres. Your Odo shift log, with dates and odometer readings, is exactly that kind of record." },
    ],
  },
  {
    id: "account",
    title: "Account, backup & changing phones",
    blocks: [
      { p: "Odo works without an account, but then your records live **only on that phone**. If you delete the app, clear Safari data or lose the phone, they're gone." },
      { p: "With a **free account**, every change is backed up automatically. The small dot on the **👤** button shows the status:" },
      { list: [
        "**Green:** backed up.",
        "**Amber:** syncing right now.",
        "**Grey:** you're offline. Odo keeps working and syncs when you're back online.",
        "**Red:** something went wrong. Open Account and tap **Backup** to retry.",
      ] },
      { p: "**New phone?** Install Odo, sign in with the same email, and your records come back." },
      { p: "**Signing out** removes your records from that phone (they stay safe in your account). Useful if you share a device." },
      { p: "**Forgot your password?** On the sign-in screen tap **Forgot password?** and follow the email link." },
      { p: "**Your data:** Account → **Download my data** saves everything as a file at any time, free. You can also request account deletion there." },
    ],
  },
  {
    id: "pro",
    title: "Odo Pro subscription",
    blocks: [
      { p: "Odo Pro unlocks accountant-ready exports and priority support. Logging shifts and expenses, the tax-back estimate and cloud backup stay **free**." },
      { list: [
        "**Free trial:** try Pro free first. You won't be charged until the trial ends, and you can cancel before then.",
        "**Upgrade:** tap **Go Pro** at the top of the screen, pick monthly or yearly (yearly is cheaper) and pay securely through Stripe.",
        "**Manage or cancel:** Account → **Manage subscription**. You can change plan, update your card, download invoices or cancel. If you cancel, Pro keeps working until the end of the period you've paid for.",
      ] },
      { tip: "Odo Pro is a work expense. Log the subscription in Expenses under Other at your business-use percentage, and claim it." },
    ],
  },
  {
    id: "help",
    title: "Troubleshooting & getting help",
    blocks: [
      { p: "**My shifts disappeared.** Check the financial year at the top of Home first, since you may be viewing a different year. If you use an account, check you're signed in with the same email." },
      { p: "**The numbers look wrong.** Check Settings: region, marginal rate, and that \"Use the ATO rate automatically\" is ticked." },
      { p: "**Odo looks out of date.** Close it fully (swipe it away) and reopen. Odo updates itself automatically when online." },
      { p: "**Still stuck?** Go to Settings → **Help & support**, describe the problem and send it. If you're signed in, our reply appears on that same screen." },
      { p: "Leave **Include diagnostics** ticked. It sends technical details such as app version, phone model and recent errors, which help us fix things fast. It **never** includes what's in your shifts or expenses. Tap \"See exactly what's sent\" to check." },
    ],
  },
  {
    id: "disclaimer",
    title: "Important: not tax advice",
    blocks: [
      { p: "Odo is a record-keeping tool. Its figures are **estimates** based on the rates and rules in Settings, and those change. Before you lodge, confirm current rules at **ato.gov.au** or with a **registered tax agent**. Your records, and what you claim, remain your responsibility." },
    ],
  },
];

/* Quick tour shown on first launch. `target` matches a data-tour="…" attribute. */
export const TOUR = [
  { title: "Welcome to Odo 👋", body: "Here's a 30-second tour of how Odo turns your shifts into a bigger tax return." },
  { target: "hero", title: "Your estimated tax back", body: "This grows every time you log a shift or expense. It's your deductions × your tax rate: an estimate, not your exact refund." },
  { target: "start", title: "Start every shift here", body: "Tap when you start work and enter your odometer. When you finish, tap End shift and add the end reading and your earnings. Kilometres are your biggest deduction." },
  { target: "breakdown", title: "What's driving your claim", body: "Kilometres × the ATO rate (91c/km for 2026–27), plus your logged expenses. The 5,000 km cap is applied for you." },
  { target: "nav-expenses", title: "Log your work costs", body: "Phone bill, delivery bags, parking, tolls. Set the business-use % and Odo counts only the work share." },
  { target: "nav-export", title: "At tax time", body: "Export your year as CSV files and a one-page summary for your accountant or myTax." },
  { target: "settings", title: "Set your tax rate first", body: "Open Settings and pick your marginal tax rate so the estimate is right for you. The guide and support are in there too." },
  { target: "account", cloudOnly: true, title: "Back up your records", body: "Create a free account so your records survive a lost phone and move to a new one." },
  { title: "You're ready to go", body: "Tap any ⓘ icon for a quick explanation. The full guide is in Settings → How to use Odo." },
];
