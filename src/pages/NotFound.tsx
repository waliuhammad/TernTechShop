import { Link } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-20">
      <Seo noindex title="Route Not Found" />

      <div className="max-w-lg space-y-8 text-center">
        <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
          // ERROR_404: NODE_UNREACHABLE
        </p>
        <h1 className="text-6xl font-black tracking-tighter text-slate-900 uppercase italic md:text-8xl">
          404
        </h1>
        <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">
          Route <span className="text-primary not-italic">Not Found</span>
        </h2>
        <p className="leading-relaxed font-medium text-slate-500">
          The registry could not resolve this address. The node may have been decommissioned or the
          path mistyped.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="primary-btn">
            Return to Base
          </Link>
          <Link to="/shop" className="secondary-btn">
            Browse Registry
          </Link>
        </div>
      </div>
    </div>
  );
}
