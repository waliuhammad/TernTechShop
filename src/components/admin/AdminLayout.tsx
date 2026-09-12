import {
  ArrowLeft,
  Cpu,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Package,
  MessageSquareText,
  ShieldAlert,
  Tag,
  Truck,
  Users,
} from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: Truck, end: false },
  { to: '/admin/products', label: 'Products', icon: Package, end: false },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree, end: false },
  { to: '/admin/customers', label: 'Customers', icon: Users, end: false },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareText, end: false },
  { to: '/admin/inbox', label: 'Inbox', icon: Inbox, end: false },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag, end: false },
] as const;

/**
 * Admin shell and guard.
 *
 * The guard is a usability measure, not the security boundary: a visitor who
 * bypassed it would reach pages whose every read and write firestore.rules
 * refuses. That is why this can safely be client-side on a static site.
 */
export function AdminLayout() {
  const { user, role, isStaff, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <Seo title="Access Denied" />
        <div className="max-w-md space-y-6 text-center">
          <ShieldAlert size={44} className="mx-auto text-rose-400" />
          <h1 className="text-3xl font-bold tracking-tight">Access denied</h1>
          <p className="leading-relaxed text-slate-400">
            Unauthorized access. Only hardware admins allowed.
          </p>
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left font-mono text-xs leading-relaxed text-slate-400">
            Signed in as {user.email}
            <br />
            UID: {user.uid}
            <br />
            <br />
            If this is your account and you were just granted admin, sign out and sign back in —
            the role is read at sign-in.
          </p>
          <div className="flex justify-center gap-3">
            <NavLink to="/" className="secondary-btn">
              Back to Store
            </NavLink>
            <button type="button" onClick={() => void signOut()} className="primary-btn">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Seo title="Admin Portal" />

      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-6 lg:flex">
        <NavLink to="/" className="group mb-10 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg transition-transform group-hover:scale-110">
            <Cpu size={22} />
          </div>
          <div>
            <p className="text-lg leading-none font-black tracking-tighter uppercase italic">Tern</p>
            <p className="font-mono text-[10px] tracking-widest text-primary uppercase">
              Admin Portal
            </p>
          </div>
        </NavLink>

        <nav className="flex flex-grow flex-col gap-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-4 rounded-2xl px-5 py-3.5 font-bold transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} className="transition-transform group-hover:scale-110" />
                  <span className="flex-grow">{label}</span>
                  {isActive && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <div className="px-2">
            <p className="truncate text-sm font-bold text-slate-900">{user.email}</p>
            <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">{role}</p>
          </div>
          <NavLink
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-primary"
          >
            <ArrowLeft size={16} />
            Back to Store
          </NavLink>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-rose-500 transition-colors hover:bg-rose-50"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Top bar — mobile/tablet */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Cpu size={18} />
            </div>
            <span className="font-mono text-[10px] font-bold tracking-widest text-primary uppercase">
              Admin Portal
            </span>
          </NavLink>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="cursor-pointer rounded-lg bg-rose-50 p-2 text-rose-500"
          >
            <LogOut size={18} />
          </button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors',
                  isActive ? 'bg-primary text-white' : 'bg-slate-50 text-slate-500',
                )
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-grow p-4 sm:p-8 lg:p-12">
        <Outlet />
      </main>
    </div>
  );
}
