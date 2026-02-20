// import "@/lib/cancelExpiredSessions";
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
let lastBudget = null;

/* -----------------------------
   POST Agent Route
----------------------------- */
export async function POST(req) {
  try {
    const { message } = await req.json();
    const text = message.trim().toLowerCase();
    console.log("[API] POST /api/agent", { message });

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
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/products?query=${encodeURIComponent(
          lastQuery
        )}&skip=${lastSkip}${lastBudget !== null ? `&budget=${lastBudget}` : ""}`
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
      console.log("[API] /api/agent -> track branch");
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

        const totalQuantity = order.items.reduce(
          (sum, i) => sum + (Number(i.quantity) || 0),
          0
        );
        const calculatedTotalPrice = order.items.reduce(
          (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
          0
        );
        const totalPrice =
          calculatedTotalPrice > 0
            ? calculatedTotalPrice
            : Number(order.totalPrice) || 0;

        return Response.json({
          reply: `📦 Order Found Successfully!

✅ Order ID: ${order.orderId}
💳 Payment Status: ${order.paymentStatus}
🚚 Delivery Status: ${order.status}

🛒 Items Purchased:
${order.items
  .map((i) => {
    const quantity = Number(i.quantity) || 0;
    const unitPrice = Number(i.price) || 0;
    const lineTotal = unitPrice * quantity;
    const symbol = formatCurrency(i.currency);
    return `• ${i.name}
  Unit Price: ${symbol}${unitPrice}
  Quantity: ${quantity}
  Line Total: ${symbol}${lineTotal}`;
  })
  .join("\n\n")}

🔢 Total Quantity: ${totalQuantity}
💰 Total Price: ${formatCurrency(
            order.items[0]?.currency || "USD"
          )}${totalPrice}

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
       ✅ STEP 4: OpenAI Intent + Query Understanding
    ------------------------------------------------- */
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You are the intent parser for a mobile shopping assistant.

Return ONLY valid JSON with this shape:
{
  "intent": "product_search" | "conversation",
  "query": "string",
  "reply": "string"
}

Rules:
- Use "product_search" when user is asking to buy/find/recommend/compare mobiles, brands, models, specs, or price-range options.
- Use "conversation" for greetings, thanks, small talk, unclear text, or unrelated requests.
- For "product_search": return a concise catalog-friendly query in "query"; keep "reply" empty.
- For "conversation": keep "query" empty and return a short helpful assistant reply in "reply" that guides user back to shopping.
- Never return markdown or extra text outside JSON.

Examples:
User: "hiiiiiiii"
Return: {"intent":"conversation","query":"","reply":"Hi! I can help you find mobiles. Tell me your budget, brand, or preferred features."}
User: "show samsung under 30000"
Return: {"intent":"product_search","query":"samsung","reply":""}
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    let parsed = {};
    try {
      parsed = JSON.parse(aiResponse.choices[0].message.content || "{}");
    } catch (e) {
      console.warn("[API] /api/agent -> intent parse failed", e);
    }

    const intent = parsed.intent === "conversation" ? "conversation" : "product_search";
    console.log("[API] /api/agent -> OpenAI intent done", {
      intent,
      query: parsed.query,
    });

    if (intent === "conversation") {
      return Response.json({
        reply:
          parsed.reply ||
          "I can help you buy mobiles. Tell me your budget, preferred brand, or camera/battery requirements.",
      });
    }

    // Keep exact user query for specific model-style searches (e.g. "Apple Mobile Model 9")
    const rawMessage = message.trim();
    const hasBudgetPhrase =
      /\b(under|below|less than|upto|up to|within|budget)\b/i.test(rawMessage);
    const looksLikeSpecificModel =
      /\bmodel\s*[a-z0-9-]*\d+[a-z0-9-]*\b/i.test(rawMessage) &&
      !hasBudgetPhrase;

    let searchQuery = looksLikeSpecificModel
      ? rawMessage
      : (parsed.query || "").trim() || text;

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
    lastBudget = budget;

    // Call Store API Endpoint
    let storeUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/products?query=${encodeURIComponent(
      searchQuery
    )}&skip=0`;

    // Budget filter support
    if (budget !== null) {
      storeUrl += `&budget=${budget}`;
    }

    const storeRes = await fetch(storeUrl);
    const storeData = await storeRes.json();
    console.log("[API] /api/agent -> /api/products fetched", {
      query: searchQuery,
      count: storeData.products?.length || 0,
      nextSkip: storeData.nextSkip,
      hasMore: storeData.hasMore,
    });

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
