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

  const [clientSecret, setClientSecret] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);

  const chatEndRef = useRef(null);

  /* Auto Scroll */
  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 100);
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

    setChat((prev) => [
      ...prev,
      {
        role: "agent",
        text: data.reply,
        products: data.products || [],
      },
    ]);


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

      createCheckoutSession(itemsToBuy);
    }



    setCheckoutStep(nextStep);
  }

  /* ---------------- Add Product to Cart Function ---------------- */

  function addToCart(product) {
    setCart((prev) => {
      const exists = prev.find((x) => x.id === product.id);

      if (exists) {
        return prev.map((x) =>
          x.id === product.id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }

      return [...prev, { ...product, quantity: 1 }];
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
      },
    ]);
  }


  /* ----------------Start checkout Session ---------------- */

  function startCheckout() {
    setChat((prev) => [
      ...prev,
      { role: "agent", text: "🧾 Enter First Name to Checkout:" },
    ]);

    setCheckoutStep("first_name");
  }




  /* ----------------Add Buy Now (Direct Checkout)---------------- */

  function buyNow(product) {
    selectedProductRef.current = product;

    setChat((prev) => [
      ...prev,
      {
        role: "agent",
        text: `⚡ Buying ${product.name} now!\nEnter First Name:`,
      },
    ]);

    setCheckoutMode("BUY_NOW");
    setCheckoutStep("first_name");
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

    setChat((prev) => [
      ...prev,
      { role: "agent", text: "💳 Checking out cart items!\nEnter First Name:" },
    ]);

    setCheckoutMode("CART");
    setCheckoutStep("first_name");
  }





  /* ---------------- Create Checkout Session ---------------- */
  /* ---------------- Create Checkout Session ---------------- */
  async function createCheckoutSession(itemsToBuy) {
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
          first_name: buyerData.first_name,
          last_name: buyerData.last_name,
          email: buyerData.email,
        },

        items: itemsToBuy.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          currency: item.currency,
        })),

        fulfillment_address: {
          name: buyerData.first_name + " " + buyerData.last_name,
          line_one: buyerData.address,
          city: buyerData.city,
          state: buyerData.state,
          country: buyerData.country,
          postal_code: buyerData.postal_code,
        },
      };

      console.log("📦 ACP Payload Sent:", acpPayload);

      // Call backend
      const res = await fetch("/api/acp/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // ✅ Save session + client secret
      setCheckoutSessionId(sessionId);
      setClientSecret(paymentData.clientSecret);

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




  /* ---------------- Payment Success ---------------- */
  /* ---------------- Payment Success ---------------- */
  async function handlePaymentSuccess() {
    setShowPayment(false);

    // ✅ Ensure session exists
    if (!checkoutSessionId) {
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
      const res = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: checkoutSessionId }),
      });

      const orderData = await res.json();

      console.log("🔥 Confirm API Response:", orderData);

      // ✅ Handle backend confirm error
      if (!res.ok) {
        setChat((prev) => [
          ...prev,
          {
            role: "agent",
            text: "❌ Order confirmation failed: " + orderData.error,
          },
        ]);
        return;
      }

      // ✅ Currency Symbol Fix
      const currencySymbol = formatCurrency(orderData.currency || "INR");

      // ✅ Items Purchased Text
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

      // ✅ Final Message
      const orderMessage = `🎉 Order Confirmed!

🆔 Order ID: ${orderData.order_id}
💳 Payment: ${orderData.payment_status}
🚚 Delivery: ${orderData.delivery_status}

🛒 Items Purchased:
${itemsText}

💰 Total: ${currencySymbol}${orderData.total_price}`;

      setChat((prev) => [...prev, { role: "agent", text: orderMessage }]);

      // ✅ Clear Cart after successful payment
      setCart([]);
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
          <div className="card-header bg-dark text-white fw-bold w-100 d-flex justify-content-between align-items-center px-3">

            {/* Left Side Title */}
            <div className="d-flex align-items-center">
              🤖 Shopping Assistant
            </div>

            {/* Right Side Buttons */}
            <div className="d-flex align-items-center gap-2">

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

                  {/* Optional Close Button */}
                  {/* <button
                  title="Close options"
                    className="btn btn-sm btn-danger text-light px-2"
                    onClick={() => setShowCartMenu(false)}
                  >
                    ✖
                  </button> */}
                </div>
              )}
            </div>

          </div>





          <div
            className="card-body bg-light"
            style={{ overflowY: "auto", height: "340px" }}
          >
            {chat.map((c, i) => (
              <div key={i}>
                {/* Normal Message */}
                <div
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

                {/* Product List */}
                {c.products?.map((p) => {

                  // ✅ ADD THIS LINE HERE (inside map)
                  const inCart = cart.some((item) => item.id === p.id);

                  return (
                    <div key={p.id} className="border rounded p-2 mb-2 bg-white w-75 text-center">

                      <img
                        src={p.image}
                        alt={p.name}
                        style={{
                          width: "30%",
                          height: "30%",
                          objectFit: "cover",
                          borderRadius: "10px",
                        }}
                      />

                      <h6 className="mt-2">{p.name}</h6>

                      <p className="fw-bold text-success">
                        ₹{p.price}
                      </p>

                      <div className="d-flex gap-2">

                        {/* ✅ Toggle Add / Remove Button */}
                        <button
                          className={`btn btn-sm w-50 ${inCart ? "btn-danger" : "btn-outline-primary"
                            }`}
                          onClick={() => {
                            if (inCart) {
                              removeFromCart(p.id);
                            } else {
                              addToCart(p);
                            }
                          }}
                        >
                          {inCart ? "❌ Remove" : "🛒 Add"}
                        </button>

                        {/* Buy Now Button */}
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
