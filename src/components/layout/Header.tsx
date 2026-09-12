import { AnimatePresence, motion } from 'framer-motion';
import { Cpu, Heart, LogOut, Menu, Search, ShieldCheck, ShoppingCart, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { mainNav, siteConfig } from '@/config/site';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { cn } from '@/lib/utils';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Seeded from the real scroll position so a reload part-way down the page
  // paints the solid header immediately instead of flashing the transparent one.
  const [scrolled, setScrolled] = useState(() => window.scrollY > 20);
  const { totalItems } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const closeMenu = () => setMenuOpen(false);

  // The header switches to its solid state past 20px, matching the reference.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the full-screen menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <nav
      className={cn(
        'fixed top-0 right-0 left-0 z-[1000] transition-all duration-500',
        scrolled
          ? 'border-b border-slate-100 bg-white/90 py-3 shadow-sm backdrop-blur-xl'
          : 'bg-transparent py-6',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="group flex shrink-0 items-center gap-3" aria-label={siteConfig.name}>
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all group-hover:scale-110 group-hover:rotate-6',
                scrolled ? 'bg-primary text-white' : 'bg-white text-primary',
              )}
            >
              <Cpu size={24} />
            </div>
            {/* The full wordmark does not fit beside five actions at 390px,
                so the descriptor drops away below `sm`. */}
            <span className="text-xl font-black tracking-tighter text-slate-900 uppercase italic sm:text-2xl">
              {siteConfig.wordmark.lead}
              <span className="hidden font-medium text-primary not-italic sm:inline">
                {' '}
                {siteConfig.wordmark.accent}
              </span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center space-x-10 text-[11px] font-bold tracking-widest uppercase lg:flex">
            {mainNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'group relative transition-all',
                    isActive ? 'text-primary' : 'text-slate-600 hover:text-primary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.name}
                    <span
                      className={cn(
                        'absolute -bottom-1 left-1/2 h-1 -translate-x-1/2 rounded-full bg-primary transition-all',
                        isActive
                          ? 'w-full opacity-100'
                          : 'w-0 opacity-0 group-hover:w-full group-hover:opacity-100',
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-3">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              aria-label="Search the registry"
              className="hidden cursor-pointer rounded-xl p-2.5 text-slate-500 transition-all hover:bg-slate-50 hover:text-primary md:flex"
            >
              <Search size={20} />
            </button>

            <Link
              to="/wishlist"
              aria-label={`Watchlist, ${wishlistCount} items`}
              className="relative rounded-xl p-2.5 text-slate-600 transition-all hover:bg-slate-50 hover:text-primary"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </Link>

            <Link
              to="/cart"
              aria-label={`Hardware cart, ${totalItems} items`}
              className="relative rounded-xl p-2.5 text-slate-600 transition-all hover:bg-slate-50 hover:text-primary"
            >
              <ShoppingCart size={20} />
              {totalItems > 0 && (
                <motion.span
                  key={totalItems}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-black text-white shadow-lg"
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </motion.span>
              )}
            </Link>

            {isStaff && (
              <Link
                to="/admin"
                className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-primary shadow-sm transition-all hover:bg-primary hover:text-white md:px-4"
              >
                <ShieldCheck size={18} />
                <span className="hidden text-[10px] font-black tracking-tighter uppercase xl:inline">
                  Admin Portal
                </span>
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/account"
                  aria-label="My account"
                  className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-slate-600 transition-all hover:border-primary/20 hover:text-primary"
                >
                  <User size={20} />
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Terminal exit"
                  className="hidden cursor-pointer rounded-xl bg-rose-50 p-2.5 text-rose-500 transition-all hover:bg-rose-500 hover:text-white sm:block"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className={cn(
                  'cursor-pointer rounded-xl p-2.5 text-xs font-bold tracking-widest uppercase shadow-xl transition-all md:px-6 md:py-2.5',
                  scrolled
                    ? 'bg-slate-900 text-white hover:bg-primary'
                    : 'bg-white text-slate-900 hover:bg-primary hover:text-white',
                )}
              >
                <User size={20} className="md:hidden" />
                <span className="hidden md:inline">Login Hub</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className={cn(
                'cursor-pointer rounded-xl p-3 transition-colors lg:hidden',
                scrolled ? 'bg-slate-100 text-slate-900' : 'bg-white/60 text-slate-900',
              )}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[999] overflow-y-auto bg-white p-6 pt-28 lg:hidden"
          >
            <div className="space-y-6">
              {mainNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={closeMenu}
                  className="block text-4xl font-black tracking-tighter text-slate-900 uppercase italic transition-colors hover:text-primary"
                >
                  {item.name}
                </Link>
              ))}

              <div className="flex flex-col gap-4 border-t border-slate-100 pt-10">
                <Link to="/cart" onClick={closeMenu} className="primary-btn text-center">
                  Hardware Cart ({totalItems})
                </Link>
                <Link to="/wishlist" onClick={closeMenu} className="secondary-btn text-center">
                  Watchlist ({wishlistCount})
                </Link>
                {isStaff && (
                  <Link to="/admin" onClick={closeMenu} className="tech-btn py-3 text-center">
                    Admin Portal
                  </Link>
                )}
                {user ? (
                  <>
                    <Link to="/account" onClick={closeMenu} className="secondary-btn text-center">
                      My Account
                    </Link>
                    <Link to="/orders" onClick={closeMenu} className="secondary-btn text-center">
                      My Deployments
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        signOut();
                      }}
                      className="secondary-btn"
                    >
                      Terminal Exit
                    </button>
                  </>
                ) : (
                  <Link to="/login" onClick={closeMenu} className="secondary-btn text-center">
                    Login Hub
                  </Link>
                )}
                <Link to="/contact" onClick={closeMenu} className="secondary-btn text-center">
                  Contact Engineer
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
