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
    code: { type: String },
    level: { type: String },
    text: { type: String },
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
      tax: Number,
      shipping: Number,
      total: Number,
      currency: String,
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


