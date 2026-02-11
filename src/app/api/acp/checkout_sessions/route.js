import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    await connectDB();

    // ✅ Receive full payload from frontend ChatWidget
    const body = await req.json();
    const { buyer, items, fulfillment_address } = body;

    if (!buyer || !items || items.length === 0) {
      return Response.json(
        { error: "buyer and items are required" },
        { status: 400 }
      );
    }

    // ✅ Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // const tax = Math.round(subtotal * 0.05); // 5% tax
      const tax = 0; // 5% tax. -> tax amount may be modified here
    const total = subtotal + tax;

    // ✅ Generate unique ACP session ID
    const session_id = "sess_" + Date.now();

    // ✅ Create Stripe PaymentIntent
    const currency = (items[0].currency || "USD").toLowerCase();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total * 100, // in cents
      currency: currency,
      automatic_payment_methods: { enabled: true },
      metadata: { acp_session_id: session_id },
    });

    // ✅ Save Checkout Session in MongoDB
const savedSession = await CheckoutSession.create({
  session_id,
  buyer,
  items: items.map(i => ({
    id: i.id,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    currency: i.currency, // ✅ store currency
  })),
  fulfillment_address,
  subtotal,
  tax,
  total,
  status: "pending",
});

console.log("✅ Saved Session Items:", savedSession.items);



    console.log("✅ Checkout Session Saved:", savedSession.session_id);

    // ✅ Return session info and Stripe client secret
    return Response.json({
      checkout_session: {
        id: session_id,
        status: "pending",
        subtotal,
        tax,
        total,
        items, // include items in response for safety
      },
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("❌ Checkout Session Error:", err.message);
    return Response.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
