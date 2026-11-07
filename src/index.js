
const PLANS = {
  40: 1,
  115: 3,
  275: 7,
  1100: 30
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function amountToCents(value) {
  const amount = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return null;

  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        status: "online",
        worker: "rixxze-key-generator"
      });
    }

    if (request.method !== "POST" || url.pathname !== "/kofi") {
      return json({ error: "Not found" }, 404);
    }

    try {
      const form = await request.formData();
      const rawData = form.get("data");

      if (!rawData) {
        return json({ error: "Missing webhook data" }, 400);
      }

      const payment = JSON.parse(rawData);

      if (
        !env.KOFI_VERIFICATION_TOKEN ||
        payment.verification_token !== env.KOFI_VERIFICATION_TOKEN
      ) {
        return json({ error: "Invalid verification token" }, 401);
      }

      const transactionId = String(
        payment.kofi_transaction_id || ""
      ).trim();

      const messageId = String(payment.message_id || "").trim();

      if (!transactionId || !messageId) {
        return json({ error: "Missing transaction identifier" }, 400);
      }

      const cents = amountToCents(payment.amount);

      if (
        payment.currency !== "USD" ||
        cents === null ||
        !PLANS[cents]
      ) {
        return json({
          status: "ignored",
          reason: "Unsupported currency or amount"
        });
      }

      await env.DB.prepare(`
        INSERT OR IGNORE INTO payments
        (transaction_id, message_id, amount, currency,
         payment_type, payment_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        transactionId,
        messageId,
        String(payment.amount),
        payment.currency,
        String(payment.type || ""),
        String(payment.timestamp || "")
      ).run();

      return json({
        status: "received",
        transaction_id: transactionId
      });

    } catch (error) {
      return json({
        error: "Webhook processing failed"
      }, 500);
    }
  }
};
