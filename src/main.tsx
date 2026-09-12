import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { CatalogProvider } from '@/context/CatalogContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ToastProvider } from '@/context/ToastContext';
import { WishlistProvider } from '@/context/WishlistContext';
import '@/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// BASE_URL matters when the build is deployed to a Hostinger subfolder.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

// Provider order matters: Cart and Wishlist read both the signed-in user and
// the live catalog, so Auth and Catalog must sit above them.
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={basename || undefined}>
        <ToastProvider>
          <AuthProvider>
            <SettingsProvider>
              <CatalogProvider>
                <WishlistProvider>
                  <CartProvider>
                    <App />
                  </CartProvider>
                </WishlistProvider>
              </CatalogProvider>
            </SettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
