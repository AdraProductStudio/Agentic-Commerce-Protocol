import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import CheckoutSession from "@/models/CheckoutSession";

export async function POST(req) {
  try {
    await connectDB();

    const { session_id } = await req.json();

    if (!session_id) {
      return Response.json({ error: "session_id is required" }, { status: 400 });
    }
    const session = await CheckoutSession.findOne({ session_id });
    console.log("✅ Checkout Session Items:", session.items);

    // Map items to plain objects for order creation
    const orderItems = session.items.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      currency : i.currency,
    }));

    // Create new order
    const newOrder = await Order.create({
      orderId: "ORD_" + Date.now(),
      checkout: { session_id },
      buyer: session.buyer,
      items: orderItems,
      totalPrice: session.total,
      paymentStatus: "paid",
      status: "confirmed",
    });

    // Mark checkout session as paid
    session.status = "paid";
    await session.save();

    return Response.json({
      order_id: newOrder.orderId,
      payment_status: newOrder.paymentStatus,
      delivery_status: newOrder.status,
      items: newOrder.items,
      total_price: newOrder.totalPrice,
      currency: session.items[0]?.currency || "USD", // ✅ send currency
    });
  } catch (err) {
    console.error("❌ Confirm API Error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
