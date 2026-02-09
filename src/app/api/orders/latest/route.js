import clientPromise from "@/lib/mongodb";

export async function GET() {
  const client = await clientPromise;
  const db = client.db();

  const latestOrder = await db
    .collection("orders")
    .find()
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  if (!latestOrder.length) {
    return Response.json({ error: "No orders yet" }, { status: 404 });
  }

  return Response.json(latestOrder[0].confirmation);
}
