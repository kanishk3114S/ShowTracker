import { useEffect } from 'react';

/**
 * Per-page <head>: title, description, canonical URL, OpenGraph and Twitter tags.
 *
 *   useDocumentHead({ title, description, image, noindex })
 *
 * The values from index.html are the defaults: they are captured once and restored when the page
 * unmounts, so a page without its own call never inherits the previous page's title.
 * `image` may be a full URL or a site path; it is made absolute for social previews.
 * `noindex` asks search engines to skip private pages (dashboard, library, settings).
 *
 * Note: this runs in the browser. Search engines that execute JavaScript (Google, Bing) see it;
 * link-preview scrapers that do not (most chat apps) fall back to the static tags in index.html.
 */
const SITE = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
const DEFAULT_IMAGE = '/og-image.png';

const origin = () => SITE || (typeof window !== 'undefined' ? window.location.origin : '');
const absolute = (url) => (/^https?:\/\//i.test(url) ? url : `${origin()}${url.startsWith('/') ? '' : '/'}${url}`);

function metaEl(attr, key) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}

function linkCanonical() {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  return el;
}

let defaults = null;
function readDefaults() {
  if (defaults) return defaults;
  const get = (attr, key) => document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? '';
  defaults = {
    title: document.title,
    description: get('name', 'description'),
    ogTitle: get('property', 'og:title'),
    ogDescription: get('property', 'og:description'),
    ogImage: get('property', 'og:image'),
    ogUrl: get('property', 'og:url'),
    twTitle: get('name', 'twitter:title'),
    twDescription: get('name', 'twitter:description'),
    twImage: get('name', 'twitter:image')
  };
  return defaults;
}

export function useDocumentHead({ title, description, image, noindex = false, type = 'website' } = {}) {
  useEffect(() => {
    const base = readDefaults();
    const pageTitle = title || base.title;
    const pageDescription = description || base.description;
    const pageImage = image ? absolute(image) : absolute(DEFAULT_IMAGE);
    const pageUrl = `${origin()}${window.location.pathname}`;

    document.title = pageTitle;
    metaEl('name', 'description').setAttribute('content', pageDescription);
    metaEl('property', 'og:title').setAttribute('content', pageTitle);
    metaEl('property', 'og:description').setAttribute('content', pageDescription);
    metaEl('property', 'og:image').setAttribute('content', pageImage);
    metaEl('property', 'og:url').setAttribute('content', pageUrl);
    metaEl('property', 'og:type').setAttribute('content', type);
    metaEl('name', 'twitter:title').setAttribute('content', pageTitle);
    metaEl('name', 'twitter:description').setAttribute('content', pageDescription);
    metaEl('name', 'twitter:image').setAttribute('content', pageImage);
    linkCanonical().setAttribute('href', pageUrl);

    let robots = null;
    if (noindex) {
      robots = metaEl('name', 'robots');
      robots.setAttribute('content', 'noindex, nofollow');
    }

    return () => {
      const d = readDefaults();
      document.title = d.title;
      metaEl('name', 'description').setAttribute('content', d.description);
      metaEl('property', 'og:title').setAttribute('content', d.ogTitle);
      metaEl('property', 'og:description').setAttribute('content', d.ogDescription);
      metaEl('property', 'og:image').setAttribute('content', d.ogImage);
      metaEl('property', 'og:url').setAttribute('content', d.ogUrl);
      metaEl('property', 'og:type').setAttribute('content', 'website');
      metaEl('name', 'twitter:title').setAttribute('content', d.twTitle);
      metaEl('name', 'twitter:description').setAttribute('content', d.twDescription);
      metaEl('name', 'twitter:image').setAttribute('content', d.twImage);
      if (robots) robots.remove();
    };
  }, [title, description, image, noindex, type]);
}

export default useDocumentHead;
