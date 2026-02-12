import OpenAI from "openai";
import { productsData } from "@/data/productsData";

import Order from "@/models/Order";
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
       ✅ STEP 0.5: ORDER TRACKING
       User: Track ORD_123456
    ----------------------------- */
    if (text.toLowerCase().includes("track")) {
      // Ensure uppercase for regex match
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
                  `• ${i.name} × ${i.quantity} - ${formatCurrency(i.currency)}${i.price * i.quantity}`
              )
              .join("\n")}

💰 Total Price: ${formatCurrency(order.items[0]?.currency || "USD")}${order.totalPrice}

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

      // Valid number selection
      if (!isNaN(choice) && choice >= 1 && choice <= pendingOptions.length) {
        selectedProduct = pendingOptions[choice - 1];

        return Response.json({
          reply: `✅ You selected: **${selectedProduct.name}**

💰 Price: ${formatCurrency(selectedProduct.currency)}${selectedProduct.price}
🎨 Color: ${selectedProduct.color}

Would you like to proceed to checkout? (Yes/No)`,
        });
      }

      // User typed new query instead of number → Reset ACP state
      pendingOptions = null;
      selectedProduct = null;
    }

    /* -----------------------------
       ✅ STEP 2: ACP Final Confirmation
    ----------------------------- */
    if (selectedProduct && text === "yes") {
      const product = selectedProduct;

      // Reset state after confirmation
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
       Example: under $700
    ----------------------------- */
    let budget = null;
    const budgetMatch = text.match(/under\s*\$?(\d+)/);

    if (budgetMatch) {
      budget = parseInt(budgetMatch[1]);
    }

    /* -----------------------------
       ✅ STEP 4: OpenAI Intent Matching
    ----------------------------- */
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You are a store assistant.

ONLY recommend products from this list:

${productsData.map((p) => `${p.name} (${p.currency}${p.price})`).join("\n")}

Return ONLY JSON:

{
  "matches": ["product names..."]
}

Rules:
- Never suggest products outside the store.
- If user asks Samsung, return all Samsung products.
- If user asks budget, return products within budget.
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const parsed = JSON.parse(aiResponse.choices[0].message.content);

    let matchedProducts = productsData.filter((p) =>
      parsed.matches.includes(p.name)
    );

    /* -----------------------------
       ✅ STEP 5: Apply Budget Filter
    ----------------------------- */
    if (budget !== null) {
      matchedProducts = matchedProducts.filter((p) => p.price <= budget);
    }

    /* -----------------------------
       ✅ STEP 6: No Matches
    ----------------------------- */
    if (matchedProducts.length === 0) {
      return Response.json({
        reply: `❌ Sorry, no products matched your query.

Available phones:
${productsData.map((p) => `• ${p.name}`).join("\n")}`,
      });
    }

    /* -----------------------------
       ✅ STEP 7: Show Options (ACP Begins)
    ----------------------------- */
    pendingOptions = matchedProducts;
    selectedProduct = null;

    // let reply = `🛒 Available Mobiles:\n\n`;

    // matchedProducts.forEach((p, i) => {
    //   reply += `${i + 1}. ${p.name} — ${formatCurrency(p.currency)}${p.price} — ${p.color}\n`;
    // });

    // reply += `\nReply with the product number to continue.`;


    return Response.json({
      reply: "🛒 Available Mobiles:",
      products: matchedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        color: p.color,
        image: p.image,
      })),
    });

  } catch (err) {
    console.error("Agent Error:", err);

    return Response.json({
      reply: "⚠️ Something went wrong. Please try again.",
    });
  }
}
