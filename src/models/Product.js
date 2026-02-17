import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: String,
    brand: String,
    price: Number,
    currency: String,
    currency_symbol: String,
    stock: Number,
    image: String,
    category: String,
  },
  { timestamps: true }
);

export default mongoose.models.Product ||
  mongoose.model("Product", productSchema);
