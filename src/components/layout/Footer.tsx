import { Cpu, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { footerNav, siteConfig } from '@/config/site';

function ColumnHeading({ title, accent = 'primary' }: { title: string; accent?: 'primary' | 'blue' }) {
  const color = accent === 'blue' ? 'text-blue-400 border-blue-400' : 'text-primary border-primary';
  return (
    <h4 className={`border-l-2 pl-4 text-xs font-bold tracking-widest uppercase ${color}`}>
      {title}
    </h4>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="overflow-hidden border-t border-white/5 bg-slate-900 pt-24 pb-12 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative mb-20 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-16">
          {/* Brand */}
          <div className="relative z-10 space-y-8">
            <Link to="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg transition-transform group-hover:scale-110">
                <Cpu size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter uppercase italic transition-colors group-hover:text-primary">
                {siteConfig.name}
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed font-medium text-slate-400">
              {siteConfig.description}
            </p>
          </div>

          {/* Registry Hub */}
          <div className="space-y-8">
            <ColumnHeading title={footerNav.registryHub.title} />
            <ul className="space-y-4 text-sm font-bold text-slate-400">
              {footerNav.registryHub.links.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="transition-colors hover:text-white">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Protocol */}
          <div className="space-y-8">
            <ColumnHeading title={footerNav.supportProtocol.title} />
            <ul className="space-y-4 text-sm font-bold text-slate-400">
              {footerNav.supportProtocol.links.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="transition-colors hover:text-white">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Terminal */}
          <div className="space-y-8">
            <ColumnHeading title="Contact Terminal" accent="blue" />
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <MapPin className="shrink-0 text-blue-400" size={18} />
                <div className="space-y-1">
                  <p className="text-sm leading-tight font-bold text-slate-200">Headquarters</p>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    {siteConfig.contact.address}
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <Phone className="shrink-0 text-blue-400" size={18} />
                <a
                  href={`tel:${siteConfig.contact.phone.replace(/\s/g, '')}`}
                  className="text-sm font-bold text-slate-200 transition-colors hover:text-white"
                >
                  {siteConfig.contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-4">
                <Mail className="shrink-0 text-blue-400" size={18} />
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="text-sm font-bold break-all text-slate-200 transition-colors hover:text-white"
                >
                  {siteConfig.contact.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-10 md:flex-row">
          <div className="text-center font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase md:text-left">
            © {year} {siteConfig.legalEntity} // {siteConfig.copyrightSuffix}
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[10px] font-bold tracking-widest text-slate-500 uppercase md:gap-8">
            {footerNav.legal.map((link) => (
              <Link key={link.name} to={link.href} className="transition-colors hover:text-white">
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
