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
    totalPrice: Number,
    paymentStatus: String,
    status: String,
  },
  { timestamps: true }
);

export default mongoose.models.Order ||
  mongoose.model("Order", OrderSchema);






// import mongoose from "mongoose";

// const OrderSchema = new mongoose.Schema({
//   orderId: { type: String, required: true, unique: true },
//   checkout: {
//     session_id: String,
//   },
//   buyer: {
//     first_name: String,
//     last_name: String,
//     email: String,
//   },
//   items: [
//     {
//       id: String,   // ✅ FIX
//       name: String,
//       price: Number,
//       quantity: Number,
//       currency: String,
//     }
//   ],
//   totalPrice: Number,
//   paymentStatus: { type: String, default: "pending" },
//   status: { type: String, default: "pending" },
// }, { timestamps: true });

// export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
