import { useEffect } from 'react';
import { serializeJsonLd } from '../../lib/seo';

/** Injects one <script type="application/ld+json"> into <head> while mounted. Renders nothing. */
export default function JsonLd({ data }) {
  useEffect(() => {
    if (!data) return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-showtracker-jsonld', '');
    el.textContent = serializeJsonLd(data);
    document.head.appendChild(el);
    return () => el.remove();
  }, [data]);
  return null;
}
