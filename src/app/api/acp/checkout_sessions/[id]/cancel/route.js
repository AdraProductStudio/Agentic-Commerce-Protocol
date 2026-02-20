import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";
import {
  ACP_API_VERSION,
  hasValidApiVersionHeader,
  isAuthorized,
  jsonAcpResponse,
  serializeCheckoutSession,
  unauthorizedResponse,
} from "@/lib/acpCheckout";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req, { params }) {
  try {
    console.log("[API] POST /api/acp/checkout_sessions/:id/cancel");
    if (!hasValidApiVersionHeader(req)) {
      return jsonAcpResponse(
        req,
        { error: `Invalid or missing API-Version. Expected ${ACP_API_VERSION}` },
        400
      );
    }

    if (!isAuthorized(req)) {
      return unauthorizedResponse(req);
    }

    await connectDB();

    const { id } = await params;
    const sessionId = decodeURIComponent(String(id || "")).trim();
    console.log("[API] /cancel payload", { sessionId });
    const session = await CheckoutSession.findOne({ session_id: sessionId });
    if (!session) {
      return jsonAcpResponse(req, { error: "Checkout session not found" }, 404);
    }

    if (session.status === "completed" || session.status === "cancelled") {
      return jsonAcpResponse(
        req,
        { error: "Checkout session is already completed or cancelled" },
        405
      );
    }

    if (session.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(session.stripePaymentIntentId);
      } catch {
        // Ignore cancel errors from Stripe for non-cancellable states
      }
    }

    session.status = "cancelled";
    session.cancelledAt = new Date();
    await session.save();

    return jsonAcpResponse(req, {
      checkout_session: serializeCheckoutSession(session),
    });
  } catch (err) {
    console.error("[API] POST /api/acp/checkout_sessions/:id/cancel error", err);
    return jsonAcpResponse(req, { error: err.message }, 400);
  }
}
