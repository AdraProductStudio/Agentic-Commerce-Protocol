import mongoose from "mongoose";

const CheckoutSessionSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true },
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
    fulfillment_address: {
      name: String,
      line_one: String,
      city: String,
      state: String,
      country: String,
      postal_code: String,
    },
    subtotal: Number,
    tax: Number,
    total: Number,
    stripePaymentIntentId: String,
    status: { type: String, default: "pending" }, // pending, completed, cancelled
  },
  { timestamps: true }
);

export default mongoose.models.CheckoutSession ||
  mongoose.model("CheckoutSession", CheckoutSessionSchema);






// import mongoose from "mongoose";

// const CheckoutSessionSchema = new mongoose.Schema(
//   {
//     session_id: {
//       type: String,
//       required: true,
//       unique: true,
//     },

//     buyer: {
//       first_name: String,
//       last_name: String,
//       email: String,
//     },

//     items: [
//       {
//         id: {
//           type: String, // ✅ MUST BE STRING
//           required: true,
//         },
//         name: String,
//         price: Number,
//         quantity: Number,
//         currency: String,
//       },
//     ],

//     fulfillment_address: {
//       name: String,
//       line_one: String,
//       city: String,
//       state: String,
//       country: String,
//       postal_code: String,
//     },

//     subtotal: Number,
//     tax: Number,
//     total: Number,

//     status: {
//       type: String,
//       default: "pending",
//     },
//   },
//   { timestamps: true }
// );

// export default mongoose.models.CheckoutSession ||
//   mongoose.model("CheckoutSession", CheckoutSessionSchema);
