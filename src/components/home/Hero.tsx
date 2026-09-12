import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { heroStats } from '@/config/site';
import { resolveIcon } from '@/lib/icons';

const HERO_BACKDROP =
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1600';
const HERO_PRODUCT =
  'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&q=80&w=800';

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative mt-12 flex min-h-[600px] items-center overflow-hidden bg-white md:mt-20 md:h-[750px]">
      {/* Backdrop, faded almost out and washed to white on the left. */}
      <div className="absolute inset-0 opacity-10">
        <img
          src={HERO_BACKDROP}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between px-4 text-slate-900 sm:px-6 md:flex-row lg:px-8">
        <div className="max-w-2xl space-y-8 py-12 md:space-y-10 md:py-0">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-[10px] font-bold tracking-widest text-primary uppercase">
              Industrial Hardware Distribution
            </span>

            {/* Clamped so the display type cannot overflow at 390px. */}
            <h1 className="text-[clamp(2.75rem,12vw,6rem)] leading-[0.9] font-black tracking-tighter text-slate-900 uppercase italic md:text-8xl">
              Performance
              <br />
              <span className="tracking-tight text-primary not-italic">Refined.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed font-medium text-slate-600 md:text-xl">
              Equipping the next generation of builders with industrial-strength components,
              enterprise networking solutions, and professional computing hardware.
            </p>
          </motion.div>

          <div className="flex flex-wrap gap-4 pt-2 md:gap-5 md:pt-4">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="primary-btn group flex items-center gap-4 px-8 py-4 text-base md:px-10 md:py-5 md:text-lg"
            >
              Explore Components
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/about')}
              className="secondary-btn border-slate-200 bg-slate-100 px-8 py-4 text-base hover:bg-slate-200 md:px-10 md:py-5 md:text-lg"
            >
              Our Heritage
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-10 md:gap-12 md:pt-16">
            {heroStats.map((stat) => {
              const Icon = resolveIcon(stat.iconKey);
              return (
                <div key={stat.label} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="shrink-0 text-primary" />
                    <span className="text-sm font-black text-slate-900 sm:text-base md:text-lg">
                      {stat.value}
                    </span>
                  </div>
                  <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase sm:text-[10px]">
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Product panel — desktop only, as on the reference. */}
        <div className="relative hidden h-full md:block">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative z-20"
          >
            <div className="relative flex aspect-square w-[340px] items-center justify-center overflow-hidden rounded-[4rem] border border-slate-200 bg-slate-50 p-12 lg:w-[450px]">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent" />
              <img
                src={HERO_PRODUCT}
                alt="Featured graphics accelerator"
                fetchPriority="high"
                className="h-full w-full object-contain drop-shadow-2xl"
              />
            </div>

            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-6 -right-6 z-30 rounded-full border-4 border-white bg-primary p-6 text-white shadow-2xl"
            >
              <Zap size={32} />
            </motion.div>
          </motion.div>

          <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-primary/5 blur-[100px]" />
        </div>
      </div>

      {/* Scroll rail */}
      <div className="absolute right-12 bottom-12 hidden flex-col items-center gap-4 lg:flex">
        <div className="h-16 w-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-1/2 w-full bg-primary" />
        </div>
        <p className="font-mono text-[10px] tracking-widest text-slate-300 uppercase [writing-mode:vertical-lr]">
          Scroll Manifest
        </p>
      </div>
    </section>
  );
}
