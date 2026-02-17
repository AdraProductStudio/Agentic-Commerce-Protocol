import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";

export async function POST(req, { params }) {
  try {
    await connectDB();

    const session = await CheckoutSession.findOne({
      session_id: params.id,
    });

    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    session.status = "cancelled";
    await session.save();

    return Response.json({ message: "Cancelled" });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
