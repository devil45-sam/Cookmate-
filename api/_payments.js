// Payment verification — currently a PLACEHOLDER.
//
// Not yet wired into generate-recipe.js (see the NOTE there). Once
// you're ready to accept real payments:
//
//   1. Set these in Vercel environment variables:
//        CASHFREE_APP_ID
//        CASHFREE_SECRET_KEY
//   2. Create a /api/create-payment.js endpoint that creates a Cashfree
//      order and returns a checkout link (call this BEFORE generate-recipe).
//   3. Import and call verifyPayment(paymentId, expectedAmount) inside
//      generate-recipe.js, right after the required-fields check, and
//      block recipe generation if it returns false.
//
// Cashfree docs: https://docs.cashfree.com/docs/orders

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

async function verifyPayment(orderId, expectedAmount) {
  if (!orderId) return false;

  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn(
      "WARNING: Cashfree keys not set. Running in placeholder mode — payment is NOT actually being verified."
    );
    return true; // TEMPORARY — remove once real keys are added
  }

  try {
    const res = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01"
      }
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.order_status !== "PAID") return false;
    if (Number(data.order_amount) < expectedAmount) return false;

    return true;
  } catch (err) {
    console.error("Cashfree verification error:", err);
    return false;
  }
}

module.exports = { verifyPayment };
