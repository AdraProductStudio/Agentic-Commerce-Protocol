"use client";

import { useState } from "react";

const API_VERSION = process.env.NEXT_PUBLIC_ACP_API_VERSION || "2026-01-30";

export default function AuthPayloadPage() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchPayload() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/auth/payload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
          "API-Version": API_VERSION,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        const shortError = res.status === 401 ? "Unauthorized. Please login again." : data.error || "Request failed";
        setError(shortError);
        alert(shortError);
        return;
      }

      setResult(data.payload);
    } catch {
      setError("Request failed");
      alert("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container py-5 mt-5" style={{ maxWidth: 800 }}>
      <h2 className="mb-3">Valid User Payload</h2>
      <p className="text-muted">
        This endpoint returns required headers only for a valid logged-in user.
      </p>

      <button className="btn btn-success" onClick={fetchPayload} disabled={loading}>
        {loading ? "Checking..." : "Send Request"}
      </button>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      {result && (
        <pre className="bg-dark text-light p-3 mt-3 rounded" style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
