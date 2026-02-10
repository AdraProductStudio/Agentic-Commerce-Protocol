import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";

export async function GET() {
  await connectDB();

  const latestOrder = await Order.findOne().sort({ createdAt: -1 });

  if (!latestOrder) {
    return Response.json(
      { error: "No orders yet" },
      { status: 404 }
    );
  }

  return Response.json({
    type: "order_confirmation",
    order_id: latestOrder.orderId,
    status: latestOrder.paymentStatus,
    delivery: latestOrder.status,
  });
}
