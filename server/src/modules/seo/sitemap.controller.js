import { Category } from "../categories/category.model.js";
import { Product } from "../products/product.model.js";

const SITE_URL = "https://www.awardarts.in";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry(path, lastmod, changefreq = "weekly", priority = "0.7", images = []) {
  return [
    "  <url>",
    `    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>`,
    ...(lastmod ? [`    <lastmod>${new Date(lastmod).toISOString()}</lastmod>`] : []),
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    ...images.filter((image) => image?.url).flatMap((image) => [
      "    <image:image>",
      `      <image:loc>${escapeXml(image.url)}</image:loc>`,
      ...(image.title ? [`      <image:title>${escapeXml(image.title)}</image:title>`] : []),
      "    </image:image>",
    ]),
    "  </url>",
  ].join("\n");
}

export async function sitemap(_req, res) {
  const [products, categories] = await Promise.all([
    Product.find({ isActive: true }).select("slug name images.url images.alt updatedAt").sort({ updatedAt: -1 }).lean(),
    Category.find({ isActive: true }).select("slug name imageUrl updatedAt").sort({ sortOrder: 1, name: 1 }).lean(),
  ]);
  const staticEntries = [
    urlEntry("/", null, "weekly", "1.0"),
    urlEntry("/products", null, "daily", "0.9"),
    urlEntry("/custom", null, "monthly", "0.8"),
    urlEntry("/about", null, "monthly", "0.6"),
    urlEntry("/blogs", null, "monthly", "0.6"),
    urlEntry("/contact", null, "monthly", "0.7"),
    urlEntry("/shipping", null, "yearly", "0.3"),
    urlEntry("/returns", null, "yearly", "0.3"),
    urlEntry("/privacy", null, "yearly", "0.2"),
  ];
  const categoryEntries = categories.map((category) => urlEntry(`/products/category/${encodeURIComponent(category.slug)}`, category.updatedAt, "weekly", "0.8", category.imageUrl ? [{ url: category.imageUrl, title: category.name }] : []));
  const productEntries = products.map((product) => urlEntry(`/products/${encodeURIComponent(product.slug)}`, product.updatedAt, "weekly", "0.8", (product.images || []).slice(0, 4).map((image) => ({ url: image.url, title: image.alt || product.name }))));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[...staticEntries, ...categoryEntries, ...productEntries].join("\n")}\n</urlset>`;
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(xml);
}
