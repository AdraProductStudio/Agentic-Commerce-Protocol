"use client";

import { useState, useEffect, useRef } from "react";

/* ✅ Stripe Imports */
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

/* ---------------------------------------
   Stripe Public Key Loader
---------------------------------------- */
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

/* ---------------------------------------
   Payment Form Component (Inside Chat)
---------------------------------------- */
function CheckoutForm({ clientSecret, onSuccess }) {
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
      confirmParams: {
        return_url: window.location.href, // optional
      },
      redirect: "if_required", // ✅ No redirect
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

/* ---------------------------------------
   MAIN CHAT WIDGET
---------------------------------------- */
export default function ChatWidget() {
  const [open, setOpen] = useState(true);

  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([
    {
      role: "agent",
      text: "Hi 👋 I’m your shopping assistant. Ask me about mobiles!",
    },
  ]);

  /* ✅ Payment State */
  const [clientSecret, setClientSecret] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  /* ✅ Scroll Ref */
  const chatEndRef = useRef(null);

  /* ✅ Auto Scroll */
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat, showPayment]);

  /* ---------------------------------------
     SEND MESSAGE FUNCTION
  ---------------------------------------- */
  async function sendMessage() {
    if (!msg.trim()) return;

    /* Add user message */
    setChat((prev) => [...prev, { role: "user", text: msg }]);

    const userMsg = msg;
    setMsg("");

    /* Call Agent API */
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg }),
    });

    if (!res.ok) {
      setChat((prev) => [
        ...prev,
        { role: "agent", text: "⚠️ Server error. Check API route." },
      ]);
      return;
    }

    const data = await res.json();

    /* Add agent reply */
    setChat((prev) => [...prev, { role: "agent", text: data.reply }]);

    /* ---------------------------------------
       ✅ EMBEDDED PAYMENT TRIGGER
    ---------------------------------------- */
    if (data.action === "CHECKOUT") {
      setChat((prev) => [
        ...prev,
        {
          role: "agent",
          text: "💳 Please complete payment securely below 👇",
        },
      ]);

      /* Create PaymentIntent */
      const paymentRes = await fetch("/api/acp/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: data.product.id }),
      });

      const paymentData = await paymentRes.json();

      /* Show Stripe Payment Element */
      setClientSecret(paymentData.clientSecret);
      setShowPayment(true);
    }
  }

  /* ---------------------------------------
     PAYMENT SUCCESS CALLBACK
  ---------------------------------------- */
  function handlePaymentSuccess() {
    setChat((prev) => [
      ...prev,
      {
        role: "agent",
        text: "✅ Payment successful! 🎉 Your order is confirmed.",
      },
    ]);

    setShowPayment(false);
    setClientSecret(null);
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-dark rounded-circle shadow-lg"
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

      {/* Chat Window */}
      {open && (
        <div
          className="card shadow-lg"
          style={{
            position: "fixed",
            bottom: "90px",
            right: "20px",
            width: "370px",
            height: "520px",
            zIndex: 9999,
            borderRadius: "15px",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div className="card-header bg-dark text-white fw-bold">
            🤖 Shopping Assistant
          </div>

          {/* Messages */}
          <div
            className="card-body bg-light"
            style={{
              overflowY: "auto",
              height: "320px",
            }}
          >
            {chat.map((c, i) => (
              <div
                key={i}
                className={`d-flex mb-2 ${
                  c.role === "user"
                    ? "justify-content-end"
                    : "justify-content-start"
                }`}
              >
                <div
                  className={`p-2 rounded-3 ${
                    c.role === "user"
                      ? "bg-primary text-white"
                      : "bg-white border"
                  }`}
                  style={{ maxWidth: "75%" }}
                >
                  {c.text}
                </div>
              </div>
            ))}

            {/* ✅ Stripe Payment Element Inside Chat */}
            {showPayment && clientSecret && (
              <div className="mt-3 p-2 bg-white border rounded">
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                  />
                </Elements>
              </div>
            )}

            {/* Scroll Target */}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="card-footer">
            <div className="input-group">
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                className="form-control"
                placeholder="Type a message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />

              <button onClick={sendMessage} className="btn btn-dark">
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
