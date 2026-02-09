import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { product } = await req.json();

    if (!product) {
      return Response.json({ error: "Product missing" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
            },
            unit_amount: product.price * 100,
          },
          quantity: 1,
        },
      ],

      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Checkout Error:", err);

    return Response.json({ error: err.message }, { status: 500 });
  }
}
