"use client";
import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="container text-center py-5">
      <div className="card shadow-lg p-5">

        <h1 className="text-success fw-bold">
          ✅ Payment Successful!
        </h1>

        <p className="mt-3">
          Your order was completed successfully.
        </p>

        <Link href="/" className="btn btn-primary mt-4">
          ⬅ Back to Store
        </Link>
      </div>
    </div>
  );
}
