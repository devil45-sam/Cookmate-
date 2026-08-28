// POST /api/record-recipe-use
//
// Called AFTER a recipe is successfully generated (never before, and
// never if generation failed) — increments the free-recipe counter.
//
// Body: { deviceId }
//
// Required Vercel environment variable:
//   GOOGLE_SHEETS_WEBHOOK_URL

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { deviceId } = req.body || {};
  if (!deviceId) { res.status(400).json({ error: "Missing deviceId." }); return; }

  if (!WEBHOOK_URL) { res.status(200).json({ recorded: false }); return; }

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recordRecipeUse", deviceId })
    });
    res.status(200).json({ recorded: true });
  } catch (err) {
    console.error("record-recipe-use error:", err);
    // Don't fail the user's request over a logging error — the recipe
    // already generated successfully.
    res.status(200).json({ recorded: false });
  }
};
