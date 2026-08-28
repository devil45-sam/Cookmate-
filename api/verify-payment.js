const APP_ID = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
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
    const { orderId } = req.body || {};

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Missing orderId."
      });
    }

    if (!APP_ID || !SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: "Cashfree credentials are not configured."
      });
    }

    // Verify order directly with Cashfree
    const response = await fetch(
      `https://api.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          "x-client-id": APP_ID,
          "x-client-secret": SECRET_KEY,
          "x-api-version": "2025-01-01"
        }
      }
    );

    const order = await response.json();

    if (!response.ok) {
      console.error("Cashfree verification error:", order);

      return res.status(response.status).json({
        success: false,
        error: "Unable to verify payment."
      });
    }

    // Only PAID orders can activate Premium
    if (order.order_status !== "PAID") {
      return res.status(200).json({
        success: true,
        paid: false,
        status: order.order_status
      });
    }

    // Get deviceId from Cashfree order tags
    const deviceId =
      order.order_tags &&
      order.order_tags.deviceId;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "Device ID missing from payment order."
      });
    }

    // Activate Premium in Google Sheets
    if (WEBHOOK_URL) {
      const sheetResponse = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "activatePremium",
          deviceId: deviceId
        })
      });

      const sheetResult = await sheetResponse.json();

      if (sheetResult.error) {
        console.error(
          "Google Sheets activation error:",
          sheetResult
        );

        return res.status(500).json({
          success: false,
          error: "Payment verified, but Premium activation failed."
        });
      }
    }

    return res.status(200).json({
      success: true,
      paid: true,
      premium: true,
      orderId: orderId
    });

  } catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).json({
      success: false,
      error: "Payment verification failed."
    });
  }
};
