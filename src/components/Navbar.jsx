"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isHomeRoute = pathname?.startsWith("/home");
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  async function handleLogout() {
    localStorage.removeItem("auth_token");

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore and continue redirect.
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="fixed-top navbar navbar-dark bg-dark px-4 d-flex justify-content-between">
      <Link href="/home" className="navbar-brand fw-bold">
        🛍 RetailStore
      </Link>

      <div className="d-flex gap-2">
        {!isAuthRoute && !isHomeRoute && (
          <>
            <Link href="/signup" className="btn btn-outline-light">
              Signup
            </Link>
            <Link href="/login" className="btn btn-outline-light">
              Login
            </Link>
          </>
        )}
        {!isAuthRoute && !isHomeRoute && (
          <Link href="/home" className="btn btn-outline-light">
            Home
          </Link>
        )}
        {!isAuthRoute && isHomeRoute && (
          <button type="button" className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
