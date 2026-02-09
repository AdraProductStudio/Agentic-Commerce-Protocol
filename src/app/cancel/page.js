export default function CancelPage() {
  return (
    <div className="container text-center py-5">
      <div className="card shadow-lg p-5">
        <h1 className="text-danger fw-bold">❌ Payment Cancelled</h1>
        <p className="mt-3">The user cancelled the checkout flow.</p>

        <a href="/" className="btn btn-dark mt-3">
          ⬅ Back to Store
        </a>
      </div>
    </div>
  );
}
