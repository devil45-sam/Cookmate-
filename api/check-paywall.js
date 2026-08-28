// POST /api/check-paywall
//
// Called BEFORE generate-recipe. Enforces: 2 free recipes per device,
// then requires ₹10 one-time Premium. Server-side only — frontend
// cannot bypass this by editing browser state.
//
// Body: { deviceId }
// Returns: { allowed: true } OR { allowed: false, reason: "PAYMENT_REQUIRED" }
//
// Required Vercel environment variable:
//   GOOGLE_SHEETS_WEBHOOK_URL  (your existing Apps Script webhook)

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { deviceId } = req.body || {};
  if (!deviceId) { res.status(400).json({ error: "Missing deviceId." }); return; }

  if (!WEBHOOK_URL) {
    // Sheet not configured yet — fail open so recipe generation still
    // works while you're setting this up (per "never break existing
    // functionality" rule).
    res.status(200).json({ allowed: true, warning: "Paywall not configured yet." });
    return;
  }

  try {
    const sheetRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkPaywall", deviceId })
    });
    const record = await sheetRes.json();

    if (record.premiumStatus === true) {
      res.status(200).json({ allowed: true, premium: true });
      return;
    }

    const used = record.freeRecipesUsed || 0;
    if (used < 2) {
      res.status(200).json({ allowed: true, premium: false, freeRemaining: 2 - used });
      return;
    }

    res.status(200).json({ allowed: false, reason: "PAYMENT_REQUIRED" });
  } catch (err) {
    console.error("check-paywall error:", err);
    // Fail open on error — never block recipe generation due to a
    // sheet outage.
    res.status(200).json({ allowed: true, warning: "Paywall check failed, allowing by default." });
  }
};
