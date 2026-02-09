export default function SuccessPage() {
  return (
    <div className="container text-center py-5">
      <div className="card shadow-lg p-5">
        <h1 className="text-success fw-bold">✅ Payment Successful!</h1>
        <p className="mt-3">
          ACP transaction completed securely via Stripe.
        </p>

        <a href="/" className="btn btn-primary mt-3">
          ⬅ Back to Store
        </a>
      </div>
    </div>
  );
}
