import { connectDB } from "@/lib/mongodb";
import Product from "@/models/Product";

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return Response.json({ products: [] });
    }

    // Case-insensitive search
    const products = await Product.find({
      name: { $regex: query, $options: "i" },
    });

    return Response.json({ products });
  } catch (err) {
    console.error("❌ Product Fetch Error:", err);
    return Response.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
