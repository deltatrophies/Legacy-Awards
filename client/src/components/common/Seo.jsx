import { useEffect } from "react";

export const SITE_URL = "https://www.awardarts.in";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-default.jpg`;
const EMPTY_SCHEMAS = [];

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    element.dataset.seoManaged = "true";
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    element.dataset.seoManaged = "true";
    document.head.appendChild(element);
  }
  element.href = href;
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export default function Seo({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  type = "website",
  robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
  schemas = EMPTY_SCHEMAS,
}) {
  const schemaPayloads = schemas.filter(Boolean).map((schema) => JSON.stringify(schema).replaceAll("<", "\\u003c"));
  const schemaKey = schemaPayloads.join("|");
  useEffect(() => {
    const canonical = absoluteUrl(path);
    const socialImage = absoluteUrl(image);
    document.title = title;
    upsertLink("canonical", canonical);
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: robots });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Award Arts" });
    upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_IN" });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: socialImage });
    upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: `${title} — Award Arts` });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: socialImage });

    document.head.querySelectorAll('script[data-seo-schema="true"]').forEach((node) => node.remove());
    schemaPayloads.forEach((payload) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoSchema = "true";
      script.textContent = payload;
      document.head.appendChild(script);
    });
  }, [description, image, path, robots, schemaKey, title, type]);

  return null;
}

export function NoIndexSeo({ title = "Award Arts" }) {
  return <Seo title={title} description="Secure Award Arts account page." robots="noindex,nofollow,noarchive" />;
}
