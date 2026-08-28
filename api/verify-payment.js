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

  const { orderId } = req.body || {};

  if (!orderId) {
    return res.status(400).json({
      success: false,
      error: "Missing orderId"
    });
  }

  try {
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
      return res.status(response.status).json({
        success: false,
        error: "Unable to verify payment",
        details: order
      });
    }

    const paid = order.order_status === "PAID";

    return res.status(200).json({
      success: true,
      paid,
      orderId: order.order_id,
      status: order.order_status
    });

  } catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).json({
      success: false,
      error: "Payment verification failed"
    });
  }
};
