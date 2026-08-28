// CookMate India - Cashfree Production Create Order
// POST /api/create-order

const APP_ID = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

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

  if (!APP_ID || !SECRET_KEY) {
    return res.status(500).json({
      success: false,
      error: "Cashfree production credentials are not configured."
    });
  }

  try {
    const body = req.body || {};

    const deviceId = body.deviceId;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "Missing deviceId."
      });
    }

    // CookMate Premium price
    const amount = 10;

    const customerId =
      "cookmate_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);

    const customerPhone =
      body.customerPhone || "9999999999";

    const orderId =
      "cookmate_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);

    const response = await fetch(
      "https://api.cashfree.com/pg/orders",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-client-id": APP_ID,
          "x-client-secret": SECRET_KEY,
          "x-api-version": "2025-01-01"
        },

        body: JSON.stringify({
          order_id: orderId,
          order_amount: amount,
          order_currency: "INR",

          customer_details: {
            customer_id: customerId,
            customer_phone: customerPhone
          },

          order_meta: {
            return_url:
              "https://cookmate-steel.vercel.app/?payment=success&order_id={order_id}"
          },

          order_tags: {
            deviceId: deviceId
          },

          order_note: "CookMate Premium ₹10"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree error:", data);

      return res.status(response.status).json({
        success: false,
        error:
          data.message ||
          "Cashfree order creation failed."
      });
    }

    return res.status(200).json({
      success: true,
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id
    });

  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to create payment order."
    });
  }
};
