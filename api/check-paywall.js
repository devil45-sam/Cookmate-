// CookMate India - Paywall Check
// Vercel API route: /api/check-paywall

const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const FREE_RECIPE_LIMIT = 2;

function json(res, status, data) {
  return res.status(status).json(data);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return json(res, 405, { success: false, error: "Method not allowed" });
  }

  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    return json(res, 500, {
      success: false,
      error: "Google Sheets webhook URL is not configured."
    });
  }

  try {
    const deviceId = String(req.body?.deviceId || "").trim();

    if (!deviceId) {
      return json(res, 400, {
        success: false,
        error: "Missing deviceId."
      });
    }

    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "checkPaywall",
        deviceId
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      console.error("Paywall sheet error:", data);
      return json(res, 502, {
        success: false,
        error: "Unable to check recipe access."
      });
    }

    const used = Number(data.freeRecipesUsed) || 0;
    const premium = data.premiumStatus === true;
    const freeRemaining = Math.max(0, FREE_RECIPE_LIMIT - used);
    const allowed = premium || used < FREE_RECIPE_LIMIT;

    return json(res, 200, {
      success: true,
      allowed,
      premium,
      freeRecipesUsed: used,
      freeRemaining
    });
  } catch (error) {
    console.error("Paywall check error:", error);
    return json(res, 500, {
      success: false,
      error: "Unable to check recipe access."
    });
  }
};
