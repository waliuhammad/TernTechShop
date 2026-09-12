import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { RouteFallback } from '@/components/ui/RouteFallback';

// Home loads eagerly (it is the entry point for most visits); everything else
// is split into its own chunk so the initial bundle stays small.
import Home from '@/pages/Home';

const Shop = lazy(() => import('@/pages/Shop'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'));
const Orders = lazy(() => import('@/pages/Orders'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Login = lazy(() => import('@/pages/Login'));
const Account = lazy(() => import('@/pages/Account'));
const Shipping = lazy(() => import('@/pages/Shipping'));
const Warranty = lazy(() => import('@/pages/Warranty'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const Legal = lazy(() => import('@/pages/Legal'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Admin screens ship as their own chunks — shoppers never download them.
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminOrderDetail = lazy(() => import('@/pages/admin/OrderDetail'));
const AdminProducts = lazy(() => import('@/pages/admin/Products'));
const AdminProductEditor = lazy(() => import('@/pages/admin/ProductEditor'));
const AdminCustomers = lazy(() => import('@/pages/admin/Customers'));
const AdminCoupons = lazy(() => import('@/pages/admin/Coupons'));
const AdminReviews = lazy(() => import('@/pages/admin/Reviews'));
const AdminInbox = lazy(() => import('@/pages/admin/Inbox'));

/** /category/:slug is not a route here; forward it to the filtered catalog. */
function CategoryRedirect() {
  const { slug = '' } = useParams<{ slug: string }>();
  const name = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return <Navigate to={`/shop?category=${encodeURIComponent(name)}`} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Admin — its own shell, outside the storefront header and footer. */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:orderId" element={<AdminOrderDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductEditor />} />
          <Route path="products/:productId" element={<AdminProductEditor />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="inbox" element={<AdminInbox />} />
        </Route>
        <Route path="admin-login" element={<Navigate to="/login" replace state={{ from: '/admin' }} />} />

        <Route element={<Layout />}>
          <Route index element={<Home />} />

          {/* Storefront */}
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-confirmation/:manifestId" element={<OrderConfirmation />} />
          <Route path="orders" element={<Orders />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="login" element={<Login />} />
          <Route path="account" element={<Account />} />

          {/* Information */}
          <Route path="shipping" element={<Shipping />} />
          <Route path="warranty" element={<Warranty />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="legal" element={<Legal />} />

          {/* Conventional URLs kept working, pointed at the real routes. */}
          <Route path="privacy" element={<Navigate to="/legal#privacy" replace />} />
          <Route path="terms" element={<Navigate to="/legal#terms" replace />} />
          <Route path="refund" element={<Navigate to="/legal#returns" replace />} />
          <Route path="returns" element={<Navigate to="/legal#returns" replace />} />
          <Route path="cookies" element={<Navigate to="/legal#cookies" replace />} />
          <Route path="products" element={<Navigate to="/shop" replace />} />
          <Route path="search" element={<Navigate to="/shop" replace />} />
          <Route path="category/:slug" element={<CategoryRedirect />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
