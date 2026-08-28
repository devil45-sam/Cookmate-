// CookMate India - Cashfree Production Create Order
// Vercel API route: /api/create-order

const APP_ID = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

const CASHFREE_API = "https://api.cashfree.com/pg";
const CASHFREE_API_VERSION = "2025-01-01";
const PREMIUM_AMOUNT = 10;
const RETURN_URL =
  "https://cookmate-steel.vercel.app/?payment=success&order_id={order_id}";

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
      error: "Cashfree production credentials are not configured."
    });
  }

  try {
    const body = req.body || {};
    const deviceId = String(body.deviceId || "").trim();

    if (!deviceId) {
      return json(res, 400, {
        success: false,
        error: "Missing deviceId."
      });
    }

    const customerId =
      String(body.customerId || "cookmate_" + deviceId).slice(0, 50);

    const customerPhone = String(
      body.customerPhone || "9999999999"
    ).replace(/\D/g, "").slice(-10);

    if (customerPhone.length !== 10) {
      return json(res, 400, {
        success: false,
        error: "A valid 10-digit customer phone number is required."
      });
    }

    const orderId =
      "cookmate_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);

    const requestId =
      "cookmate-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);

    const response = await fetch(`${CASHFREE_API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-client-id": APP_ID,
        "x-client-secret": SECRET_KEY,
        "x-api-version": CASHFREE_API_VERSION,
        "x-request-id": requestId
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: PREMIUM_AMOUNT,
        order_currency: "INR",
        customer_details: {
          customer_id: customerId,
          customer_phone: customerPhone
        },
        order_meta: {
          return_url: RETURN_URL
        },
        order_tags: {
          deviceId: deviceId,
          product: "CookMate Premium"
        },
        order_note: "CookMate Premium"
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Cashfree create-order error:", data);
      return json(res, response.status, {
        success: false,
        error: data.message || "Cashfree order creation failed.",
        details: data
      });
    }

    if (!data.order_id || !data.payment_session_id) {
      console.error("Unexpected Cashfree response:", data);
      return json(res, 502, {
        success: false,
        error: "Cashfree did not return a payment session."
      });
    }

    return json(res, 200, {
      success: true,
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id
    });
  } catch (error) {
    console.error("Create order error:", error);
    return json(res, 500, {
      success: false,
      error: "Unable to create payment order."
    });
  }
};
