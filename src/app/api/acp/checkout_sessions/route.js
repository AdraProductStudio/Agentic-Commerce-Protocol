import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");

    if (token !== process.env.ACP_SECRET_KEY) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { buyer, items, fulfillment_address } = await req.json();

    if (!buyer || !items || items.length === 0) {
      return Response.json({ error: "buyer and items required" }, { status: 400 });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const tax = 0;
    const total = subtotal + tax;

    const session_id = "cs_" + Date.now();

    const currency = (items[0].currency || "usd").toLowerCase();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total * 100,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { acp_session_id: session_id },
    });

    const saved = await CheckoutSession.create({
      session_id,
      buyer,
      items,
      fulfillment_address,
      subtotal,
      tax,
      total,
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
    });

    return Response.json({
      checkout_session: {
        id: saved.session_id,
        status: saved.status,
        subtotal,
        tax,
        total,
        items,
      },
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
