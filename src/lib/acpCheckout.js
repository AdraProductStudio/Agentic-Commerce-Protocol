import Product from "@/models/Product";
import crypto from "crypto";

/* -------------------------------------------
   ACP Version
------------------------------------------- */
export const ACP_API_VERSION = process.env.ACP_API_VERSION || "2026-01-30";

export const DISCOUNT_ERROR_CODES = new Set([
  "discount_code_expired",
  "discount_code_invalid",
  "discount_code_already_applied",
  "discount_code_combination_disallowed",
  "discount_code_minimum_not_met",
  "discount_code_user_not_logged_in",
  "discount_code_user_ineligible",
  "discount_code_usage_limit_reached",
]);

export const MESSAGE_WARNING_CODES = new Set([
  "low_stock",
  "high_demand",
  "shipping_delay",
  "price_change",
  "expiring_promotion",
  "limited_availability",
  "discount_code_expired",
  "discount_code_invalid",
  "discount_code_already_applied",
  "discount_code_combination_disallowed",
  "discount_code_minimum_not_met",
  "discount_code_user_not_logged_in",
  "discount_code_user_ineligible",
  "discount_code_usage_limit_reached",
]);

export const MESSAGE_ERROR_CODES = new Set([
  "missing",
  "invalid",
  "out_of_stock",
  "payment_declined",
  "requires_sign_in",
  "requires_3ds",
  "low_stock",
  "quantity_exceeded",
  "coupon_invalid",
  "coupon_expired",
  "minimum_not_met",
  "maximum_exceeded",
  "region_restricted",
  "age_verification_required",
  "approval_required",
  "unsupported",
  "not_found",
  "conflict",
  "rate_limited",
  "expired",
  "intervention_required",
]);

const FIXED_COUPON_CATALOG = {
  SAVE20: {
    id: "coupon_summer2026",
    name: "Summer Sale 20% Off",
    percent_off: 20,
    duration: "once",
    max_redemptions: 1000,
    times_redeemed: 145,
    metadata: { source: "seed" },
  },
  FREESHIP: {
    id: "coupon_freeship2026",
    name: "Free Shipping",
    amount_off: 499, // minor unit
    currency: "INR",
    duration: "once",
    max_redemptions: 1000,
    times_redeemed: 60,
    metadata: { source: "seed", scope: "shipping" },
  },
  EXPIRED10: {
    id: "coupon_expired10",
    name: "Expired 10% Off",
    percent_off: 10,
    duration: "once",
    max_redemptions: 1000,
    times_redeemed: 1000,
    metadata: {
      source: "seed",
      expires_at: "2026-01-31T23:59:59.000Z",
    },
  },
};
const LOW_STOCK_WARNING_THRESHOLD = 3;

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

function normalizeSeverity(severity, fallback = "medium") {
  const allowed = new Set(["info", "low", "medium", "high", "critical"]);
  return allowed.has(severity) ? severity : fallback;
}

function normalizeContentType(contentType) {
  return contentType === "markdown" ? "markdown" : "plain";
}

export function createInfoMessage({
  severity = "info",
  param,
  content_type = "plain",
  content,
}) {
  return {
    type: "info",
    severity: normalizeSeverity(severity, "info"),
    ...(param ? { param } : {}),
    content_type: normalizeContentType(content_type),
    content: String(content || ""),
  };
}

export function createWarningMessage({
  code,
  severity = "medium",
  param,
  content_type = "plain",
  content,
}) {
  const safeCode = MESSAGE_WARNING_CODES.has(code)
    ? code
    : "limited_availability";
  return {
    type: "warning",
    code: safeCode,
    severity: normalizeSeverity(severity, "medium"),
    ...(param ? { param } : {}),
    content_type: normalizeContentType(content_type),
    content: String(content || ""),
  };
}

