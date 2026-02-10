import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Webhook signature error:", err.message);
    return new Response("Webhook Error", { status: 400 });
  }

  /* ✅ Payment Success Event */
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    console.log("✅ Payment succeeded:", paymentIntent.id);

    await connectDB();

    // Generate Order ID
    const newOrder = await Order.create({
      orderId: "ORD_" + Date.now(),
      paymentStatus: "paid",
      status: "confirmed",
      product: {
        name: paymentIntent.metadata.productName,
        price: paymentIntent.amount / 100,
        color: paymentIntent.metadata.color,
      },
    });

    console.log("✅ Order Saved:", newOrder.orderId);
  }

  return Response.json({ received: true });
}
