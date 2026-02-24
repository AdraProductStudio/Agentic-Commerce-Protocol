"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const API_VERSION = process.env.NEXT_PUBLIC_ACP_API_VERSION || "2026-01-30";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-Version": API_VERSION,
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          alert("Invalid username or password");
        } else if (res.status === 400) {
          alert("Enter username and password");
        } else {
          alert(data.error || "Login failed");
        }
        return;
      }

      localStorage.setItem("auth_token", data.token);
      setMessage("Login successful. Redirecting...");
      const nextPath = searchParams.get("next");
      router.replace(nextPath || "/home");
      router.refresh();
    } catch {
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container py-5 mt-5" style={{ maxWidth: 480 }}>
      <h2 className="mb-3">Login</h2>
      <form onSubmit={handleSubmit} className="card p-3 shadow-sm">
        <label className="form-label">Username</label>
        <input
          type="text"
          className="form-control mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="form-label">Password</label>
        <div className="input-group mb-3">
          <input
            type={showPassword ? "text" : "password"}
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.359 11.238 14.5 12.379l-.707.707-1.18-1.18A8.9 8.9 0 0 1 8 13.5C3 13.5.5 8 .5 8a14.8 14.8 0 0 1 2.678-3.553L1.5 2.77l.707-.707 12 12-.707.707-1.141-1.142ZM4.07 5.339A12.7 12.7 0 0 0 1.661 8 13.5 13.5 0 0 0 8 12.5c1.28 0 2.455-.262 3.492-.78l-1.273-1.273A3 3 0 0 1 5.553 5.78L4.07 4.297v1.042Zm2.177 2.177 2.237 2.237a2 2 0 0 1-2.237-2.237Zm4.606 1.778-4.147-4.147a2.99 2.99 0 0 1 4.147 4.147Zm.78-.78a4 4 0 0 0-5.265-5.265l-.894-.894A8.8 8.8 0 0 1 8 2.5c5 0 7.5 5.5 7.5 5.5a14.6 14.6 0 0 1-2.404 3.255l-1.463-1.461Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8ZM1.173 8a13.1 13.1 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13.1 13.1 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.12 12.5 8 12.5s-3.879-1.168-5.168-2.457A13.1 13.1 0 0 1 1.172 8Zm8.827 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
              </svg>
            )}
          </button>
        </div>

        <button className="btn btn-dark" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        {message && <p className="mt-3 mb-0">{message}</p>}
      </form>

      <p className="mt-3">
        New user? <Link href="/signup">Signup</Link>
      </p>
    </main>
  );
}
