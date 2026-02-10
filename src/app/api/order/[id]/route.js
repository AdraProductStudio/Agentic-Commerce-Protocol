import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";

export async function GET(req, { params }) {
  await connectDB();

  const order = await Order.findOne({ orderId: params.id });

  if (!order) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  return Response.json(order);
}
