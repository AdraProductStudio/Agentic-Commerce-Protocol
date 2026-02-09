import "bootstrap/dist/css/bootstrap.min.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ChatWidget from "../components/ChatWidget";
import { CartProvider } from "../components/CartContext";

export const metadata = {
  title: "Retail ACP Demo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-light">
        <CartProvider>
          <Navbar />
          {children}
          {/* <Footer /> */}

          {/* Floating Agent Always Visible */}
          <ChatWidget />
        </CartProvider>
      </body>
    </html>
  );
}
