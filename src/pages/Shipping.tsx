import { Seo } from '@/components/ui/Seo';
import { TerminalPage } from '@/components/ui/TerminalPage';
import { useSettings } from '@/context/SettingsContext';
import { shippingAssurances } from '@/data/site-data';
import { resolveIcon } from '@/lib/icons';
import { formatPrice } from '@/lib/money';

export default function Shipping() {
  // Fee, threshold and zones are edited in Admin -> Settings.
  const { logistics } = useSettings();

  return (
    <>
      <Seo
        title="Logistics & Deployment"
        description="Nationwide distribution networks engineered for speed and hardware integrity, delivering all over Pakistan."
      />

      <TerminalPage
        badge="LOGISTICS_MANIFEST_V4"
        badgeTone="emerald"
        title="Logistics & Deployment"
        intro="Nationwide distribution networks engineered for speed and hardware integrity, delivering all over Pakistan."
      >
        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {shippingAssurances.map((item) => {
            const Icon = resolveIcon(item.iconKey);
            return (
              <div
                key={item.title}
                className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <Icon size={26} className="text-emerald-400" />
                <h3 className="font-bold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{item.description}</p>
              </div>
            );
          })}
        </div>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold md:text-3xl">Shipping Zones</h2>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[540px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-900/80">
                  {['Sector', 'Delivery Window', 'Carrier Protocol'].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-6 py-4 font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logistics.zones.map((zone) => (
                  <tr key={zone.sector} className="transition-colors hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-white">{zone.sector}</td>
                    <td className="px-6 py-4 text-slate-300">{zone.deliveryWindow}</td>
                    <td className="px-6 py-4 text-slate-300">{zone.carrier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <h3 className="font-bold text-blue-400">Free Deployment</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Manifests valued at {formatPrice(logistics.freeShippingThreshold)} or above ship with zero
              logistics charges, nationwide.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="font-bold">Standard Logistics Fee</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              A flat {formatPrice(logistics.standardShippingFee)} applies below the free-deployment
              threshold, regardless of sector.
            </p>
          </div>
        </section>
      </TerminalPage>
    </>
  );
}
