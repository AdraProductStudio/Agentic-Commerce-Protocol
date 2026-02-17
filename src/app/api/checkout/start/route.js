export async function POST(req) {
  const body = await req.json();

  // frontend → backend (safe)

  const res = await fetch("http://localhost:3000/api/acp/checkout_sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      // ✅ ACP key added ONLY inside backend
      Authorization: `Bearer ${process.env.ACP_SECRET_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