export function createErrorMessage({
  code,
  severity = "medium",
  param,
  content_type = "plain",
  content,
}) {
  const safeCode = MESSAGE_ERROR_CODES.has(code) ? code : "unsupported";
  return {
    type: "error",
    code: safeCode,
    severity: normalizeSeverity(severity, "medium"),
    ...(param ? { param } : {}),
    content_type: normalizeContentType(content_type),
    content: String(content || ""),
  };
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

export function validateDiscountsRequest(discounts) {
  console.log("[acpCheckout.validateDiscountsRequest] params", { discounts });
  if (discounts === undefined) return null;
  if (!discounts || typeof discounts !== "object") {
    console.log("[acpCheckout.validateDiscountsRequest] result", {
      error: "discounts must be an object with a codes array",
    });
    return "discounts must be an object with a codes array";
  }

  if (!Array.isArray(discounts.codes)) {
    console.log("[acpCheckout.validateDiscountsRequest] result", {
      error: "discounts.codes must be an array of strings",
    });
    return "discounts.codes must be an array of strings";
  }

  const hasInvalidCode = discounts.codes.some(
    (code) => typeof code !== "string" || code.trim() === ""
  );
  if (hasInvalidCode) {
    console.log("[acpCheckout.validateDiscountsRequest] result", {
      error: "discounts.codes must contain non-empty strings",
    });
    return "discounts.codes must contain non-empty strings";
  }

  console.log("[acpCheckout.validateDiscountsRequest] result", { error: null });
  return null;
}

export function normalizeDiscountCodes(discounts) {
  console.log("[acpCheckout.normalizeDiscountCodes] params", { discounts });
  if (!discounts || !Array.isArray(discounts.codes)) return [];
  const seen = new Set();
  const result = [];
  for (const rawCode of discounts.codes) {
    const normalized = String(rawCode || "").trim().toUpperCase();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  console.log("[acpCheckout.normalizeDiscountCodes] result", { codes: result });
  return result;
}

function toMinorUnit(amountMajor) {
  return Math.round((Number(amountMajor) || 0) * 100);
}

function fromMinorUnit(amountMinor) {
  return (Number(amountMinor) || 0) / 100;
}

function buildAcrossAllocations(items, targetAmountMinor) {
  if (!Array.isArray(items) || items.length === 0 || targetAmountMinor <= 0) return [];
  const itemMinors = items.map((item) => toMinorUnit(item.line_total));
  const subtotalMinor = itemMinors.reduce((sum, v) => sum + v, 0);
  if (subtotalMinor <= 0) return [];

  const allocations = itemMinors.map((itemMinor, index) => ({
    path: `$.line_items[${index}]`,
    amount: Math.floor((targetAmountMinor * itemMinor) / subtotalMinor),
  }));

  const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const remainder = targetAmountMinor - allocated;
  for (let i = 0; i < remainder; i += 1) {
    allocations[i % allocations.length].amount += 1;
  }

  return allocations.filter((a) => a.amount > 0);
}

function getCouponByCode(code) {
  return FIXED_COUPON_CATALOG[code] || null;
}

export function applyDiscounts({
  resolvedItems,
  shippingMajor = 0,
  currency = "USD",
  discounts,
}) {
  console.log("[acpCheckout.applyDiscounts] params", {
    itemCount: resolvedItems?.length || 0,
    shippingMajor,
    currency,
    discounts,
  });
  const codes = normalizeDiscountCodes(discounts);
  const applied = [];
  const rejected = [];
  const messages = [];

  const subtotalMinor = toMinorUnit(
    (resolvedItems || []).reduce((sum, item) => sum + (item.line_total || 0), 0)
  );
  const shippingMinor = toMinorUnit(shippingMajor);
  let runningDiscountMinor = 0;

  codes.forEach((code, index) => {
    console.log("[acpCheckout.applyDiscounts] evaluating code", {
      code,
      priority: index + 1,
    });
    const coupon = getCouponByCode(code);
    if (!coupon) {
      const reason = "discount_code_invalid";
      rejected.push({
        code,
        reason,
        message: "This discount code is invalid.",
      });
      messages.push(
        createWarningMessage({
          code: reason,
          severity: "medium",
          param: "$.discounts.codes",
          content: `Discount code ${code} is invalid.`,
        })
      );
      console.log("[acpCheckout.applyDiscounts] rejected", {
        code,
        reason,
      });
      return;
    }

    if (coupon.metadata?.expires_at && new Date(coupon.metadata.expires_at) < new Date()) {
      const reason = "discount_code_expired";
      rejected.push({
        code,
        reason,
        message: `This discount code expired on ${new Date(
          coupon.metadata.expires_at
        ).toDateString()}`,
      });
      messages.push(
        createWarningMessage({
          code: reason,
          severity: "medium",
          param: "$.discounts.codes",
          content: `Discount code ${code} has expired.`,
        })
      );
      console.log("[acpCheckout.applyDiscounts] rejected", {
        code,
        reason,
      });
      return;
    }

    if (
      typeof coupon.max_redemptions === "number" &&
      typeof coupon.times_redeemed === "number" &&
      coupon.times_redeemed >= coupon.max_redemptions
    ) {
      const reason = "discount_code_usage_limit_reached";
      rejected.push({
        code,
        reason,
        message: "This discount code has reached its usage limit.",
      });
      messages.push(
        createWarningMessage({
          code: reason,
          severity: "medium",
          param: "$.discounts.codes",
          content: `Discount code ${code} usage limit reached.`,
        })
      );
      console.log("[acpCheckout.applyDiscounts] rejected", {
        code,
        reason,
      });
      return;
    }

    let amountMinor = 0;
    let method = "across";
    let allocations = [];
    const lowerMetaScope = String(coupon.metadata?.scope || "").toLowerCase();

    if (typeof coupon.percent_off === "number") {
      amountMinor = Math.floor((subtotalMinor * coupon.percent_off) / 100);
      const maxAllowed = Math.max(0, subtotalMinor - runningDiscountMinor);
      amountMinor = Math.max(0, Math.min(amountMinor, maxAllowed));
      method = "across";
      allocations = buildAcrossAllocations(resolvedItems, amountMinor);
    } else if (typeof coupon.amount_off === "number") {
      if (
        coupon.currency &&
        String(coupon.currency).toUpperCase() !== String(currency).toUpperCase()
      ) {
        const reason = "discount_code_invalid";
        rejected.push({
          code,
          reason,
          message: `Discount currency ${coupon.currency} does not match checkout currency ${currency}.`,
        });
        messages.push(
          createWarningMessage({
            code: reason,
            severity: "medium",
            param: "$.discounts.codes",
            content: `Discount code ${code} currency mismatch.`,
          })
        );
        console.log("[acpCheckout.applyDiscounts] rejected", {
          code,
          reason,
        });
        return;
      }

      if (lowerMetaScope === "shipping") {
        amountMinor = Math.min(coupon.amount_off, shippingMinor);
        method = "each";
        allocations = amountMinor > 0 ? [{ path: "$.totals.shipping", amount: amountMinor }] : [];
      } else {
        const maxAllowed = Math.max(0, subtotalMinor - runningDiscountMinor);
        amountMinor = Math.max(0, Math.min(coupon.amount_off, maxAllowed));
        method = "across";
        allocations = buildAcrossAllocations(resolvedItems, amountMinor);
      }
    }

    if (amountMinor <= 0) {
      const reason = "discount_code_minimum_not_met";
      rejected.push({
        code,
        reason,
        message: "This discount code cannot be applied to the current cart.",
      });
      messages.push(
        createWarningMessage({
          code: reason,
          severity: "medium",
          param: "$.discounts.codes",
          content: `Discount code ${code} minimum not met.`,
        })
      );
      console.log("[acpCheckout.applyDiscounts] rejected", {
        code,
        reason,
      });
      return;
    }

    runningDiscountMinor += amountMinor;

    applied.push({
      id: `applied_discount_${Date.now()}_${index + 1}`,
      code,
      coupon,
      amount: amountMinor,
      automatic: false,
      start: new Date().toISOString(),
      end: coupon.metadata?.expires_at || undefined,
      method,
      priority: index + 1,
      allocations,
    });
    console.log("[acpCheckout.applyDiscounts] applied", {
      code,
      amountMinor,
      method,
      allocationCount: allocations.length,
    });
  });

  const result = {
    discounts: {
      codes,
      applied,
      rejected,
    },
    discountTotalMinor: applied.reduce((sum, d) => sum + d.amount, 0),
    messages,
  };
  console.log("[acpCheckout.applyDiscounts] result", {
    codes: result.discounts.codes,
    appliedCount: result.discounts.applied.length,
    rejectedCount: result.discounts.rejected.length,
    discountTotalMinor: result.discountTotalMinor,
  });
  return result;
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
        ...createErrorMessage({
          code: "not_found",
          severity: "high",
          param: "$.items",
          content: `Item not found: ${id}`,
        }),
      })),
    };
  }
  // ❌ Stock check
  const outOfStock = [];
  const warnings = [];

  const resolvedItems = items.map((item, index) => {
    const product = productMap.get(item.id);

    if ((product.stock ?? 0) < item.quantity) {
      outOfStock.push(
        createErrorMessage({
          code: "out_of_stock",
          severity: "medium",
          param: "$.items",
          content: `${product.name} has only ${product.stock ?? 0} left`,
        })
      );
    } else if ((product.stock ?? 0) <= LOW_STOCK_WARNING_THRESHOLD) {
      warnings.push(
        createWarningMessage({
          code: "low_stock",
          severity: "medium",
          param: `$.line_items[${index}]`,
          content: `Only ${product.stock ?? 0} items left in stock`,
        })
      );
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

  return { resolvedItems, messages: warnings };
}

/* -------------------------------------------
   Pricing Calculation
------------------------------------------- */
export function buildPricing(resolvedItems, fulfillmentOption, discountTotalMinor = 0) {
  console.log("[acpCheckout.buildPricing] params", {
    itemCount: resolvedItems?.length || 0,
    fulfillmentOptionId: fulfillmentOption?.id,
    shipping: fulfillmentOption?.amount || 0,
    discountTotalMinor,
  });
  const subtotal = resolvedItems.reduce((sum, item) => sum + item.line_total, 0);

  const tax = 0;
  const shipping = fulfillmentOption?.amount || 0;
  const discount = fromMinorUnit(discountTotalMinor);

  const total = Math.max(0, subtotal + tax + shipping - discount);

  const currency = resolvedItems[0]?.currency || "USD";

  const pricing = {
    subtotal,
    discount,
    tax,
    shipping,
    total,
    currency,
  };
  console.log("[acpCheckout.buildPricing] result", pricing);
  return pricing;
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
  const payload = {
    id: sessionDoc.session_id,
    status: sessionDoc.status,

    buyer: sessionDoc.buyer,
    items: sessionDoc.items,

    fulfillment_address: sessionDoc.fulfillment_address,
    fulfillment_option_id: sessionDoc.fulfillment_option_id,

    available_fulfillment_options:
      sessionDoc.available_fulfillment_options || [],

    pricing: sessionDoc.pricing,
    discounts: {
      codes: sessionDoc.discounts?.codes || [],
      applied: sessionDoc.discounts?.applied || [],
      rejected: sessionDoc.discounts?.rejected || [],
    },

    messages: sessionDoc.messages || [],

    created_at: sessionDoc.createdAt,
    updated_at: sessionDoc.updatedAt,
  };
  console.log("[acpCheckout.serializeCheckoutSession] result", {
    sessionId: payload.id,
    status: payload.status,
    codeCount: payload.discounts.codes.length,
    appliedCount: payload.discounts.applied.length,
    rejectedCount: payload.discounts.rejected.length,
  });
  return payload;
}
