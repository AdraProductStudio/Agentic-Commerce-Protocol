import OpenAI from "openai";
// ❌ Old static JSON import still kept (not deleted)
import { productsData } from "@/data/productsData";

import Order from "@/models/Order";
import Product from "@/models/Product"; // ✅ Still kept (not deleted)
import { connectDB } from "@/lib/mongodb";
import { formatCurrency } from "@/lib/formatCurrency";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* -----------------------------
   ACP State Memory (Simple Demo)
----------------------------- */
let pendingOptions = null;
let selectedProduct = null;

// ✅ Load More Memory
let lastQuery = null;
let lastSkip = 0;

/* -----------------------------
   POST Agent Route
----------------------------- */
export async function POST(req) {
  try {
    const { message } = await req.json();
    const text = message.trim().toLowerCase();

    /* -----------------------------
       ✅ STEP 0: Greetings
    ----------------------------- */
    if (["hi", "hello", "hey"].includes(text)) {
      return Response.json({
        reply: "👋 Hi! Ask me about mobiles available in our store.",
      });
    }

    /* -----------------------------
       ✅ STEP 0.3: LOAD MORE SUPPORT
       User: more / load more
    ----------------------------- */
    if (text === "more" || text === "load more" || text === "show more") {
      if (!lastQuery) {
        return Response.json({
          reply: "❌ Please search for a mobile first.",
        });
      }

      /* -------------------------------------------------
         ✅ MODIFICATION: Load More Calls Store API
         Instead of Product.find()
      ------------------------------------------------- */
      const storeRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/products?query=${lastQuery}&skip=${lastSkip}`
      );

      const storeData = await storeRes.json();

      // Update skip for next load
      lastSkip = storeData.nextSkip;

      return Response.json({
        reply: "🛒 More Mobiles:",
        products: storeData.products,
        nextSkip: storeData.nextSkip,
        hasMore: storeData.hasMore,
      });
    }

    /* -----------------------------
       ✅ STEP 0.5: ORDER TRACKING
       User: Track ORD_123456
    ----------------------------- */
    if (text.toLowerCase().includes("track")) {
      const match = text.toUpperCase().match(/ORD_\d+/);

      if (!match) {
        return Response.json({
          reply: "❌ Please provide a valid Order ID like:\nTrack ORD_123456",
        });
      }

      const orderId = match[0].trim();

      try {
        await connectDB();

        const order = await Order.findOne({ orderId });

        if (!order) {
          return Response.json({
            reply: `❌ Sorry, I could not find any order with ID: ${orderId}`,
          });
        }

        return Response.json({
          reply: `📦 Order Found Successfully!

✅ Order ID: ${order.orderId}
💳 Payment Status: ${order.paymentStatus}
🚚 Delivery Status: ${order.status}

🛒 Items Purchased:
${order.items
  .map(
    (i) =>
      `• ${i.name} × ${i.quantity} - ${formatCurrency(i.currency)}${
        i.price * i.quantity
      }`
  )
  .join("\n")}

💰 Total Price: ${formatCurrency(
            order.items[0]?.currency || "USD"
          )}${order.totalPrice}

Thank you for shopping with us! 🙏`,
        });
      } catch (err) {
        console.error("Track order error:", err);
        return Response.json({
          reply: "⚠️ Something went wrong. Please try again.",
        });
      }
    }

    /* -----------------------------
       ✅ STEP 1: ACP Product Selection
       User replies with number
    ----------------------------- */
    if (pendingOptions && !selectedProduct) {
      const choice = parseInt(text);

      if (!isNaN(choice) && choice >= 1 && choice <= pendingOptions.length) {
        selectedProduct = pendingOptions[choice - 1];

        return Response.json({
          reply: `✅ You selected: **${selectedProduct.name}**

💰 Price: ${formatCurrency(selectedProduct.currency)}${selectedProduct.price}
🎨 Brand: ${selectedProduct.brand}

Would you like to proceed to checkout? (Yes/No)`,
        });
      }

      pendingOptions = null;
      selectedProduct = null;
    }

    /* -----------------------------
       ✅ STEP 2: ACP Final Confirmation
    ----------------------------- */
    if (selectedProduct && text === "yes") {
      const product = selectedProduct;

      selectedProduct = null;
      pendingOptions = null;

      return Response.json({
        reply: `✅ Great! Redirecting to Stripe Checkout for ${product.name}...`,
        action: "CHECKOUT",
        product,
      });
    }

    if (selectedProduct && text === "no") {
      selectedProduct = null;

      return Response.json({
        reply: "❌ Checkout cancelled. You can ask about another phone.",
      });
    }

    /* -----------------------------
       ✅ STEP 3: Budget Query Detection
       Example: under 50000
    ----------------------------- */
    let budget = null;
    const budgetMatch = text.match(/under\s*\₹?(\d+)/);

    if (budgetMatch) {
      budget = parseInt(budgetMatch[1]);
    }

    /* -------------------------------------------------
       ✅ STEP 4: OpenAI Extract Search Query
       OpenAI decides what user wants
    ------------------------------------------------- */
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You are a shopping assistant.

Extract the product search keyword.

Return ONLY JSON:

{
  "query": "keyword"
}

Example:
User: "iphone mobiles"
Return: { "query": "iphone" }
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const parsed = JSON.parse(aiResponse.choices[0].message.content);

    // Keep exact user query for specific model-style searches (e.g. "Apple Mobile Model 9")
    const rawMessage = message.trim();
    const looksLikeSpecificModel =
      /\bmodel\b/i.test(rawMessage) || /\b\d+\b/.test(rawMessage);

    let searchQuery = looksLikeSpecificModel
      ? rawMessage
      : parsed.query || text;

    // Brand alias normalization for better catalog matching
    const normalized = searchQuery.trim().toLowerCase();
    if (normalized === "iphone" || normalized === "apple") {
      searchQuery = "apple";
    }

    /* -------------------------------------------------
       ✅ STEP 5: Agent Calls Store Products API
       Instead of MongoDB direct search
    ------------------------------------------------- */

    // Save query for Load More
    lastQuery = searchQuery;
    lastSkip = 0;

    // Call Store API Endpoint
    let storeUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/products?query=${searchQuery}&skip=0`;

    // Budget filter support
    if (budget !== null) {
      storeUrl += `&budget=${budget}`;
    }

    const storeRes = await fetch(storeUrl);
    const storeData = await storeRes.json();

    let matchedProducts = storeData.products;

    // Update skip for Load More
    lastSkip = storeData.nextSkip;

    /* -----------------------------
       ✅ STEP 6: No Matches
    ----------------------------- */
    if (!matchedProducts || matchedProducts.length === 0) {
      return Response.json({
        reply: `❌ Sorry, no products matched your query.`,
      });
    }

    /* -----------------------------
       ✅ STEP 7: Return Products + Load More Info
    ----------------------------- */
    pendingOptions = matchedProducts;
    selectedProduct = null;

    return Response.json({
      reply: "🛒 Available Mobiles:",
      products: matchedProducts.map((p) => ({
        id: p._id?.toString?.() ?? p._id ?? p.id,
        _id: p._id,
        name: p.name,
        price: p.price,
        currency: p.currency || "INR",
        currency_symbol: p.currency_symbol,
        brand: p.brand,
        image: p.image,
      })),

      // ✅ Load More Support
      nextSkip: storeData.nextSkip,
      hasMore: storeData.hasMore,
    });
  } catch (err) {
    console.error("Agent Error:", err);

    return Response.json({
      reply: "⚠️ Something went wrong. Please try again.",
    });
  }
}
