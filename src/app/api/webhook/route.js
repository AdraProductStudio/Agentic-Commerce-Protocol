import Stripe from "stripe";
import clientPromise from "@/lib/mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response("Webhook Error", { status: 400 });
  }

  // ✅ Payment Confirmed
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;

    const client = await clientPromise;
    const db = client.db();

    // Find checkout record
    const checkout = await db.collection("checkouts").findOne({
      paymentIntentId: intent.id,
    });

    if (!checkout) {
      console.log("❌ Checkout not found for payment:", intent.id);
      return new Response("Checkout missing", { status: 404 });
    }

    // ✅ ACP Order Confirmation Object
    const orderConfirmation = {
      type: "order_confirmation",
      order_id: "ORD_" + intent.id.slice(-6),
      status: "confirmed",
      delivery: "processing",
    };

    // Save order
    await db.collection("orders").insertOne({
      createdAt: new Date(),
      paymentIntentId: intent.id,
      productId: checkout.productId,
      confirmation: orderConfirmation,
    });

    console.log("✅ ORDER SAVED:", orderConfirmation);
  }

  return new Response("ok", { status: 200 });
}
