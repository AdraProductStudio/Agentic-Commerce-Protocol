import { NextResponse } from "next/server";

import { AUTH_API_VERSION, validateApiHeaders, verifyAuthHeader } from "@/lib/auth";

export async function POST(req) {
  const headerCheck = validateApiHeaders(req, { requireContentType: true });
  if (!headerCheck.ok) {
    return NextResponse.json({ error: headerCheck.error }, { status: headerCheck.status });
  }

  const authCheck = verifyAuthHeader(req);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const payload = {
    Authorization: `Bearer ${req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""}`,
    "Content-Type": "application/json",
    "API-Version": AUTH_API_VERSION,
    user: {
      id: authCheck.payload.sub,
      username: authCheck.payload.username,
    },
  };

  return NextResponse.json({ payload }, { status: 200 });
}
