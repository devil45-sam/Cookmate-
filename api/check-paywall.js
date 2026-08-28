// CookMate India - Check Paywall
// POST /api/check-paywall

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { deviceId } = req.body || {};

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "Missing deviceId."
      });
    }

    if (!WEBHOOK_URL) {
      return res.status(500).json({
        success: false,
        error: "Google Sheets webhook is not configured."
      });
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "checkPaywall",
        deviceId: deviceId
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Paywall check error:", data);

      return res.status(500).json({
        success: false,
        error: data.error || "Unable to check paywall."
      });
    }

    const freeRecipesUsed =
      Number(data.freeRecipesUsed) || 0;

    const premiumStatus =
      data.premiumStatus === true ||
      data.premiumStatus === "true";

    // Keep this value in sync with index.html
    const FREE_RECIPE_LIMIT = 2;

    const allowed =
      premiumStatus ||
      freeRecipesUsed < FREE_RECIPE_LIMIT;

    return res.status(200).json({
      success: true,
      allowed: allowed,
      freeRecipesUsed: freeRecipesUsed,
      premiumStatus: premiumStatus
    });

  } catch (error) {
    console.error("Paywall error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to check recipe access."
    });
  }
};
