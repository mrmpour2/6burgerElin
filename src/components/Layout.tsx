import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router-dom";
import { AddOnSheet } from "@/components/AddOnSheet";
import { CartDrawer } from "@/components/CartDrawer";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PaymentOutcome } from "@/components/PaymentOutcome";
import { AddOnPanelProvider } from "@/context/AddOnContext";
import { useMotionSystem } from "@/hooks/useMotionSystem";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { refreshMotion, scrollToTop } from "@/motion/smoothScroll";

const ChatBox = lazy(() => import("@/components/ChatBox"));

function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Lenis owns the scroll position once it is running, so a route change goes
    // through it and every trigger is re-measured against the new page.
    scrollToTop();
    refreshMotion();
  }, [pathname]);
  return null;
}

export function Layout() {
  const { i18n } = useTranslation();
  const [chatReady, setChatReady] = useState(false);
  const language = i18n.resolvedLanguage?.startsWith("fa") ? "fa" : "en";

  // One Lenis loop and one GSAP context for the whole app; both are torn down on
  // unmount and re-claim lazily mounted sections through their own observers.
  useSmoothScroll();
  useMotionSystem();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    document.title =
      language === "fa"
        ? "شیش برگر الین | برگر برای شب‌های بیرجند"
        : "شیش برگر الین | Built for the next bite";
    // `dir` flips the reveal direction and every pinned/parallax measurement.
    refreshMotion();
  }, [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => setChatReady(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-bun-paper text-bun-text">
      <ScrollManager />
      {/* پنل مخلفات بالای همه است تا دکمه‌های «افزودن به سبد» هر صفحه (و کشوی
          سبد) بتوانند همان پنل را باز کنند. */}
      <AddOnPanelProvider>
        <Navbar />
        <main>
          <Outlet />
        </main>
        <Footer />
        {/* سبد خرید و نتیجه بازگشت از درگاه روی هر مسیری در دسترس‌اند. */}
        <CartDrawer />
        <AddOnSheet />
      </AddOnPanelProvider>
      <PaymentOutcome />
      {/* Pointer follower for `initCursor`; purely decorative. */}
      <div data-cursor="" aria-hidden="true">
        <span data-cursor-label="" />
      </div>
      {chatReady ? (
        <Suspense fallback={null}>
          <ChatBox />
        </Suspense>
      ) : null}
    </div>
  );
}