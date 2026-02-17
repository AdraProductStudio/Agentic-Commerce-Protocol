import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";
import Order from "@/models/Order";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req, { params }) {
  try {
    await connectDB();

    const session = await CheckoutSession.findOne({
      session_id: params.id,
    });

    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      session.stripePaymentIntentId
    );

    if (paymentIntent.status !== "succeeded") {
      return Response.json(
        { error: "Payment not completed" },
        { status: 402 }
      );
    }

    const order = await Order.create({
      orderId: "ORD_" + Date.now(),
      checkout: { session_id: session.session_id },
      buyer: session.buyer,
      items: session.items,
      totalPrice: session.total,
      paymentStatus: "paid",
      status: "confirmed",
    });

    session.status = "completed";
    await session.save();

    return Response.json({ order });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
