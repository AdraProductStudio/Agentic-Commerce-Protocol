"use client";

import { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

import { formatCurrency } from "@/lib/formatCurrency";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

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

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setErrorMsg(result.error.message);
    } else {
      setErrorMsg("");
      onSuccess();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handlePayment}>
      <PaymentElement />

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
  const [msg, setMsg] = useState("");

  const [chat, setChat] = useState([
    {
      role: "agent",
      text: "Hi 👋 I’m your shopping assistant. Ask me about mobiles!",
    },
  ]);
  const selectedProductRef = useRef(null);


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

  const [clientSecret, setClientSecret] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);

  const chatEndRef = useRef(null);

  /* Auto Scroll */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, showPayment]);

  /* ---------------- Send Message ---------------- */
  async function sendMessage() {
    if (!msg.trim()) return;

    const userMsg = msg;
    setMsg("");

    setChat((prev) => [...prev, { role: "user", text: userMsg }]);

    /* Checkout Form Input Mode */
    if (checkoutStep) {
      handleCheckoutInput(userMsg);
      return;
    }

    /* Normal Agent Message */
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg }),
    });

    const data = await res.json();

    setChat((prev) => [...prev, { role: "agent", text: data.reply }]);

    /* Start Checkout */
    if (data.action === "CHECKOUT") {

      // ✅ Save instantly in REF (MOST IMPORTANT)
      selectedProductRef.current = data.product;

      // Optional UI state
      setSelectedProduct(data.product);

      setChat(prev => [
        ...prev,
        { role: "agent", text: "🧾 Before checkout, please enter First Name:" }
      ]);

      setCheckoutStep("first_name");
    }

  }

  /* ---------------- Checkout Input Flow ---------------- */
  function handleCheckoutInput(input) {
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

    setBuyerData((prev) => ({
      ...prev,
      [checkoutStep]: input,
    }));

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
      setChat(prev => [
        ...prev,
        { role: "agent", text: "✅ Creating checkout session..." }
      ]);

      // ✅ USE REF ALWAYS
      const product = selectedProductRef.current;

      console.log("🔥 Product Used for Checkout:", product);

      if (!product || !product.id) {
        setChat(prev => [
          ...prev,
          { role: "agent", text: "❌ Product missing. Please restart checkout." }
        ]);
        return;
      }

      createCheckoutSession(product);
    }


    setCheckoutStep(nextStep);
  }

  /* ---------------- Create Checkout Session ---------------- */
  async function createCheckoutSession(product) {
    try {
      console.log("✅ Checkout Product:", product);

      if (!product?.id) {
        console.log("❌ Product is undefined!");
        return;
      }

      const acpPayload = {
        buyer: {
          first_name: buyerData.first_name,
          last_name: buyerData.last_name,
          email: buyerData.email,
        },
        items: [
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            currency: product.currency,
          },
        ],
        fulfillment_address: {
          name: buyerData.first_name + " " + buyerData.last_name,
          line_one: buyerData.address,
          city: buyerData.city,
          state: buyerData.state,
          country: buyerData.country,
          postal_code: buyerData.postal_code,
        },
      };

      const res = await fetch("/api/acp/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acpPayload),
      });

      const paymentData = await res.json();

      if (!res.ok) {
        console.log("❌ Backend Error:", paymentData.error);

        setChat(prev => [
          ...prev,
          { role: "agent", text: "❌ Checkout session failed: " + paymentData.error }
        ]);

        return; // ✅ STOP execution
      }

      setCheckoutSessionId(paymentData.checkout_session.id);
      setClientSecret(paymentData.clientSecret);
      setShowPayment(true);


    } catch (err) {
      console.error("❌ Checkout Session Error:", err);

      setChat(prev => [
        ...prev,
        { role: "agent", text: "❌ Checkout failed. Try again." }
      ]);
    }
  }


  /* ---------------- Payment Success ---------------- */
  async function handlePaymentSuccess() {
    setShowPayment(false);

    setChat((prev) => [
      ...prev,
      { role: "agent", text: "✅ Payment received! Confirming your order..." },
    ]);

    const res = await fetch("/api/orders/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: checkoutSessionId }),
    });

    const orderData = await res.json();

    console.log("✅ Order Confirmed:", orderData);

    const currencySymbol = formatCurrency(orderData.currency);
    console.log("currencySymbol",currencySymbol)

    const itemsText =
      orderData.items?.length > 0
        ? orderData.items
          .map(
            (i) =>
              `• ${i.name} × ${i.quantity} - ${currencySymbol}${i.price * i.quantity
              }`
          )
          .join("\n")
        : "No items found";

    const orderMessage = `🎉 Order Confirmed!

🆔 Order ID: ${orderData.order_id}
💳 Payment: ${orderData.payment_status}
🚚 Delivery: ${orderData.delivery_status}

🛒 Items Purchased:
${itemsText}

💰 Total: ${currencySymbol}${orderData.total_price}`;

    setChat((prev) => [...prev, { role: "agent", text: orderMessage }]);
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
        <div
          className="card shadow-lg"
          style={{
            position: "fixed",
            bottom: "90px",
            right: "20px",
            width: "370px",
            height: "520px",
            borderRadius: "15px",
          }}
        >
          <div className="card-header bg-dark text-white fw-bold">
            🤖 Shopping Assistant
          </div>

          <div
            className="card-body bg-light"
            style={{ overflowY: "auto", height: "340px" }}
          >
            {chat.map((c, i) => (
              <div
                key={i}
                className={`d-flex mb-2 ${c.role === "user"
                  ? "justify-content-end"
                  : "justify-content-start"
                  }`}
              >
                <div
                  className={`p-2 rounded-3 ${c.role === "user"
                    ? "bg-primary text-white"
                    : "bg-white border"
                    }`}
                  style={{ maxWidth: "75%", whiteSpace: "pre-line" }}
                >
                  {c.text}
                </div>
              </div>
            ))}

            {showPayment && clientSecret && (
              <div className="mt-3 p-2 bg-white border rounded">
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
                  <CheckoutForm onSuccess={handlePaymentSuccess} />
                </Elements>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="card-footer d-flex gap-2">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              className="form-control"
              placeholder="Type..."
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />

            <button
              className="btn btn-dark"
              onClick={sendMessage}
              disabled={!msg.trim()}
            >
              ➤
            </button>
          </div>

        </div>
      )}
    </>
  );
}
