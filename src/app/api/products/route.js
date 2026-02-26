import Product from "@/models/Product";
import { connectDB } from "@/lib/mongodb";

const QUERY_STOP_WORDS = new Set([
  "show",
  "me",
  "the",
  "best",
  "top",
  "find",
  "search",
  "for",
  "a",
  "an",
  "any",
  "with",
  "and",
  "or",
  "please",
  "mobile",
  "mobiles",
  "phone",
  "phones",
  "smartphone",
  "smartphones",
  "under",
  "below",
  "above",
  "over",
  "greater",
  "more",
  "between",
  "from",
  "less",
  "than",
  "at",
  "least",
  "most",
  "upto",
  "up",
  "to",
  "within",
  "budget",
  "rs",
  "rupees",
  "inr",
]);

export async function GET(req) {
  await connectDB();

  const { searchParams } = new URL(req.url);

  const query = searchParams.get("query") || "";
  const skip = parseInt(searchParams.get("skip") || "0");
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const budgetParam = searchParams.get("budget");
  const minPrice = Number.parseInt(minPriceParam || "", 10);
  const maxPrice = Number.parseInt(maxPriceParam || "", 10);
  const budget = Number.parseInt(budgetParam || "", 10);
  const hasMinPrice = Number.isFinite(minPrice) && minPrice > 0;
  const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice > 0;
  const hasBudget = Number.isFinite(budget) && budget > 0;

  let effectiveMinPrice = hasMinPrice ? minPrice : null;
  let effectiveMaxPrice = hasMaxPrice ? maxPrice : null;
  if (effectiveMaxPrice === null && hasBudget) {
    // Backward-compatible support for old `budget` query param (treated as max).
    effectiveMaxPrice = budget;
  }
  if (
    effectiveMinPrice !== null &&
    effectiveMaxPrice !== null &&
    effectiveMinPrice > effectiveMaxPrice
  ) {
    const low = effectiveMaxPrice;
    const high = effectiveMinPrice;
    effectiveMinPrice = low;
    effectiveMaxPrice = high;
  }

  console.log("[API] GET /api/products", {
    query,
    skip,
    minPrice: effectiveMinPrice,
    maxPrice: effectiveMaxPrice,
  });

  // ✅ Step 1: Normalize free-text query and keep only meaningful search tokens
  const words = Array.from(
    new Set(
      query
        .toLowerCase()
        .match(/[a-z0-9]+/gi)
        ?.filter((word) => {
          if (!word) return false;
          if (QUERY_STOP_WORDS.has(word)) return false;
          if (/^\d+$/.test(word)) return false;
          return true;
        }) || []
    )
  );

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

  if (effectiveMinPrice !== null && effectiveMaxPrice !== null) {
    searchClauses.push({ price: { $gte: effectiveMinPrice, $lte: effectiveMaxPrice } });
  } else if (effectiveMinPrice !== null) {
    searchClauses.push({ price: { $gte: effectiveMinPrice } });
  } else if (effectiveMaxPrice !== null) {
    searchClauses.push({ price: { $lte: effectiveMaxPrice } });
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
