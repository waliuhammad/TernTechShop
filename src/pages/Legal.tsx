import { Seo } from '@/components/ui/Seo';
import { TerminalPage } from '@/components/ui/TerminalPage';
import { legalSections } from '@/data/site-data';

export default function Legal() {
  return (
    <>
      <Seo
        title="Legal Compliance Center"
        description="Governance of our hardware distribution network and digital infrastructure."
      />

      <TerminalPage
        badge="System Legal Framework"
        badgeTone="slate"
        title="Legal Compliance Center"
        intro="The following documents outline the governance of our hardware distribution network and digital infrastructure."
        centered
      >
        <div className="space-y-16 md:space-y-20">
          {legalSections.map((section) => (
            // scroll-mt clears the fixed header when linked from the footer.
            <section key={section.id} id={section.id} className="scroll-mt-32 space-y-6">
              <h2 className="text-2xl font-bold md:text-3xl">{section.title}</h2>
              <p className="leading-relaxed text-slate-400">{section.body}</p>

              {'quote' in section && section.quote && (
                <blockquote className="rounded-2xl border-l-4 border-blue-500 bg-slate-900/60 p-6">
                  <p className="m-0 text-slate-300 italic">&ldquo;{section.quote}&rdquo;</p>
                </blockquote>
              )}

              <ul className="space-y-3">
                {section.points.map((point) => (
                  <li
                    key={point}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-400"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </TerminalPage>
    </>
  );
}
