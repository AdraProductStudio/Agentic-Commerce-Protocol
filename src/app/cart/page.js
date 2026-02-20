"use client";

import { useCart } from "../../components/CartContext";

export default function CartPage() {
  const { cart, removeFromCart } = useCart();

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

          <div className="alert alert-info mt-3 mb-0">
            Use the chat assistant checkout to complete payment.
          </div>
        </>
      )}
    </div>
  );
}
