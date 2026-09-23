import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://www.awardarts.in";
const API_URL = (process.env.VITE_API_URL || "https://award-arts-api.onrender.com").replace(/\/$/, "");
const DIST = new URL("../dist/", import.meta.url);
const template = await readFile(new URL("index.html", DIST), "utf8");

const staticPages = [
  ["about", "About Award Arts - Custom Trophy & Recognition Specialists", "Meet Award Arts, a New Delhi awards specialist creating trophies, medals, plaques and personalized recognition products for organizations across India."],
  ["products", "Trophies, Medals, Plaques & Custom Awards - Award Arts", "Browse premium trophies, medals, plaques, crystal awards and customizable recognition products. Request bulk pricing and engraving from Award Arts."],
  ["custom", "Design a Custom Trophy Online - Award Arts", "Create a custom trophy with your preferred style, finish, size, engraving and logo. Save a design and request production pricing from Award Arts."],
  ["blogs", "Award Buying Guides & Trophy Ideas - Award Arts", "Practical guides on choosing trophies, engraving, award materials, event planning and bulk recognition orders from Award Arts."],
  ["contact", "Contact Award Arts - Trophy & Bulk Award Enquiries", "Contact Award Arts for custom trophies, medals, plaques, engraving, bulk pricing and delivery support across India."],
  ["shipping", "Shipping Policy - Award Arts", "Learn about Award Arts production timelines, dispatch, delivery and shipping for trophies and custom awards across India."],
  ["returns", "Returns Policy - Award Arts", "Review the Award Arts return, replacement and issue-resolution policy for customized and standard award products."],
  ["privacy", "Privacy Policy - Award Arts", "Read how Award Arts collects, uses, protects and manages personal information submitted through our website."],
];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pageHtml({ path, title, description, image = `${SITE_URL}/images/og-default.jpg`, type = "website", schema }) {
  const url = `${SITE_URL}/${path}`.replace(/\/$/, path ? "" : "/");
  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${escapeHtml(url)}" />`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:type" content="[^"]*"\s*\/>/, `<meta property="og:type" content="${type}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${escapeHtml(url)}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${escapeHtml(image)}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*"\s*\/>/, `<meta property="og:image:alt" content="${escapeHtml(`${title} — Award Arts`)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  if (schema) html = html.replace("</head>", `    <script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>\n  </head>`);
  return html;
}

async function writePage(path, metadata) {
  const file = new URL(`${path}.html`, DIST);
  await mkdir(dirname(fileURLToPath(file)), { recursive: true });
  await writeFile(file, pageHtml({ path, ...metadata }), "utf8");
}

await Promise.all(staticPages.map(([path, title, description]) => writePage(path, { title, description })));

try {
  const signal = AbortSignal.timeout(90_000);
  const [productsResponse, categoriesResponse] = await Promise.all([
    fetch(`${API_URL}/api/v1/products?limit=1000`, { signal }),
    fetch(`${API_URL}/api/v1/categories`, { signal }),
  ]);
  if (!productsResponse.ok || !categoriesResponse.ok) throw new Error(`catalog response ${productsResponse.status}/${categoriesResponse.status}`);
  const [{ data: products = [] }, { data: categories = [] }] = await Promise.all([productsResponse.json(), categoriesResponse.json()]);
  await Promise.all(categories.map((category) => writePage(`products/category/${category.slug}`, {
    title: `${category.name} - Custom Awards | Award Arts`,
    description: category.description || `Browse customizable ${category.name.toLowerCase()} from Award Arts for corporate, school, sports and recognition events.`,
    image: category.imageUrl || undefined,
  })));
  await Promise.all(products.map((product) => {
    const path = `products/${product.id}`;
    const image = product.image || `${SITE_URL}/images/og-default.jpg`;
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description,
      sku: product.sku,
      image: (product.images || []).map((item) => item.url).filter(Boolean),
      category: product.category,
      brand: { "@type": "Brand", name: "Award Arts" },
      url: `${SITE_URL}/${path}`,
      ...(Number(product.price) > 0 ? { offers: { "@type": "Offer", priceCurrency: "INR", price: Number(product.price).toFixed(2), availability: "https://schema.org/InStock", url: `${SITE_URL}/${path}` } } : {}),
    };
    return writePage(path, { title: `${product.name} | Award Arts`, description: product.description.slice(0, 300), image, type: "product", schema });
  }));
  console.log(`SEO pages generated: ${staticPages.length} static, ${categories.length} categories, ${products.length} products.`);
} catch (error) {
  console.warn(`Dynamic SEO page generation skipped: ${error.message}`);
}
