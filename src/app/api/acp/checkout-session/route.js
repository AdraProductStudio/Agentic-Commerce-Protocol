import Stripe from "stripe";
import { productsData } from "@/data/productsData";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const { productId } = await req.json();

  // ✅ Always fetch product securely from DB/store
  const product = productsData.find((p) => p.id === productId);

  if (!product) {
    return Response.json({ error: "Invalid product" }, { status: 400 });
  }

  // ✅ ACP Checkout Session Object
  const checkoutSession = {
    type: "checkout_session",
    merchant: {
      name: "RetailStore",
    },
    line_items: [
      {
        id: product.id,
        name: product.name,
        unit_price: product.price,
        quantity: 1,
      },
    ],
    currency: "usd",
    total_amount: product.price,
  };

  // ✅ Stripe PaymentIntent Created Server-Side
  const paymentIntent = await stripe.paymentIntents.create({
    amount: product.price * 100,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      acp_product_id: product.id,
    },
  });

  return Response.json({
    checkoutSession,
    clientSecret: paymentIntent.client_secret,
  });
}
