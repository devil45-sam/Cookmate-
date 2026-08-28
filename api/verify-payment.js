// CookMate India - Cashfree Production Payment Verification
// Vercel API route: /api/verify-payment

const APP_ID = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

const CASHFREE_API = "https://api.cashfree.com/pg";
const CASHFREE_API_VERSION = "2025-01-01";
const EXPECTED_AMOUNT = 10;

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

  if (!APP_ID || !SECRET_KEY) {
    return json(res, 500, {
      success: false,
      error: "Cashfree credentials are not configured."
    });
  }

  if (!WEBHOOK_URL) {
    return json(res, 500, {
      success: false,
      error: "Google Sheets webhook URL is not configured."
    });
  }

  try {
    const { orderId } = req.body || {};
    const cleanOrderId = String(orderId || "").trim();

    if (!cleanOrderId) {
      return json(res, 400, {
        success: false,
        error: "Missing orderId."
      });
    }

    const response = await fetch(
      `${CASHFREE_API}/orders/${encodeURIComponent(cleanOrderId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-client-id": APP_ID,
          "x-client-secret": SECRET_KEY,
          "x-api-version": CASHFREE_API_VERSION
        }
      }
    );

    const order = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Cashfree verification error:", order);
      return json(res, response.status, {
        success: false,
        error: "Unable to verify payment."
      });
    }

    const amount = Number(order.order_amount);
    const currency = String(order.order_currency || "").toUpperCase();
    const status = String(order.order_status || "").toUpperCase();

    if (amount !== EXPECTED_AMOUNT || currency !== "INR") {
      console.error("Unexpected order amount/currency:", {
        amount,
        currency,
        orderId: cleanOrderId
      });
      return json(res, 400, {
        success: false,
        error: "Invalid payment order."
      });
    }

    if (status !== "PAID") {
      return json(res, 200, {
        success: true,
        paid: false,
        premium: false,
        status
      });
    }

    const deviceId = String(order.order_tags?.deviceId || "").trim();

    if (!deviceId) {
      return json(res, 400, {
        success: false,
        error: "Device ID missing from payment order."
      });
    }

    const sheetResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "activatePremium",
        deviceId
      })
    });

    const sheetResult = await sheetResponse.json().catch(() => ({}));

    if (!sheetResponse.ok || sheetResult.error || sheetResult.premium !== true) {
      console.error("Google Sheets activation error:", sheetResult);
      return json(res, 500, {
        success: false,
        error: "Payment verified, but Premium activation failed."
      });
    }

    return json(res, 200, {
      success: true,
      paid: true,
      premium: true,
      orderId: cleanOrderId
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return json(res, 500, {
      success: false,
      error: "Payment verification failed."
    });
  }
};
