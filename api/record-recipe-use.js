// CookMate India - Record successful free recipe use
// Vercel API route: /api/record-recipe-use

const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

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
        action: "recordRecipeUse",
        deviceId
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error || data.recorded !== true) {
      console.error("Record recipe use error:", data);
      return json(res, 502, {
        success: false,
        error: "Unable to record recipe usage."
      });
    }

    return json(res, 200, {
      success: true,
      recorded: true
    });
  } catch (error) {
    console.error("Record recipe use error:", error);
    return json(res, 500, {
      success: false,
      error: "Unable to record recipe usage."
    });
  }
};
