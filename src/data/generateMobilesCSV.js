const fs = require("fs");

const brands = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "OnePlus",
  "Realme",
  "Vivo",
];

const currencies = [
  "INR",
];

const currencySymbols = {
  INR: "₹",
};

let csv = "name,brand,price,currency,currency_symbol,stock,image,category\n";

for (let i = 1; i <= 10000; i++) {
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const currency = currencies[Math.floor(Math.random() * currencies.length)];
  const currencySymbol = currencySymbols[currency] || currency;

  const name = `${brand} Mobile Model ${i}`;
  const price = Math.floor(Math.random() * 90000) + 10000;
  const stock = Math.floor(Math.random() * 200) + 1;

  // ✅ Image URL (No real image files needed)
  const image = `https://source.unsplash.com/400x400/?smartphone&sig=${i}`;

  csv += `${name},${brand},${price},${currency},${currencySymbol},${stock},${image},Mobiles\n`;
}

fs.writeFileSync("mobiles.csv", csv);

console.log("✅ mobiles.csv with images created!");
