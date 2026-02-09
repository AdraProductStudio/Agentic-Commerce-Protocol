import Stripe from "stripe";

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

  // ✅ ACP Order Completion Trigger
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;

    console.log("✅ Payment confirmed:", intent.id);

    // TODO: Create Order Record + ACP Receipt Object
  }

  return new Response("ok", { status: 200 });
}
