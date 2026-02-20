"use client";

import { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

import { formatCurrency } from "@/lib/formatCurrency";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);
const AGENT_LOADING_TEXT = "Thinking...";
const ACP_API_VERSION = process.env.NEXT_PUBLIC_ACP_API_VERSION || "2026-01-30";
const ACP_PUBLIC_SECRET = process.env.NEXT_PUBLIC_ACP_SECRET_KEY;

function buildAcpHeaders(hasJsonBody = false) {
  const headers = {
    "API-Version": ACP_API_VERSION,
  };
  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }
  if (ACP_PUBLIC_SECRET) {
    headers.Authorization = `Bearer ${ACP_PUBLIC_SECRET}`;
  }
  return headers;
}

/* ---------------- Stripe Checkout Form ---------------- */
function CheckoutForm({ onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handlePayment(e) {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMsg("Card form is not ready yet.");
      setLoading(false);
      return;
    }

    const result = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (result.error || !result.paymentMethod) {
      setErrorMsg(result.error?.message || "Unable to create payment method.");
    } else {
      setErrorMsg("");
      onSuccess(result.paymentMethod.id);
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handlePayment}>
      <CardElement
        options={{
          hidePostalCode: true,
          style: {
            base: {
              fontSize: "16px",
            },
          },
        }}
      />

      {errorMsg && (
        <div className="alert alert-danger mt-2 p-2">{errorMsg}</div>
      )}

      <button
        className="btn btn-success w-100 mt-2"
        disabled={!stripe || loading}
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}

/* ---------------- Main Chat Widget ---------------- */
export default function ChatWidget() {
  const [open, setOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [msg, setMsg] = useState("");


  const [chat, setChat] = useState([
    {
      id: Date.now(), // ✅ Unique key
      role: "agent",
      text: "Hi 👋 I’m your shopping assistant. Ask me about mobiles!",
    },
  ]);

  const selectedProductRef = useRef(null);
  const [checkoutMode, setCheckoutMode] = useState(null);

  const [cart, setCart] = useState([]);
  const [showCartMenu, setShowCartMenu] = useState(false);


  const [selectedProduct, setSelectedProduct] = useState(null);

  const [checkoutStep, setCheckoutStep] = useState(null);

  const [buyerData, setBuyerData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
  });

  const [showPayment, setShowPayment] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const checkoutSessionIdRef = useRef(null);
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [checkoutPricing, setCheckoutPricing] = useState(null);
  const [isCheckoutSessionUpdating, setIsCheckoutSessionUpdating] = useState(false);



  const [skip, setSkip] = useState(0);
  const [lastQuery, setLastQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);


  const chatEndRef = useRef(null);
  const messageInputRef = useRef(null);

  function getProductId(product) {
    return product?.id ?? product?._id ?? null;
  }

  function syncCartFromCheckoutItems(items) {
    setCart((prev) => {
      const prevMap = new Map(prev.map((item) => [String(item.id), item]));
      return items.map((item) => {
        const existing = prevMap.get(String(item.id)) || {};
        return {
          ...existing,
          id: String(item.id),
          name: item.name || existing.name,
          price: item.unit_price ?? existing.price ?? 0,
          quantity: item.quantity,
          currency: item.currency || existing.currency || "USD",
        };
      });
    });
  }

  async function refreshCheckoutSession() {
    const sessionId = (checkoutSessionIdRef.current || checkoutSessionId || "").trim();
    if (!sessionId) return;
    console.log("[ChatWidget] GET /api/acp/checkout_sessions/:id", { sessionId });

    setIsCheckoutSessionUpdating(true);
    try {
      const res = await fetch(
        `/api/acp/checkout_sessions/${encodeURIComponent(sessionId)}`,
        {
          headers: buildAcpHeaders(),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setChat((prev) => [
          ...prev,
          { role: "agent", text: `❌ Unable to refresh checkout: ${data.error}` },
        ]);
        return;
      }

      const session = data.checkout_session || {};
      const items = session.items || [];
      setCheckoutItems(items);
      setCheckoutPricing(session.pricing || null);
      syncCartFromCheckoutItems(items);
    } catch {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Unable to refresh checkout right now." },
      ]);
    } finally {
      setIsCheckoutSessionUpdating(false);
    }
  }

  async function updateCheckoutItems(nextItems) {
    const sessionId = (checkoutSessionIdRef.current || checkoutSessionId || "").trim();
    if (!sessionId || nextItems.length === 0) return;
    console.log("[ChatWidget] POST /api/acp/checkout_sessions/:id", {
      sessionId,
      items: nextItems.map((item) => ({ id: String(item.id), quantity: item.quantity })),
    });

    setIsCheckoutSessionUpdating(true);
    try {
      const res = await fetch(`/api/acp/checkout_sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: buildAcpHeaders(true),
        body: JSON.stringify({
          items: nextItems.map((item) => ({
            id: String(item.id),
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChat((prev) => [
          ...prev,
          { role: "agent", text: `❌ Unable to update checkout: ${data.error}` },
        ]);
        return;
      }

      const session = data.checkout_session || {};
      const items = session.items || [];
      setCheckoutItems(items);
      setCheckoutPricing(session.pricing || null);
      syncCartFromCheckoutItems(items);
    } catch {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Unable to update checkout right now." },
      ]);
    } finally {
      setIsCheckoutSessionUpdating(false);
    }
  }

  function changeCheckoutItemQuantity(itemId, delta) {
    if (isCheckoutSessionUpdating) return;
    const nextItems = checkoutItems
      .map((item) =>
        String(item.id) === String(itemId)
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      );

    updateCheckoutItems(nextItems);
  }

  function buildCheckoutSummary(items) {
    if (!items || items.length === 0) {
      return {
        totalQuantity: 0,
        totalPrice: 0,
        currency: "USD",
        text: "❌ No items found for checkout.",
      };
    }

    const currency = items[0]?.currency || "USD";
    const totalQuantity = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );
    const totalPrice = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0
    );

    const itemsText = items
      .map((item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.price) || 0;
        const lineTotal = unitPrice * quantity;
        const symbol = formatCurrency(item.currency || currency);
        return `• ${item.name}
  Unit Price: ${symbol}${unitPrice}
  Quantity: ${quantity}
  Line Total: ${symbol}${lineTotal}`;
      })
      .join("\n\n");

    return {
      totalQuantity,
      totalPrice,
      currency,
      text: `🛒 Items to Purchase:
${itemsText}

🔢 Total Quantity: ${totalQuantity}
💰 Total Price: ${formatCurrency(currency)}${totalPrice}

Reply "Yes" to continue checkout or "No" to cancel.`,
    };
  }

  function startCheckoutConfirmation(items, mode) {
    const normalizedItems = items.map((item) => ({
      ...item,
      id: getProductId(item),
      quantity: Number(item.quantity) || 1,
    }));

    const invalidItem = normalizedItems.find((item) => !item.id);
    if (invalidItem || normalizedItems.length === 0) {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Unable to start checkout. Item data is invalid." },
      ]);
      return;
    }

    if (mode === "BUY_NOW") {
      selectedProductRef.current = normalizedItems[0];
      setSelectedProduct(normalizedItems[0]);
    }

    const summary = buildCheckoutSummary(normalizedItems);
    setCheckoutMode(mode);
    setChat((prev) => [...prev, { role: "agent", text: summary.text }]);
    setCheckoutStep("checkout_confirm");
  }

  /* Auto Scroll */
  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 100);
  }, [chat, showPayment]);

  useEffect(() => {
    if (!isAgentLoading) {
      messageInputRef.current?.focus();
    }
  }, [isAgentLoading]);

  /* ---------------- Send Message ---------------- */

  /* ---------------- Load More Products ---------------- */
  async function loadMoreProducts() {
    if (!lastQuery || loadingMore) return;

    setLoadingMore(true);

    try {
      console.log("[ChatWidget] GET /api/products", { query: lastQuery, skip });
      const res = await fetch(
        `/api/products?query=${lastQuery}&skip=${skip}`
      );

      const result = await res.json();

      // ✅ Append new products into last agent message
      setChat((prev) => {
        const updated = [...prev];

        // Find last agent message with products
        const lastAgentIndex = updated
          .map((m) => m.role)
          .lastIndexOf("agent");

        if (lastAgentIndex !== -1) {
          updated[lastAgentIndex].products = [
            ...(updated[lastAgentIndex].products || []),
            ...result.products, // ✅ correct key
          ];
        }

        return updated;
      });

      // ✅ Update skip + hasMore
      setSkip(result.nextSkip);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("Load more error:", err);
    }

    setLoadingMore(false);
  }


  async function sendMessage() {
    if (!msg.trim() || isAgentLoading) return;

    const userMsg = msg;
    // Reset pagination on new search
    setSkip(0);
    setHasMore(false);
    setLastQuery(userMsg);
    setMsg("");

    setChat((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(), // ✅ unique id
        role: "user",
        text: userMsg,
      },
    ]);


    /* Checkout Form Input Mode */
    if (checkoutStep) {
      handleCheckoutInput(userMsg);
      messageInputRef.current?.focus();
      return;
    }

    const normalizedInput = userMsg.trim().toLowerCase();
    const isCancelCommand =
      normalizedInput === "cancel" ||
      normalizedInput === "cancel checkout" ||
      normalizedInput === "stop checkout" ||
      normalizedInput === "abort checkout";

    if (showPayment && isCancelCommand) {
      await cancelActiveCheckout();
      messageInputRef.current?.focus();
      return;
    }

    /* Normal Agent Message */
    try {
      setIsAgentLoading(true);
      console.log("[ChatWidget] POST /api/agent", { message: userMsg });

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      const data = await res.json();

      setChat((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(), // ✅ unique id
          role: "agent",
          text: data.reply,
          products: data.products || [],
        },
      ]);

      // ✅ Save pagination info
      if (data.hasMore) {
        setHasMore(true);
        setSkip(data.nextSkip);
        setLastQuery(userMsg);
      } else {
        setHasMore(false);
      }







      /* Start Checkout */
      if (data.action === "CHECKOUT") {
        startCheckoutConfirmation([{ ...data.product, quantity: 1 }], "BUY_NOW");
      }
    } catch (err) {
      console.error("Agent fetch error:", err);
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "⚠️ Agent is taking too long. Please try again." },
      ]);
    } finally {
      setIsAgentLoading(false);
    }
  }



  /* ---------------- Checkout Input Flow ---------------- */
  function handleCheckoutInput(input) {
    const normalizedInput = input.trim().toLowerCase();

    if (checkoutStep === "checkout_confirm") {
      if (["yes", "y"].includes(normalizedInput)) {
        setChat((prev) => [
          ...prev,
          { role: "agent", text: "🧾 Before checkout, please enter First Name:" },
        ]);
        setCheckoutStep("first_name");
        return;
      }

      if (["no", "n"].includes(normalizedInput)) {
        setChat((prev) => [
          ...prev,
          { role: "agent", text: "❌ Checkout cancelled." },
        ]);
        setCheckoutStep(null);
        setCheckoutMode(null);
        selectedProductRef.current = null;
        setSelectedProduct(null);
        return;
      }

      setChat((prev) => [
        ...prev,
        { role: "agent", text: 'Please reply with "Yes" or "No".' },
      ]);
      return;
    }

    const nextStepMap = {
      first_name: "last_name",
      last_name: "email",
      email: "address",
      address: "city",
      city: "state",
      state: "country",
      country: "postal_code",
      postal_code: null,
    };

    const updatedBuyerData = {
      ...buyerData,
      [checkoutStep]: input,
    };
    setBuyerData(updatedBuyerData);

    const nextStep = nextStepMap[checkoutStep];

    /* Ask Next Question */
    if (nextStep) {
      const questionMap = {
        last_name: "Last Name?",
        email: "Email Address?",
        address: "Address Line 1?",
        city: "City?",
        state: "State?",
        country: "Country?",
        postal_code: "Postal Code?",
      };

      setChat((prev) => [
        ...prev,
        { role: "agent", text: questionMap[nextStep] },
      ]);
    }

    /* Final Step → Create Checkout */
    else {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "✅ Creating checkout session..." },
      ]);

      // ✅ Decide items based on mode
      let itemsToBuy = [];

      if (checkoutMode === "BUY_NOW") {
        itemsToBuy = [{ ...selectedProductRef.current, quantity: 1 }];
      }

      if (checkoutMode === "CART") {
        itemsToBuy = cart;
      }

      createCheckoutSession(itemsToBuy, updatedBuyerData);
    }



    setCheckoutStep(nextStep);
  }

  /* ---------------- Add Product to Cart Function ---------------- */

  function addToCart(product) {
    setCart((prev) => {
      const productId = getProductId(product);
      if (!productId) return prev;

      const exists = prev.find((x) => x.id === productId);

      if (exists) {
        return prev.map((x) =>
          x.id === productId
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }

      return [...prev, { ...product, id: productId, quantity: 1 }];
    });

    setChat((prev) => [
      ...prev,
      {
        role: "agent",
        text: `✅ ${product.name} added to cart 🛒`,
      },
    ]);
  }

  /* ---------------- Remove Product to Cart Function ---------------- */

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((item) => item.id !== productId));

    setChat((prev) => [
      ...prev,
      { role: "agent", text: "❌ Product removed from cart" },
    ]);
  }




  /* ---------------- View Cart Function ---------------- */

  function viewCart() {
    if (cart.length === 0) {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "🛒 Your cart is empty!" },
      ]);
      return;
    }

    const cartText = cart
      .map((item) => `• ${item.name} × ${item.quantity}`)
      .join("\n");

    setChat((prev) => [
      ...prev,
      {
        role: "agent",
        text: `🛒 Cart Items:\n\n${cartText}`,
        showCheckoutButton: true,
      },
    ]);
  }


  /* ----------------Start checkout Session ---------------- */

  function startCheckout() {
    startCheckoutConfirmation(cart, "CART");
  }




  /* ----------------Add Buy Now (Direct Checkout)---------------- */

  function buyNow(product) {
    startCheckoutConfirmation([{ ...product, quantity: 1 }], "BUY_NOW");
  }



  /* ----------------Add Checkout Cart Flow---------------- */
  function checkoutCart() {
    if (cart.length === 0) {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "🛒 Your cart is empty!" },
      ]);
      return;
    }

    startCheckoutConfirmation(cart, "CART");
  }





  /* ---------------- Create Checkout Session ---------------- */
  /* ---------------- Create Checkout Session ---------------- */
  async function createCheckoutSession(itemsToBuy, buyerInfo = buyerData) {
    try {
      console.log("✅ Items Going for Checkout:", itemsToBuy);

      if (!itemsToBuy || itemsToBuy.length === 0) {
        setChat((prev) => [
          ...prev,
          { role: "agent", text: "❌ No items found for checkout." },
        ]);
        return;
      }

      // ACP Payload
      const acpPayload = {
        buyer: {
          first_name: buyerInfo.first_name,
          last_name: buyerInfo.last_name,
          email: buyerInfo.email,
        },

        items: itemsToBuy.map((item) => ({
          id: item.id,
          quantity: item.quantity || 1,
        })),

        fulfillment_address: {
          name: buyerInfo.first_name + " " + buyerInfo.last_name,
          line_one: buyerInfo.address,
          city: buyerInfo.city,
          state: buyerInfo.state,
          country: buyerInfo.country,
          postal_code: buyerInfo.postal_code,
        },
      };

      console.log("📦 ACP Payload Sent:", acpPayload);
      console.log("[ChatWidget] POST /api/acp/checkout_sessions", {
        itemCount: acpPayload.items.length,
        buyerEmail: acpPayload.buyer.email,
      });

      // Call backend
      const res = await fetch("/api/acp/checkout_sessions", {
        method: "POST",
        headers: buildAcpHeaders(true),
        body: JSON.stringify(acpPayload),
      });


      const paymentData = await res.json();

      console.log("🔥 Full Checkout Response:", paymentData);

      // Handle backend error
      if (!res.ok) {
        setChat((prev) => [
          ...prev,
          {
            role: "agent",
            text: "❌ Checkout session failed: " + paymentData.error,
          },
        ]);
        return;
      }

      // ✅ Extract Session ID correctly
      const sessionId =
        paymentData.checkout_session?.id ||
        paymentData.checkout_session_id ||
        paymentData.session_id;

      if (!sessionId) {
        console.log("❌ No Session ID returned!");
        setChat((prev) => [
          ...prev,
          { role: "agent", text: "❌ Session ID missing from backend." },
        ]);
        return;
      }

      // ✅ Save session id
      const rawSessionId = String(sessionId);
      const extractedSessionId = rawSessionId.match(/cs_\d+/)?.[0];
      const normalizedSessionId = (extractedSessionId || rawSessionId).trim();
      checkoutSessionIdRef.current = normalizedSessionId;
      setCheckoutSessionId(normalizedSessionId);
      setCheckoutItems(paymentData.checkout_session?.items || []);
      setCheckoutPricing(paymentData.checkout_session?.pricing || null);

      setShowPayment(true);

      setChat((prev) => [
        ...prev,
        { role: "agent", text: "💳 Please complete payment below 👇" },
      ]);
    } catch (err) {
      console.error("❌ Checkout Session Error:", err);

      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Checkout failed. Try again." },
      ]);
    }
  }

  async function cancelActiveCheckout() {
    const sessionId = (
      checkoutSessionIdRef.current ||
      checkoutSessionId ||
      ""
    ).trim();

    if (!sessionId) {
      setShowPayment(false);
      setCheckoutStep(null);
      setCheckoutMode(null);
      setSelectedProduct(null);
      selectedProductRef.current = null;
      setCheckoutItems([]);
      setCheckoutPricing(null);
      return;
    }

    setIsCheckoutSessionUpdating(true);
    try {
      console.log("[ChatWidget] POST /api/acp/checkout_sessions/:id/cancel", {
        sessionId,
      });
      const res = await fetch(
        `/api/acp/checkout_sessions/${encodeURIComponent(sessionId)}/cancel`,
        {
          method: "POST",
          headers: buildAcpHeaders(),
        }
      );

      const cancelData = await res.json();

      if (!res.ok) {
        setChat((prev) => [
          ...prev,
          {
            role: "agent",
            text: `❌ Unable to cancel checkout: ${cancelData.error || "Unknown error"}`,
          },
        ]);
        return;
      }

      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Checkout cancelled successfully." },
      ]);
    } catch (err) {
      console.error("❌ Cancel Checkout Error:", err);
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Unable to cancel checkout right now." },
      ]);
    } finally {
      setShowPayment(false);
      setCheckoutStep(null);
      setCheckoutMode(null);
      setSelectedProduct(null);
      selectedProductRef.current = null;
      setCheckoutSessionId(null);
      checkoutSessionIdRef.current = null;
      setCheckoutItems([]);
      setCheckoutPricing(null);
      setIsCheckoutSessionUpdating(false);
    }
  }




  /* ---------------- Payment Success ---------------- */
  async function handlePaymentSuccess(paymentToken) {
    setShowPayment(false);
    const sessionId = (
      checkoutSessionIdRef.current ||
      checkoutSessionId ||
      ""
    ).trim();

    // ✅ Ensure session exists
    if (!sessionId) {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Session missing. Cannot confirm order." },
      ]);
      return;
    }

    setChat((prev) => [
      ...prev,
      { role: "agent", text: "✅ Payment received! Confirming order..." },
    ]);

    try {
      console.log("[ChatWidget] POST /api/acp/checkout_sessions/:id/complete", {
        sessionId,
        provider: "stripe",
      });
      const res = await fetch(
        `/api/acp/checkout_sessions/${encodeURIComponent(sessionId)}/complete`,
        {
          method: "POST",
          headers: buildAcpHeaders(true),
          body: JSON.stringify({
            checkout_session_id: sessionId,
            buyer: {
              first_name: buyerData.first_name,
              last_name: buyerData.last_name,
              email: buyerData.email,
            },
            payment_data: {
              token: paymentToken,
              provider: "stripe",
            },
          }),
        }
      );

      const orderData = await res.json();

      console.log("🔥 Confirm API Response:", orderData);

      // ✅ Handle backend confirm error
      if (!res.ok) {
        const detailedMsg = orderData.messages?.[0]?.text;
        setChat((prev) => [
          ...prev,
          {
            role: "agent",
            text:
              "❌ Order confirmation failed: " +
              (detailedMsg || orderData.error || "Unknown error"),
          },
        ]);
        return;
      }

      // ✅ Currency + Totals
      const order = orderData.order || {};
      const items = order.items || [];
      const currency = order.currency || items[0]?.currency || "INR";
      const currencySymbol = formatCurrency(currency);
      const totalQuantity = items.reduce(
        (sum, i) => sum + (Number(i.quantity) || 0),
        0
      );
      const calculatedTotalPrice = items.reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0
      );
      const totalPrice =
        calculatedTotalPrice > 0
          ? calculatedTotalPrice
          : Number(order.total_price) || 0;

      // ✅ Items Purchased Text
      const itemsText =
        items.length > 0
          ? items
            .map((i) => {
              const quantity = Number(i.quantity) || 0;
              const unitPrice = Number(i.price) || 0;
              const lineTotal = unitPrice * quantity;
              const symbol = formatCurrency(i.currency || currency);
              return `• ${i.name}
  Unit Price: ${symbol}${unitPrice}
  Quantity: ${quantity}
  Line Total: ${symbol}${lineTotal}`;
            })
            .join("\n\n")
          : "No items found";

      // ✅ Final Message
      const orderMessage = `🎉 Order Confirmed!

🆔 Order ID: ${order.id}
💳 Payment: ${order.payment_status}
🚚 Delivery: ${order.delivery_status}

🛒 Items Purchased:
${itemsText}

🔢 Total Quantity: ${totalQuantity}
💰 Total Price: ${currencySymbol}${totalPrice}`;

      setChat((prev) => [...prev, { role: "agent", text: orderMessage }]);

      // ✅ Clear Cart after successful payment
      setCart([]);
      setCheckoutItems([]);
      setCheckoutPricing(null);
      setCheckoutSessionId(null);
      checkoutSessionIdRef.current = null;
    } catch (err) {
      console.error("❌ Confirm Order Error:", err);

      setChat((prev) => [
        ...prev,
        { role: "agent", text: "❌ Something went wrong confirming your order." },
      ]);
    }
  }


  /* ---------------- UI Render ---------------- */
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-dark rounded-circle"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "60px",
          height: "60px",
          zIndex: 9999,
        }}
      >
        💬
      </button>

      {open && (
        <>
          {isFullscreen && (
            <div
              onClick={() => setIsFullscreen(false)}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                zIndex: 9997,
              }}
            />
          )}

          <div
            className="card shadow-lg"
            style={{
              position: "fixed",
              bottom: isFullscreen ? "5vh" : "90px",
              right: isFullscreen ? "5vw" : "20px",
              width: isFullscreen ? "90vw" : "370px",
              height: isFullscreen ? "90vh" : "520px",
              borderRadius: "15px",
              display: "flex",
              flexDirection: "column",
              zIndex: 9998,
            }}
          >
            <div className="card-header bg-dark text-white fw-bold w-100 d-flex justify-content-between align-items-center px-3">

              {/* Left Side Title */}
              <div className="d-flex align-items-center">
                🤖 Shopping Assistant
              </div>

              {/* Right Side Buttons */}
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  className="btn btn-sm btn-outline-light"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                >
                  {isFullscreen ? "🗗" : "⛶"}
                </button>

                {/* ✅ Show Cart Button ONLY when menu is closed */}
                {!showCartMenu && (
                  <button
                    type="button"
                    title="Cart"

                    className="btn btn-sm btn-warning position-relative d-flex align-items-center justify-content-center"
                    onClick={() => {
                      if (cart.length === 0) return;
                      setShowCartMenu(true);
                    }}
                  >
                    🛒

                    {/* Badge */}
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                      {cart.length}
                    </span>
                  </button>
                )}

                {/* ✅ Show ONLY View + Checkout when menu is open */}
                {showCartMenu && (
                  <div className="d-flex align-items-center gap-2">

                    {/* View Button */}
                    <button
                      title="View cart"
                      className="btn btn-sm btn-light px-3"
                      onClick={() => {
                        viewCart();
                        setShowCartMenu(false); // close after click
                      }}
                    >
                      🛒
                    </button>

                    {/* Checkout Button */}
                    <button
                      className="btn btn-sm btn-success px-3"
                      onClick={() => {
                        checkoutCart();
                        setShowCartMenu(false); // close after click
                      }}
                      disabled={cart.length === 0}
                      title="Checkout cart"
                    >
                      Checkout
                    </button>

                  </div>
                )}
              </div>

            </div>





            <div
              className="card-body bg-light"
              style={{ overflowY: "auto", flex: 1, minHeight: 0 }}
            >
              {chat.map((c, i) => (
                <div key={c.id ?? `chat-${i}`}>
                  {/* Normal Message */}
                  <div
                    className={`d-flex mb-2 ${c.role === "user"
                      ? "justify-content-end"
                      : "justify-content-start"
                      }`}
                  >
                    <div style={{ maxWidth: "75%" }}>
                      <div
                        className={`p-2 rounded-3 ${c.role === "user"
                          ? "bg-primary text-white"
                          : "bg-white border"
                          }`}
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {c.text}
                      </div>

                      {c.showCheckoutButton && (
                        <button
                          type="button"
                          className="btn btn-success btn-sm mt-2"
                          onClick={checkoutCart}
                        >
                          Checkout
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Product List */}
                  {c.products?.length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {c.products.map((p, pi) => {
                        const productId = getProductId(p);
                        const inCart = !!productId && cart.some((item) => item.id === productId);
                        const productKey = `product-${c.id ?? i}-${productId ?? "no-id"}-${pi}`;
                        const productCurrencySymbol =
                          p.currency_symbol || formatCurrency(p.currency || "INR");

                        return (
                          <div
                            key={productKey}
                            className="border rounded p-2 bg-white text-center"
                            style={{
                              width: isFullscreen ? "clamp(180px, 30%, 260px)" : "75%",
                              flexGrow: isFullscreen ? 1 : 0,
                            }}
                          >
                            <img
                              src={p.image}
                              alt={p.name}
                              style={{
                                width: "100%",
                                maxWidth: "140px",
                                aspectRatio: "1 / 1",
                                objectFit: "cover",
                                borderRadius: "10px",
                              }}
                            />

                            <h6 className="mt-2">{p.name}</h6>

                            <p className="fw-bold text-success">
                              {productCurrencySymbol}{p.price}
                            </p>

                            <div className="d-flex gap-2">
                              <button
                                className={`btn btn-sm w-50 ${inCart ? "btn-danger" : "btn-outline-primary"
                                  }`}
                                onClick={() => {
                                  if (inCart) {
                                    removeFromCart(productId);
                                  } else {
                                    addToCart(p);
                                  }
                                }}
                              >
                                {inCart ? "❌ Remove" : "🛒 Add"}
                              </button>

                              <button
                                className="btn btn-sm btn-success w-50"
                                onClick={() => buyNow(p)}
                              >
                                ⚡ Buy
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ✅ Load More Button */}
                  {i === chat.length - 1 && hasMore && (
                    <div className="text-center mt-2">
                      <button
                        className="btn btn-outline-dark btn-sm"
                        onClick={loadMoreProducts}
                        disabled={loadingMore}
                      >
                        {loadingMore ? "Loading..." : "Load More Products"}
                      </button>
                    </div>
                  )}


                </div>
              ))}

              {isAgentLoading && (
                <div className="d-flex mb-2 justify-content-start">
                  <div style={{ maxWidth: "75%" }}>
                    <div className="p-2 rounded-3 bg-white border">
                      {AGENT_LOADING_TEXT}
                    </div>
                  </div>
                </div>
              )}

              {showPayment && (
                <div className="mt-3 p-2 bg-white border rounded">
                  {checkoutItems.length > 0 && (
                    <div className="mb-2 p-2 border rounded bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <b>Checkout Items</b>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={refreshCheckoutSession}
                          disabled={isCheckoutSessionUpdating}
                        >
                          {isCheckoutSessionUpdating ? "Refreshing..." : "Refresh"}
                        </button>
                      </div>

                      {checkoutItems.map((item) => {
                        const symbol = formatCurrency(item.currency || "USD");
                        return (
                          <div
                            key={`checkout-item-${item.id}`}
                            className="d-flex justify-content-between align-items-center mb-2"
                          >
                            <div>
                              <div className="fw-semibold">{item.name}</div>
                              <small className="text-muted">
                                {symbol}{item.unit_price} each
                              </small>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-dark"
                                onClick={() => changeCheckoutItemQuantity(item.id, -1)}
                                disabled={isCheckoutSessionUpdating || item.quantity <= 1}
                              >
                                -
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-dark"
                                onClick={() => changeCheckoutItemQuantity(item.id, 1)}
                                disabled={isCheckoutSessionUpdating}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {checkoutPricing && (
                        <div className="mt-2">
                          <small className="text-muted d-block">
                            Subtotal: {formatCurrency(checkoutPricing.currency || "USD")}
                            {checkoutPricing.subtotal}
                          </small>
                          <small className="text-muted d-block">
                            Shipping: {formatCurrency(checkoutPricing.currency || "USD")}
                            {checkoutPricing.shipping}
                          </small>
                          <b>
                            Total: {formatCurrency(checkoutPricing.currency || "USD")}
                            {checkoutPricing.total}
                          </b>
                        </div>
                      )}
                    </div>
                  )}

                  <Elements stripe={stripePromise}>
                    <CheckoutForm onSuccess={handlePaymentSuccess} />
                  </Elements>
                  <button
                    type="button"
                    className="btn btn-outline-danger w-100 mt-2"
                    onClick={cancelActiveCheckout}
                    disabled={isCheckoutSessionUpdating}
                  >
                    {isCheckoutSessionUpdating ? "Cancelling..." : "Cancel Checkout"}
                  </button>
                </div>
              )}




              <div ref={chatEndRef} />
            </div>

            <div className="card-footer d-flex gap-2">
              <textarea
                ref={messageInputRef}
              style={{resize:'none'}}
                autoFocus
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                className="form-control"
                placeholder="Type..."
                disabled={isAgentLoading}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault(); // prevent newline
                    sendMessage();
                  }
                }}
              />


              <button
                className="btn btn-dark"
                onClick={sendMessage}
                disabled={!msg.trim() || isAgentLoading}
              >
                ➤
              </button>
            </div>

          </div>
        </>
      )}
    </>
  );
}
