const paymentIntent = await stripe.paymentIntents.create({
  amount,
  currency: "usd",
  automatic_payment_methods: { enabled: true },

  metadata: {
    productName: product.name,
    color: product.color,
  },
});
