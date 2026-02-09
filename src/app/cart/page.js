"use client";

import { useCart } from "../../components/CartContext";

export default function CartPage() {
  const { cart, removeFromCart } = useCart();

  async function checkout() {
    const res = await fetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ product: cart[0] }),
    });

    const data = await res.json();
    window.location.href = data.url;
  }

  return (
    <div className="container py-5">
      <h2 className="fw-bold mb-4">🛒 Your Cart</h2>

      {cart.length === 0 ? (
        <p>No items in cart.</p>
      ) : (
        <>
          {cart.map((item, i) => (
            <div
              key={i}
              className="d-flex justify-content-between border p-3 mb-2"
            >
              <span>
                {item.name} - ${item.price}
              </span>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => removeFromCart(item.id)}
              >
                Remove
              </button>
            </div>
          ))}

          <button className="btn btn-success w-100 mt-3" onClick={checkout}>
            Pay Now (Stripe Checkout)
          </button>
        </>
      )}
    </div>
  );
}
