import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";
import {
  ACP_API_VERSION,
  buildPricing,
  hasValidApiVersionHeader,
  isAuthorized,
  jsonAcpResponse,
  resolveItemsWithPricing,
  serializeCheckoutSession,
  unauthorizedResponse,
  validateAddress,
  validateBuyer,
  validateRequestedItems,
} from "@/lib/acpCheckout";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(req, { params }) {
  try {
    console.log("[API] GET /api/acp/checkout_sessions/:id");
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
    console.log("[API] GET /api/acp/checkout_sessions/:id", { sessionId });
    const session = await CheckoutSession.findOne({ session_id: sessionId });
    if (!session) {
      return jsonAcpResponse(req, { error: "Checkout session not found" }, 404);
    }

    return jsonAcpResponse(req, {
      checkout_session: serializeCheckoutSession(session),
    });
  } catch (err) {
    console.error("[API] GET /api/acp/checkout_sessions/:id error", err);
    return jsonAcpResponse(req, { error: err.message }, 400);
  }
}

export async function POST(req, { params }) {
  try {
    console.log("[API] POST /api/acp/checkout_sessions/:id");
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
    console.log("[API] POST /api/acp/checkout_sessions/:id", { sessionId });
    const session = await CheckoutSession.findOne({ session_id: sessionId });
    if (!session) {
      return jsonAcpResponse(req, { error: "Checkout session not found" }, 404);
    }

    if (session.status !== "pending") {
      return jsonAcpResponse(
        req,
        {
          error: "Checkout session is not editable",
          messages: [
            {
              code: "session_locked",
              level: "error",
              text: "Only pending checkout sessions can be updated",
            },
          ],
        },
        422
      );
    }

    const update = await req.json();
    console.log("[API] /api/acp/checkout_sessions/:id update payload", {
      hasBuyer: update.buyer !== undefined,
      hasItems: update.items !== undefined,
      hasAddress: update.fulfillment_address !== undefined,
      hasFulfillmentOption: update.fulfillment_option_id !== undefined,
    });
    const hasKnownField =
      update.buyer !== undefined ||
      update.items !== undefined ||
      update.fulfillment_address !== undefined ||
      update.fulfillment_option_id !== undefined;

    if (!hasKnownField) {
      return jsonAcpResponse(req, { error: "No updatable fields provided" }, 400);
    }

    if (update.buyer !== undefined) {
      const buyerError = validateBuyer(update.buyer);
      if (buyerError) {
        return jsonAcpResponse(req, { error: buyerError }, 400);
      }
      session.buyer = update.buyer;
    }

    if (update.fulfillment_address !== undefined) {
      const addressError = validateAddress(update.fulfillment_address);
      if (addressError) {
        return jsonAcpResponse(req, { error: addressError }, 400);
      }
      session.fulfillment_address = update.fulfillment_address;
    }

    if (update.items !== undefined) {
      const itemsError = validateRequestedItems(update.items);
      if (itemsError) {
        return jsonAcpResponse(req, { error: itemsError }, 400);
      }

      const resolved = await resolveItemsWithPricing(update.items);
      if (resolved.error) {
        return jsonAcpResponse(
          req,
          { error: resolved.error, messages: resolved.messages },
          resolved.status
        );
      }

      session.items = resolved.resolvedItems;
    }

    if (update.fulfillment_option_id !== undefined) {
      const option = (session.available_fulfillment_options || []).find(
        (o) => o.id === update.fulfillment_option_id
      );

      if (!option) {
        return jsonAcpResponse(req, { error: "Invalid fulfillment_option_id" }, 400);
      }

      session.fulfillment_option_id = option.id;
    }

    const selectedOption = (session.available_fulfillment_options || []).find(
      (o) => o.id === session.fulfillment_option_id
    );
    session.pricing = buildPricing(session.items, selectedOption);

    if (session.stripePaymentIntentId) {
      await stripe.paymentIntents.update(session.stripePaymentIntentId, {
        amount: Math.round(session.pricing.total * 100),
      });
    }

    session.messages = [];
    await session.save();

    return jsonAcpResponse(req, {
      checkout_session: serializeCheckoutSession(session),
    });
  } catch (err) {
    console.error("[API] POST /api/acp/checkout_sessions/:id error", err);
    return jsonAcpResponse(req, { error: err.message }, 400);
  }
}
