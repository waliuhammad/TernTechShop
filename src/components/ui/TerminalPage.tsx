import { cn } from '@/lib/utils';

interface TerminalPageProps {
  /** Mono pill above the title, e.g. LOGISTICS_MANIFEST_V4. */
  badge: string;
  badgeTone?: 'blue' | 'emerald' | 'slate';
  title: string;
  intro: string;
  children: React.ReactNode;
  /** Centres the header block, as /legal does. */
  centered?: boolean;
}

const BADGE_TONES = {
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  slate: 'bg-slate-800 border-slate-700 text-slate-400',
} as const;

/**
 * Shared shell for the dark information pages (/shipping, /warranty, /about,
 * /contact, /legal). These deliberately use a softer heading register than the
 * storefront — `font-bold tracking-tight`, not heavy italic uppercase.
 */
export function TerminalPage({
  badge,
  badgeTone = 'blue',
  title,
  intro,
  children,
  centered = false,
}: TerminalPageProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <header className={cn('mb-14 space-y-6 md:mb-20', centered && 'text-center')}>
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.2em] uppercase md:text-xs',
              BADGE_TONES[badgeTone],
            )}
          >
            {badge}
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
          <p
            className={cn(
              'text-lg leading-relaxed text-slate-400 md:text-xl',
              centered ? 'mx-auto max-w-xl' : 'max-w-3xl',
            )}
          >
            {intro}
          </p>
        </header>

        {children}
      </div>
    </div>
  );
}
