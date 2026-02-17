import Product from "@/models/Product";
import { connectDB } from "@/lib/mongodb";

export async function GET(req) {
  await connectDB();

  const { searchParams } = new URL(req.url);

  const query = searchParams.get("query") || "";
  const skip = parseInt(searchParams.get("skip") || "0");

  const products = await Product.find({
    name: { $regex: query, $options: "i" },
  })
    .skip(skip)
    .limit(10);

  const total = await Product.countDocuments({
    name: { $regex: query, $options: "i" },
  });

  return Response.json({
    products,
    nextSkip: skip + 10,
    hasMore: skip + 10 < total,
  });
}
