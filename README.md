# CookMate India — Setup Guide

## What's in this project
- `index.html` — the full app (design + working logic, no build step)
- `/api/generate-recipe.js` — calls Gemini to generate a structured recipe
- `/api/_payments.js` — Cashfree payment verification (currently placeholder — see below)
- `package.json` — no dependencies needed (uses built-in `fetch`)

## Step 1 — Create a GitHub repo
1. Go to github.com → sign in → **New repository**
2. Name it `cookmate-india`
3. Click **Create repository**
4. Click **"Add file" → "Upload files"**
5. Upload `index.html`, `package.json`, `README.md`, and the whole `api` folder (keep the folder structure — `api` must stay a folder)
6. Commit changes

## Step 2 — Deploy to Vercel
1. Go to vercel.com → sign in with GitHub
2. **Add New Project** → select `cookmate-india` → **Deploy**
3. You'll get a live URL like `cookmate-india.vercel.app`

## Step 3 — Add environment variables
Go to your Vercel project → **Settings → Environment Variables**:

| Variable | Value | Required now? |
|---|---|---|
| `GEMINI_API_KEY` | your Gemini API key from aistudio.google.com | **Yes** — recipes won't generate without this |
| `CASHFREE_APP_ID` | from Cashfree dashboard → Developers → API Keys | Not yet — add when ready to accept real payments |
| `CASHFREE_SECRET_KEY` | from Cashfree dashboard → Developers → API Keys | Not yet |

After adding `GEMINI_API_KEY`, go to **Deployments → Redeploy** (env vars only apply after a redeploy).

## Step 4 — Test it
1. Open your live site
2. Enter your name, pick language/plan/meal/ingredients/cuisine
3. Tap "Find My Perfect Recipes"
4. A recipe should generate and display, with working audio controls (Play/Pause/Next/Prev/Repeat/Speed)

## IMPORTANT — before accepting real payments
Right now `generate-recipe.js` does NOT check payment status at all —
it will generate a recipe for anyone who submits the form, with no
charge. This is fine for testing. Before sharing this publicly for
real transactions:

1. Add your Cashfree keys (Step 3 above)
2. Build a `/api/create-payment.js` endpoint that creates a real
   Cashfree order and returns a checkout link
3. Update the frontend's `startPayment()` function to redirect to
   that checkout link BEFORE calling `/api/generate-recipe`
4. Wire `verifyPayment()` from `_payments.js` into `generate-recipe.js`
   so it blocks recipe generation on failed/unverified payments

Ask for this piece once your Cashfree keys are ready — it's a
focused addition, same pattern used in the ML Lead Generator project.
