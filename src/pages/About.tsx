import { Seo } from '@/components/ui/Seo';
import { TerminalPage } from '@/components/ui/TerminalPage';
import { heritageBlocks } from '@/data/site-data';
import { totalProductCount } from '@/data/products';
import { categories } from '@/data/categories';

const STATS = [
  { value: `${totalProductCount}+`, label: 'Units Indexed' },
  { value: `${categories.length}`, label: 'Departments' },
  { value: '24/7', label: 'Support Tech' },
  { value: 'Nationwide', label: 'Logistics Reach' },
];

export default function About() {
  return (
    <>
      <Seo
        title="Technical Heritage"
        description="Forging the future of high-performance computing through decades of engineering excellence."
      />

      <TerminalPage
        badge="SYSTEM_HISTORY_LOG"
        title="Technical Heritage"
        intro="Forging the future of high-performance computing through decades of engineering excellence."
      >
        <div className="space-y-10 md:space-y-12">
          {heritageBlocks.map((block) => (
            <section key={block.title} className="space-y-4">
              <h2 className="text-xl font-bold md:text-2xl">{block.title}</h2>
              <p className="leading-relaxed text-slate-400">{block.body}</p>
            </section>
          ))}

          <section className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center"
              >
                <p className="text-2xl font-bold text-blue-400 md:text-3xl">{stat.value}</p>
                <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </section>

          <section className="space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-8">
            <h3 className="text-lg font-bold text-slate-100">Our Mission</h3>
            <p className="leading-relaxed text-slate-400">
              To provide the hardware foundation for the next level of human innovation. We don't
              just sell parts; we provide the raw power necessary to build worlds, simulate futures,
              and achieve the impossible.
            </p>
          </section>
        </div>
      </TerminalPage>
    </>
  );
}
