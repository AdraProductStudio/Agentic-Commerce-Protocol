"use client";

import { useEffect, useState } from "react";

export default function SuccessPage() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchLatestOrder() {
    try {
      const res = await fetch("/api/orders/latest");

      if (!res.ok) {
        throw new Error("No order found");
      }

      const data = await res.json();
      setOrder(data);
    } catch (err) {
      console.log("Order fetch error:", err.message);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchLatestOrder();
  }, []);

  return (
    <div className="container text-center py-5">
      <div className="card shadow-lg p-5">

        <h1 className="text-success fw-bold">
          ✅ Payment Successful!
        </h1>

        {loading && <p>Loading your order details...</p>}

        {!loading && order && (
          <>
            <h3 className="mt-4">
              🎉 Order Confirmed!
            </h3>

            <p>
              <b>Order ID:</b> {order.order_id}
            </p>

            <p>
              <b>Delivery Status:</b> {order.delivery}
            </p>
          </>
        )}

        {!loading && !order && (
          <p className="text-danger mt-3">
            ❌ No order found yet. Webhook may not have saved it.
          </p>
        )}

        <a href="/" className="btn btn-primary mt-4">
          ⬅ Back to Store
        </a>
      </div>
    </div>
  );
}
