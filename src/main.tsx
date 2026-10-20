import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import App from "./App";
import { CartProvider } from "@/context/CartContext";
import { LoyaltyProvider } from "@/context/LoyaltyContext";
import { ThemeProvider } from "@/context/ThemeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {/* سبد خرید و باشگاه مشتریان بیرون از روتر می‌نشینند تا هنگام جابه‌جایی بین
          صفحه‌ها (و رفت‌وبرگشت به درگاه پرداخت) از دست نروند. */}
      <CartProvider>
        <LoyaltyProvider>
          <App />
        </LoyaltyProvider>
      </CartProvider>
    </ThemeProvider>
  </StrictMode>
);
