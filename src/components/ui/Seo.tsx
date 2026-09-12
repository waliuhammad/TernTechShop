import { useEffect } from 'react';
import { siteConfig } from '@/config/site';

interface SeoProps {
  title: string;
  description?: string;
  /** Absolute or root-relative image for social previews. */
  image?: string;
  /** Emitted as a <script type="application/ld+json"> block. */
  jsonLd?: Record<string, unknown>;
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Per-route document metadata.
 *
 * A client-rendered SPA cannot serve route-specific tags in the initial HTML,
 * so crawlers that do not execute JavaScript see only index.html. These tags
 * are still read by Google, and by anything rendering a link preview after
 * execution. Full pre-rendering would need a static-site generator — noted in
 * docs/DEPLOYMENT.md.
 */
export function Seo({ title, description, image, jsonLd }: SeoProps) {
  const fullTitle = title ? `${title} | ${siteConfig.shortName}` : siteConfig.name;
  const desc = description ?? siteConfig.description;

  useEffect(() => {
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', 'name', 'description', desc);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', window.location.href);
    if (image) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
    }

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + window.location.pathname;
  }, [fullTitle, desc, image]);

  useEffect(() => {
    if (!jsonLd) return undefined;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.route = 'true';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => script.remove();
  }, [jsonLd]);

  return null;
}
