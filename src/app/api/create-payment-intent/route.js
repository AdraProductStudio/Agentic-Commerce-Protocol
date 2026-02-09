import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { product } = await req.json();

    // Amount in cents
    const amount = product.price * 100;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      product,
    });
  } catch (err) {
    console.error("PaymentIntent Error:", err);
    return Response.json({ error: "Unable to create payment intent" }, { status: 500 });
  }
}
