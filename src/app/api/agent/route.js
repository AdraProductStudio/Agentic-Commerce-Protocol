import OpenAI from "openai";
import { productsData } from "@/data/productsData";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* -----------------------------
   ACP State Memory
----------------------------- */
let pendingOptions = null; // list shown to user
let selectedProduct = null; // chosen product

/* -----------------------------
   POST Agent Route
----------------------------- */
export async function POST(req) {
  try {
    const { message } = await req.json();
    const text = message.trim().toLowerCase();

    /* -----------------------------
       Step 0: Greetings
    ----------------------------- */
    if (["hi", "hello", "hey"].includes(text)) {
      return Response.json({
        reply: "👋 Hi! Ask me about mobiles available in our store.",
      });
    }

    /* -----------------------------
   Step 1: ACP Product Selection
   User must reply with number
----------------------------- */
if (pendingOptions && !selectedProduct) {
  const choice = parseInt(text);

  // ✅ Case 1: User picked valid number
  if (!isNaN(choice) && choice >= 1 && choice <= pendingOptions.length) {
    selectedProduct = pendingOptions[choice - 1];

    return Response.json({
      reply: `✅ You selected: **${selectedProduct.name}**

Price: $${selectedProduct.price}
Color: ${selectedProduct.color}

Would you like to proceed to checkout? (Yes/No)`,
    });
  }

  // ✅ Case 2: User typed a new query instead of number
  // Example: "iphone", "show samsung", "under 600"
  // Reset ACP state so agent can search again
  pendingOptions = null;
  selectedProduct = null;

  // ✅ IMPORTANT:
  // Do NOT return here.
  // Let the request continue to OpenAI search below.
}


    /* -----------------------------
       Step 2: ACP Final Confirmation
    ----------------------------- */
    if (selectedProduct && text === "yes") {
      const product = selectedProduct;

      // reset state
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
       Step 3: Detect Budget Query
    ----------------------------- */
    let budget = null;
    const budgetMatch = text.match(/under\s*\$?(\d+)/);

    if (budgetMatch) {
      budget = parseInt(budgetMatch[1]);
    }

    /* -----------------------------
       Step 4: OpenAI Intent Matching
       Only from Store Products
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

${productsData.map((p) => `${p.name} ($${p.price})`).join("\n")}

User may ask:
- "samsung"
- "show samsung mobiles"
- "suggest under $600"

Return ONLY JSON:

{
  "matches": ["product names..."]
}

Rules:
- Never suggest products outside the store.
- If user asks brand like Samsung, return all Samsung products.
- If user asks budget, return only products within budget.
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
       Step 5: Apply Budget Filter Locally
    ----------------------------- */
    if (budget !== null) {
      matchedProducts = matchedProducts.filter((p) => p.price <= budget);
    }

    /* -----------------------------
       Step 6: No Matches
    ----------------------------- */
    if (matchedProducts.length === 0) {
      return Response.json({
        reply: `❌ Sorry, no products matched your query.

Available phones:
${productsData.map((p) => `• ${p.name}`).join("\n")}`,
      });
    }

    /* -----------------------------
       Step 7: Show Options (ACP Start)
    ----------------------------- */
    pendingOptions = matchedProducts;
    selectedProduct = null;

    let reply = `🛒 Here are the available mobiles:\n\n`;

    matchedProducts.forEach((p, i) => {
      reply += `${i + 1}. ${p.name} — $${p.price} — ${p.color}\n`;
    });

    reply += `\nReply with the product number to continue.`;

    return Response.json({ reply });
  } catch (err) {
    console.error("Agent Error:", err);

    return Response.json({
      reply: "⚠️ Something went wrong. Please try again.",
    });
  }
}
