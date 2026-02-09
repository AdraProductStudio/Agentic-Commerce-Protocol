"use client";

import Link from "next/link";
import { useCart } from "./CartContext";

export default function Navbar() {
  const { cart } = useCart();

  return (
    <nav className="fixed-top navbar navbar-dark bg-dark px-4">
      <Link href="/" className="navbar-brand fw-bold">
        🛍 RetailStore
      </Link>

      <Link href="/cart" className="btn btn-outline-light">
        Cart ({cart.length})
      </Link>
    </nav>
  );
}
