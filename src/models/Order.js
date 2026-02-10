import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },

    product: {
      id: Number,
      name: String,
      price: Number,
      color: String,
    },

    status: {
      type: String,
      default: "confirmed",
    },

    paymentStatus: {
      type: String,
      default: "paid",
    },

    stripeSessionId: String,
  },
  { timestamps: true }
);

export default mongoose.models.Order ||
  mongoose.model("Order", OrderSchema);
