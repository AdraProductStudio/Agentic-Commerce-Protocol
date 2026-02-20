import Product from "@/models/Product";
import { connectDB } from "@/lib/mongodb";

export async function GET(req) {
  await connectDB();

  const { searchParams } = new URL(req.url);

  const query = searchParams.get("query") || "";
  const skip = parseInt(searchParams.get("skip") || "0");
  const budgetParam = searchParams.get("budget");
  const budget = Number.parseInt(budgetParam || "", 10);
  const hasBudget = Number.isFinite(budget) && budget > 0;

  console.log("[API] GET /api/products", { query, skip, budget: hasBudget ? budget : null });

  // ✅ Step 1: Split query into words
  const words = query
    .trim()
    .split(/\s+/) // split by spaces
    .filter(Boolean);

  // ✅ Step 2: Build AND regex match for all words
  const searchClauses = [];

  if (words.length > 0) {
    searchClauses.push(
      ...words.map((word) => ({
        $or: [
          { name: { $regex: word, $options: "i" } },
          { brand: { $regex: word, $options: "i" } },
          { category: { $regex: word, $options: "i" } },
        ],
      }))
    );
  }

  if (hasBudget) {
    searchClauses.push({ price: { $lte: budget } });
  }

  const searchFilter = searchClauses.length > 0 ? { $and: searchClauses } : {};


  // ✅ Step 3: Fetch products
  const products = await Product.find(searchFilter)
    .skip(skip)
    .limit(10);

  // ✅ Step 4: Count total
  const total = await Product.countDocuments(searchFilter);

  return Response.json({
    products,
    nextSkip: skip + 10,
    hasMore: skip + 10 < total,
  });
}
