import { BrandStrip } from '@/components/home/BrandStrip';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { EnterpriseExecution } from '@/components/home/EnterpriseExecution';
import { FeaturedComponents } from '@/components/home/FeaturedComponents';
import { Hero } from '@/components/home/Hero';
import { TierGrid } from '@/components/home/TierGrid';
import { Seo } from '@/components/ui/Seo';
import { siteConfig } from '@/config/site';

export default function Home() {
  return (
    <div className="bg-white">
      <Seo
        title=""
        description={siteConfig.description}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteConfig.name,
          url: window.location.origin,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${window.location.origin}/shop?search={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }}
      />

      <Hero />
      <CategoryGrid />
      <FeaturedComponents />
      <EnterpriseExecution />
      <TierGrid />
      <BrandStrip />
    </div>
  );
}
