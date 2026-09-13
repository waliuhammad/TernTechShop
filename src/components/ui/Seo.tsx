import { useEffect } from 'react';
import { siteConfig } from '@/config/site';

interface SeoProps {
  title: string;
  description?: string;
  /** Absolute or root-relative image for social previews. */
  image?: string;
  /** Emitted as a <script type="application/ld+json"> block. */
  jsonLd?: Record<string, unknown>;
  /** Private or empty pages (cart, account, not found) ask search engines not to index them. */
  noindex?: boolean;
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
 * Public pages also get these tags in their initial HTML from
 * scripts/prerender.ts at build time; this keeps them correct as the visitor
 * navigates inside the app. Keep titles and descriptions in step with that
 * script.
 */
export function Seo({ title, description, image, jsonLd, noindex = false }: SeoProps) {
  const fullTitle = title ? `${title} | ${siteConfig.shortName}` : `${siteConfig.name} — ${siteConfig.tagline}`;
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
    if (!noindex) return undefined;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, [noindex]);

  useEffect(() => {
    // Pre-rendered pages already carry structured data for their own URL; adding
    // the client copy would duplicate it. Once the visitor navigates elsewhere,
    // that build-time markup no longer applies.
    const prerendered = document.head.querySelectorAll<HTMLScriptElement>('script[data-prerender-ld]');
    if ([...prerendered].some((script) => script.dataset.path === window.location.pathname)) return undefined;
    prerendered.forEach((script) => script.remove());

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
