import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

/**
 * Restores scroll position on navigation. Without this, moving between routes
 * keeps the previous scroll offset and pages appear to open half-way down.
 * Hash links (/legal#privacy) are left alone so the browser can anchor.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      <ScrollToTop />
      <Header />
      <main className="flex-grow pt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
