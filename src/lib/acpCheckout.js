import Product from "@/models/Product";
import crypto from "crypto";

/* -------------------------------------------
   ACP Version
------------------------------------------- */
export const ACP_API_VERSION = process.env.ACP_API_VERSION || "2026-01-30";

/* -------------------------------------------
   API-Version Header Validation
------------------------------------------- */
export function hasValidApiVersionHeader(req) {
  const apiVersion = req.headers.get("api-version");

  if (!apiVersion) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiVersion)) return false;

  return apiVersion === ACP_API_VERSION;
}

/* -------------------------------------------
   Build Standard ACP Headers
------------------------------------------- */
export function buildAcpResponseHeaders(req) {
  const headers = new Headers();

  const requestId = req.headers.get("request-id") || crypto.randomUUID();

  headers.set("Request-Id", requestId);
  headers.set("API-Version", ACP_API_VERSION);

  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  return headers;
}

/* -------------------------------------------
   Standard JSON Response Wrapper
------------------------------------------- */
export function jsonAcpResponse(req, body, status = 200) {
  return Response.json(body, {
    status,
    headers: buildAcpResponseHeaders(req),
  });
}

/* -------------------------------------------
   Unauthorized Response
------------------------------------------- */
export function unauthorizedResponse(req) {
  return jsonAcpResponse(req, { error: "Unauthorized" }, 401);
}

/* -------------------------------------------
   STRICT Authorization Check (Fixed)
------------------------------------------- */
export function isAuthorized(req) {
  const isProduction = process.env.NODE_ENV === "production";
  const auth = req.headers.get("authorization") || "";
  const expectedToken = (process.env.ACP_SECRET_KEY || "").trim();

  // Local development fallback: allow ACP calls without bearer auth.
  if (!isProduction && !auth) return true;

  // In production, secret must be configured and bearer token must match.
  if (!expectedToken) {
    return false;
  }

  if (!auth.startsWith("Bearer ")) {
    return false;
  }

  const token = auth.replace("Bearer ", "").trim();
  if (!token || token === "undefined" || token === "null") {
    return false;
  }

  return token === expectedToken;
}

/* -------------------------------------------
   Buyer Validation
------------------------------------------- */
export function validateBuyer(buyer) {
  if (!buyer || typeof buyer !== "object") {
    return "buyer is required";
  }

  if (!buyer.first_name || !buyer.last_name || !buyer.email) {
    return "buyer.first_name, buyer.last_name and buyer.email are required";
  }

  return null;
}

/* -------------------------------------------
   Address Validation
------------------------------------------- */
export function validateAddress(address) {
  if (!address || typeof address !== "object") {
    return "fulfillment_address is required";
  }

  const required = [
    "name",
    "line_one",
    "city",
    "state",
    "country",
    "postal_code",
  ];

  const missing = required.filter((field) => !address[field]);

  if (missing.length > 0) {
    return `fulfillment_address missing required fields: ${missing.join(", ")}`;
  }

  return null;
}

/* -------------------------------------------
   Items Validation
------------------------------------------- */
export function validateRequestedItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "items must contain at least one item";
  }

  const hasInvalid = items.some(
    (item) =>
      !item ||
      typeof item.id !== "string" ||
      item.id.trim() === "" ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
  );

  if (hasInvalid) {
    return "each item must include id (string) and quantity (positive integer)";
  }

  return null;
}

/* -------------------------------------------
   Resolve Items + Pricing From MongoDB
------------------------------------------- */
export async function resolveItemsWithPricing(items) {
  const productIds = items.map((item) => item.id);

  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // ❌ Missing products
  const missingIds = productIds.filter((id) => !productMap.has(id));

  if (missingIds.length > 0) {
    return {
      error: "Invalid item id(s)",
      status: 400,
      messages: missingIds.map((id) => ({
        code: "invalid_item",
        level: "error",
        text: `Item not found: ${id}`,
      })),
    };
  }
  // ❌ Stock check
  const outOfStock = [];

  const resolvedItems = items.map((item) => {
    const product = productMap.get(item.id);

    if ((product.stock ?? 0) < item.quantity) {
      outOfStock.push({
        code: "out_of_stock",
        level: "error",
        text: `${product.name} has only ${product.stock ?? 0} left`,
      });
    }

    return {
      id: String(product._id),
      name: product.name,
      quantity: item.quantity,
      unit_price: product.price,
      line_total: product.price * item.quantity,
      currency: product.currency || "USD",
    };
  });

  if (outOfStock.length > 0) {
    return {
      error: "One or more items cannot be fulfilled",
      status: 422,
      messages: outOfStock,
    };
  }

  return { resolvedItems };
}

/* -------------------------------------------
   Pricing Calculation
------------------------------------------- */
export function buildPricing(resolvedItems, fulfillmentOption) {
  const subtotal = resolvedItems.reduce((sum, item) => sum + item.line_total, 0);

  const tax = 0;
  const shipping = fulfillmentOption?.amount || 0;

  const total = subtotal + tax + shipping;

  const currency = resolvedItems[0]?.currency || "USD";

  return {
    subtotal,
    tax,
    shipping,
    total,
    currency,
  };
}

/* -------------------------------------------
   Default Shipping Options
------------------------------------------- */
export function defaultFulfillmentOptions(currency) {
  return [
    {
      id: "ship_std",
      label: "Standard Shipping",
      type: "shipping",
      amount: 0,
      currency,
      eta_days: 5,
    },
    {
      id: "ship_exp",
      label: "Express Shipping",
      type: "shipping",
      amount: 499,
      currency,
      eta_days: 2,
    },
  ];
}

/* -------------------------------------------
   Serialize Checkout Session
------------------------------------------- */
export function serializeCheckoutSession(sessionDoc) {
  return {
    id: sessionDoc.session_id,
    status: sessionDoc.status,

    buyer: sessionDoc.buyer,
    items: sessionDoc.items,

    fulfillment_address: sessionDoc.fulfillment_address,
    fulfillment_option_id: sessionDoc.fulfillment_option_id,

    available_fulfillment_options:
      sessionDoc.available_fulfillment_options || [],

    pricing: sessionDoc.pricing,

    messages: sessionDoc.messages || [],

    created_at: sessionDoc.createdAt,
    updated_at: sessionDoc.updatedAt,
  };
}
