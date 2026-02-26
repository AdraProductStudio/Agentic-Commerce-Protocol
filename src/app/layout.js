import "bootstrap/dist/css/bootstrap.min.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ChatWidgetAuthGate from "../components/ChatWidgetAuthGate";
import { CartProvider } from "../components/CartContext";

export const metadata = {
  title: "Adra Store",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-light">
        <CartProvider>
          <Navbar />
          {children}
          {/* <Footer /> */}

          {/* Floating Agent for logged in users only */}
          <ChatWidgetAuthGate />
        </CartProvider>
      </body>
    </html>
  );
}
