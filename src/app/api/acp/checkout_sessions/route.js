import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import CheckoutSession from "@/models/CheckoutSession";
import {
  ACP_API_VERSION,
  applyDiscounts,
  buildPricing,
  defaultFulfillmentOptions,
  hasValidApiVersionHeader,
  isAuthorized,
  jsonAcpResponse,
  resolveItemsWithPricing,
  serializeCheckoutSession,
  unauthorizedResponse,
  validateAddress,
  validateBuyer,
  validateDiscountsRequest,
  validateRequestedItems,
} from "@/lib/acpCheckout";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    console.log("[API] POST /api/acp/checkout_sessions");
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
    const { buyer, items, fulfillment_address, discounts } = await req.json();
    console.log("[API] /api/acp/checkout_sessions payload", {
      itemCount: Array.isArray(items) ? items.length : 0,
      buyerEmail: buyer?.email,
      discountCodes: discounts?.codes || [],
    });

    const buyerError = validateBuyer(buyer);
    if (buyerError) {
      return jsonAcpResponse(req, { error: buyerError }, 400);
    }

    const itemsError = validateRequestedItems(items);
    if (itemsError) {
      return jsonAcpResponse(req, { error: itemsError }, 400);
    }

    const addressError = validateAddress(fulfillment_address);
    if (addressError) {
      return jsonAcpResponse(req, { error: addressError }, 400);
    }

    const discountsError = validateDiscountsRequest(discounts);
    if (discountsError) {
      console.log("[API] /api/acp/checkout_sessions discounts validation failed", {
        endpoint: "POST /api/acp/checkout_sessions",
        discounts,
        discountsError,
      });
      return jsonAcpResponse(req, { error: discountsError }, 400);
    }

    const resolved = await resolveItemsWithPricing(items);
    if (resolved.error) {
      return jsonAcpResponse(
        req,
        { error: resolved.error, messages: resolved.messages },
        resolved.status
      );
    }

    const resolvedItems = resolved.resolvedItems;
    const currency = (resolvedItems[0]?.currency || "USD").toLowerCase();
    const sessionId = `cs_${Date.now()}`;
    const availableFulfillmentOptions = defaultFulfillmentOptions(
      resolvedItems[0]?.currency || "USD"
    );
    const fulfillmentOptionId = availableFulfillmentOptions[0].id;
    const selectedOption = availableFulfillmentOptions[0];
    const discountResult = applyDiscounts({
      resolvedItems,
      shippingMajor: selectedOption?.amount || 0,
      currency: resolvedItems[0]?.currency || "USD",
      discounts,
    });
    const sessionMessages = [
      ...(resolved.messages || []),
      ...(discountResult.messages || []),
    ];
    console.log("[API] /api/acp/checkout_sessions discount result", {
      endpoint: "POST /api/acp/checkout_sessions",
      requestedCodes: discounts?.codes || [],
      appliedCount: discountResult.discounts.applied.length,
      rejectedCount: discountResult.discounts.rejected.length,
      discountTotalMinor: discountResult.discountTotalMinor,
      messageCount: sessionMessages.length,
    });
    const pricing = buildPricing(
      resolvedItems,
      selectedOption,
      discountResult.discountTotalMinor
    );
    console.log("[API] /api/acp/checkout_sessions pricing result", {
      endpoint: "POST /api/acp/checkout_sessions",
      pricing,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pricing.total * 100),
      currency,
      payment_method_types: ["card"],
      metadata: { acp_session_id: sessionId },
    });

    const savedSession = await CheckoutSession.create({
      session_id: sessionId,
      buyer,
      items: resolvedItems,
      fulfillment_address,
      fulfillment_option_id: fulfillmentOptionId,
      available_fulfillment_options: availableFulfillmentOptions,
      pricing,
      discounts: discountResult.discounts,
      messages: sessionMessages,
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
    });

    return jsonAcpResponse(
      req,
      {
        checkout_session: serializeCheckoutSession(savedSession),
      },
      201
    );
  } catch (err) {
    console.error("[API] POST /api/acp/checkout_sessions error", err);
    return jsonAcpResponse(req, { error: err.message }, 400);
  }
}
