import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";

export async function GET(req, { params }) {
  try {
    await connectDB();

    const session = await CheckoutSession.findOne({
      session_id: params.id,
    });

    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ checkout_session: session });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await connectDB();
    const update = await req.json();

    const session = await CheckoutSession.findOne({
      session_id: params.id,
    });

    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (update.items) session.items = update.items;
    if (update.fulfillment_address)
      session.fulfillment_address = update.fulfillment_address;

    await session.save();

    return Response.json({
      checkout_session: session,
      message: "Updated",
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
