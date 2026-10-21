import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layout } from "@/components/Layout";
import { PageLoader } from "@/components/PageLoader";

const HomePage = lazy(() => import("@/pages/HomePage"));
const MenuPage = lazy(() => import("@/pages/MenuPage"));
const ProductPage = lazy(() => import("@/pages/ProductPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const LoyaltyPage = lazy(() => import("@/pages/LoyaltyPage"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const BlogPostPage = lazy(() => import("@/pages/BlogPostPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="menu/:id" element={<ProductPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="loyalty" element={<LoyaltyPage />} />
              <Route path="blog" element={<BlogPage />} />
              <Route path="blog/:id" element={<BlogPostPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}