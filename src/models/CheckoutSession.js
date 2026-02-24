import mongoose from "mongoose";

const CheckoutItemSchema = new mongoose.Schema(
  {
    id: { type: String },
    name: { type: String },
    quantity: { type: Number },
    unit_price: { type: Number },
    line_total: { type: Number },
    currency: { type: String },
  },
  { _id: false }
);

const FulfillmentOptionSchema = new mongoose.Schema(
  {
    id: { type: String },
    label: { type: String },
    type: { type: String },
    amount: { type: Number },
    currency: { type: String },
    eta_days: { type: Number },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    type: { type: String },
    code: { type: String },
    severity: { type: String },
    param: { type: String },
    content_type: { type: String },
    content: { type: String },
  },
  { _id: false }
);

const DiscountAllocationSchema = new mongoose.Schema(
  {
    path: { type: String },
    amount: { type: Number }, // minor currency unit
  },
  { _id: false }
);

const CouponSchema = new mongoose.Schema(
  {
    id: { type: String },
    name: { type: String },
    percent_off: { type: Number },
    amount_off: { type: Number }, // minor currency unit
    currency: { type: String },
    duration: { type: String },
    duration_in_months: { type: Number },
    max_redemptions: { type: Number },
    times_redeemed: { type: Number },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const AppliedDiscountSchema = new mongoose.Schema(
  {
    id: { type: String },
    code: { type: String },
    coupon: { type: CouponSchema, default: null },
    amount: { type: Number }, // minor currency unit
    automatic: { type: Boolean, default: false },
    start: { type: String },
    end: { type: String },
    method: { type: String },
    priority: { type: Number },
    allocations: { type: [DiscountAllocationSchema], default: [] },
  },
  { _id: false }
);

const RejectedDiscountSchema = new mongoose.Schema(
  {
    code: { type: String },
    reason: { type: String },
    message: { type: String },
  },
  { _id: false }
);

const CheckoutSessionSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true },

    buyer: {
      first_name: String,
      last_name: String,
      email: String,
      phone: String,
    },

    items: { type: [CheckoutItemSchema], default: [] },

    fulfillment_address: {
      name: String,
      line_one: String,
      city: String,
      state: String,
      country: String,
      postal_code: String,
    },

    fulfillment_option_id: String,

    available_fulfillment_options: {
      type: [FulfillmentOptionSchema],
      default: [],
    },

    pricing: {
      subtotal: Number,
      discount: Number,
      tax: Number,
      shipping: Number,
      total: Number,
      currency: String,
    },

    discounts: {
      codes: { type: [String], default: [] },
      applied: { type: [AppliedDiscountSchema], default: [] },
      rejected: { type: [RejectedDiscountSchema], default: [] },
    },

    messages: { type: [MessageSchema], default: [] },

    stripePaymentIntentId: String,
    orderId: String,

    status: { type: String, default: "pending" }, // pending, completed, cancelled

    expiresAt: {
      type: Date,
      default: function () {
        // return new Date(Date.now() + 10 * 1000); // 10 seconds
        return new Date(Date.now() + 15 * 60 * 1000); // 10 minutes
      },
    },

    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);


export default mongoose.models.CheckoutSession ||
  mongoose.model("CheckoutSession", CheckoutSessionSchema);
