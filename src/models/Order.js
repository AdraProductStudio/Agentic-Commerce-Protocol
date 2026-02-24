import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    checkout: {
      session_id: String,
    },
    buyer: {
      first_name: String,
      last_name: String,
      email: String,
    },
    items: [
      {
        id: String,
        name: String,
        price: Number,
        quantity: Number,
        currency: String,
      },
    ],
    discounts: {
      codes: [String],
      applied: [mongoose.Schema.Types.Mixed],
      rejected: [mongoose.Schema.Types.Mixed],
    },
    subtotalPrice: Number,
    shippingPrice: Number,
    discountValue: Number,
    totalPrice: Number,
    paymentStatus: String,
    status: String,
  },
  { timestamps: true }
);

export default mongoose.models.Order ||
  mongoose.model("Order", OrderSchema);
