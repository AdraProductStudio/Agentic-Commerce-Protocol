import jwt from "jsonwebtoken";

export const AUTH_API_VERSION =
  process.env.AUTH_API_VERSION || process.env.NEXT_PUBLIC_ACP_API_VERSION || "2026-01-30";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-env";

export function validateApiHeaders(req, { requireContentType = false } = {}) {
  const apiVersion = req.headers.get("api-version");
  if (apiVersion !== AUTH_API_VERSION) {
    return {
      ok: false,
      status: 400,
      error: `Invalid or missing API-Version. Expected ${AUTH_API_VERSION}`,
    };
  }

  if (requireContentType) {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return {
        ok: false,
        status: 400,
        error: "Content-Type must be application/json",
      };
    }
  }

  return { ok: true };
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
}

export function verifyAuthHeader(req) {
  const auth = req.headers.get("authorization") || "";

  if (!auth.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Missing or invalid Authorization header",
    };
  }

  const token = auth.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { ok: true, payload };
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }
}
