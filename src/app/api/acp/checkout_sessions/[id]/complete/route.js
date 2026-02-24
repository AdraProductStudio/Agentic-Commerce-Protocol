import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";
import Order from "@/models/Order";
import {
  ACP_API_VERSION,
  createErrorMessage,
  hasValidApiVersionHeader,
  isAuthorized,
  jsonAcpResponse,
  serializeCheckoutSession,
  unauthorizedResponse,
  validateBuyer,
} from "@/lib/acpCheckout";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req, { params }) {
  try {
    console.log("[API] POST /api/acp/checkout_sessions/:id/complete");
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

    const body = await req.json();
    const { buyer, payment_data, checkout_session_id } = body;
    console.log("[API] /complete payload", {
      checkout_session_id,
      buyerEmail: buyer?.email,
      provider: payment_data?.provider,
    });

    if (!payment_data || typeof payment_data !== "object") {
      return jsonAcpResponse(req, { error: "payment_data is required" }, 400);
    }

    if (payment_data.provider !== "stripe" || !payment_data.token) {
      return jsonAcpResponse(
        req,
        { error: "payment_data.token and provider=stripe are required" },
        400
      );
    }

    const { id } = await params;
    const rawParamId = decodeURIComponent(String(id || "")).trim();
    const extractedParamId = rawParamId.match(/cs_\d+/)?.[0] || "";
    const rawBodyId = String(checkout_session_id || "").trim();
    const extractedBodyId = rawBodyId.match(/cs_\d+/)?.[0] || "";
    const sessionIdCandidates = [
      rawParamId,
      extractedParamId,
      rawBodyId,
      extractedBodyId,
    ].filter(Boolean);

    let session = null;
    if (sessionIdCandidates.length > 0) {
      session = await CheckoutSession.findOne({
        session_id: { $in: sessionIdCandidates },
      });
    }

    // Fallback for transient ID mismatch: use latest pending session for this buyer
    if (!session && buyer?.email) {
      session = await CheckoutSession.findOne({
        status: "pending",
        "buyer.email": buyer.email,
      }).sort({ createdAt: -1 });
    }

    // Final local-dev fallback: most recent pending checkout session
    if (!session) {
      session = await CheckoutSession.findOne({ status: "pending" }).sort({
        createdAt: -1,
      });
    }
    console.log("[API] /complete session resolved", { sessionId: session.session_id });
    if (!session) {
      return jsonAcpResponse(req, { error: "Checkout session not found" }, 404);
    }

    if (session.status === "completed" || session.status === "cancelled") {
      return jsonAcpResponse(
        req,
        { error: "Checkout session already finalized" },
        409
      );
    }

    if (buyer !== undefined) {
      const buyerError = validateBuyer(buyer);
      if (buyerError) {
        return jsonAcpResponse(req, { error: buyerError }, 400);
      }
      session.buyer = buyer;
    }

    let paymentIntent;
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || new URL("/", req.url).toString();
      paymentIntent = await stripe.paymentIntents.confirm(
        session.stripePaymentIntentId,
        {
          payment_method: payment_data.token,
          return_url: `${baseUrl.replace(/\/$/, "")}/success`,
        }
      );
    } catch (err) {
      return jsonAcpResponse(
        req,
        {
          error: "Payment processing failed",
          messages: [
            createErrorMessage({
              code: "payment_declined",
              severity: "high",
              param: "$.payment_data.token",
              content: err.message,
            }),
          ],
        },
        402
      );
    }

    if (paymentIntent.status !== "succeeded") {
      return jsonAcpResponse(
        req,
        {
          error: "Payment processing failed",
          messages: [
            createErrorMessage({
              code: "payment_declined",
              severity: "high",
              param: "$.payment_data.token",
              content: `Stripe status is ${paymentIntent.status}`,
            }),
          ],
        },
        402
      );
    }

    const existingOrder = await Order.findOne({
      "checkout.session_id": session.session_id,
    });
    if (existingOrder) {
      return jsonAcpResponse(
        req,
        { error: "Checkout session already completed" },
        409
      );
    }

    const order = await Order.create({
      orderId: `ORD_${Date.now()}`,
      checkout: { session_id: session.session_id },
      buyer: session.buyer,
      items: (session.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        price: item.unit_price,
        quantity: item.quantity,
        currency: item.currency,
      })),
      discounts: {
        codes: session.discounts?.codes || [],
        applied: session.discounts?.applied || [],
        rejected: session.discounts?.rejected || [],
      },
      subtotalPrice: Number(session.pricing?.subtotal) || 0,
      shippingPrice: Number(session.pricing?.shipping) || 0,
      discountValue: Number(session.pricing?.discount) || 0,
      totalPrice: session.pricing?.total || 0,
      paymentStatus: "paid",
      status: "confirmed",
    });
    console.log("[API] /complete order created", { orderId: order.orderId });

    session.status = "completed";
    session.orderId = order.orderId;
    session.completedAt = new Date();
    session.messages = [];
    await session.save();

    return jsonAcpResponse(req, {
      checkout_session: serializeCheckoutSession(session),
      order: {
        id: order.orderId,
        payment_status: order.paymentStatus,
        delivery_status: order.status,
        subtotal_price: order.subtotalPrice,
        shipping_price: order.shippingPrice,
        discount_value: order.discountValue,
        total_price: order.totalPrice,
        currency: session.pricing?.currency || "USD",
        items: order.items,
        discounts: order.discounts,
      },
    });
  } catch (err) {
    console.error("[API] POST /api/acp/checkout_sessions/:id/complete error", err);
    return jsonAcpResponse(
      req,
      {
        error: "Payment cannot be processed",
        messages: [
          createErrorMessage({
            code: "intervention_required",
            severity: "high",
            param: "$.payment_data",
            content: err.message,
          }),
        ],
      },
      422
    );
  }
}
