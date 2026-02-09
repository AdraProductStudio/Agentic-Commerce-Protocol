"use client";

import { useCart } from "./CartContext";

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <div className="card h-100 shadow-sm d-flex flex-column">
      
      {/* Product Image */}
      <img
        src={product.image}
        className="card-img-top"
        alt={product.name}
        style={{
          height: "200px",
          objectFit: "contain",
          padding: "15px",
        }}
      />

      {/* Card Body */}
      <div className="card-body">
        <h5 className="fw-bold">{product.name}</h5>

        <p className="text-muted small">{product.description}</p>

        <p className="mb-0">
          <b>${product.price}</b> • {product.color}
        </p>
      </div>

      {/* Card Footer Always Bottom */}
      <div className="card-footer bg-white border-0 mt-auto">
        <button
          className="btn btn-primary w-100"
          onClick={() => addToCart(product)}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
