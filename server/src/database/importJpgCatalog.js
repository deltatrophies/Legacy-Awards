import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { cloudinaryEnabled, env } from "../config/env.js";
import { Category } from "../modules/categories/category.model.js";
import { Product } from "../modules/products/product.model.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = process.argv[2] || process.env.CATALOG_SOURCE;
const manifestPath = path.resolve(__dirname, "../../../.catalog-import-manifest.json");
const cloudFolder = "legacy-trophies/catalog-2026";
const concurrency = 6;
const cloudinaryResolve = process.env.CLOUDINARY_API_RESOLVE;

const categories = [
  ["ACRYLIC MODEL", "acrylic-awards", "Acrylic Awards"],
  ["BASE AND ACS", "bases-and-accessories", "Bases & Accessories"],
  ["CA MODEL", "ca-models", "CA Models"],
  ["FC MODEL", "fc-models", "FC Models"],
  ["FRAMES", "frames", "Frames"],
  ["IC MODEL", "ic-models", "IC Models"],
  ["LA,ACA,RA,F, MODEL", "la-aca-ra-f-models", "LA, ACA, RA & F Models"],
  ["MC MODEL", "mc-models", "MC Models"],
  ["MP MODEL", "mp-models", "MP Models"],
  ["PC - MODEL", "pc-models", "PC Models"],
  ["PF MODEL", "pf-models", "PF Models"],
  ["WA-02", "wa-02-models", "WA-02 Models"],
  ["WOODEN MODEL", "wooden-awards", "Wooden Awards"],
].map(([folder, slug, name], index) => ({ folder, slug, name, sortOrder: (index + 1) * 10 }));

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const sha1 = (value) => crypto.createHash("sha1").update(value).digest("hex");
const relativeKey = (file) => path.relative(sourceRoot, file).replaceAll("\\", "/");

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { return {}; }
}

function saveManifest(manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function curlFields(item, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = `folder=${cloudFolder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = sha1(`${signed}${env.CLOUDINARY_API_SECRET}`);
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`;
  const networkArgs = cloudinaryResolve ? ["--resolve", cloudinaryResolve] : [];
  return [
    "-sS", ...networkArgs, "--connect-timeout", "20", "--max-time", "180", "--retry", "8", "--retry-all-errors", "--retry-delay", "2", "-X", "POST", endpoint,
    "-F", `file=@"${item.file}"`,
    "-F", `api_key=${env.CLOUDINARY_API_KEY}`,
    "-F", `timestamp=${timestamp}`,
    "-F", `folder=${cloudFolder}`,
    "-F", `public_id=${publicId}`,
    "-F", "overwrite=true",
    "-F", `signature=${signature}`,
  ];
}

async function upload(item) {
  const publicId = `${item.category.slug}/${slugify(item.code)}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const { stdout } = await execFileAsync("curl.exe", curlFields(item, publicId), { maxBuffer: 10_000_000 });
      const result = JSON.parse(stdout);
      if (!result.secure_url) throw new Error(result.error?.message || "Cloudinary returned no URL");
      return { url: result.secure_url, publicId: result.public_id, bytes: result.bytes, width: result.width, height: result.height };
    } catch (error) {
      if (attempt === 4) throw new Error(`Upload failed for ${relativeKey(item.file)}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
}

async function mapConcurrent(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  let completed = 0;
  let fatalError;
  async function run() {
    while (cursor < items.length && !fatalError) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index]);
        completed += 1;
        process.stdout.write(`\rPrepared ${completed}/${items.length}`);
      } catch (error) {
        fatalError ||= error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  if (fatalError) throw fatalError;
  process.stdout.write("\n");
  return results;
}

function discover() {
  return categories.flatMap((category) => {
    const directory = path.join(sourceRoot, category.folder);
    if (!fs.existsSync(directory)) throw new Error(`Missing category folder: ${directory}`);
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.jpe?g$/i.test(entry.name))
      .map((entry) => ({
        category,
        file: path.join(directory, entry.name),
        code: path.basename(entry.name, path.extname(entry.name)).trim(),
      }))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  });
}

async function main() {
  if (!cloudinaryEnabled) throw new Error("Cloudinary credentials are not configured");
  if (!sourceRoot) throw new Error("Pass the catalog source path as an argument or set CATALOG_SOURCE");
  if (!fs.existsSync(sourceRoot)) throw new Error(`Catalog source not found: ${sourceRoot}`);
  const manifest = loadManifest();
  const items = discover();
  console.log(`Preparing ${items.length} catalog images from ${categories.length} categories...`);

  const prepared = await mapConcurrent(items, async (item) => {
    const key = relativeKey(item.file);
    const stat = fs.statSync(item.file);
    const fingerprint = `${stat.size}:${Math.floor(stat.mtimeMs)}`;
    if (manifest[key]?.fingerprint === fingerprint && manifest[key]?.url) return { ...item, image: manifest[key] };
    const result = await upload(item);
    manifest[key] = { ...result, fingerprint };
    saveManifest(manifest);
    return { ...item, image: manifest[key] };
  });

  await connectDatabase();
  const currentSkus = prepared.map((item) => `LA-${sha1(relativeKey(item.file)).slice(0, 12).toUpperCase()}`);
  const categorySlugs = categories.map((category) => category.slug);

  await Category.bulkWrite(categories.map((category) => ({ updateOne: {
    filter: { slug: category.slug },
    update: { $set: {
      name: category.name,
      description: `${category.name} available with custom branding and personalization options.`,
      imageUrl: prepared.find((item) => item.category.slug === category.slug)?.image.url || "",
      sortOrder: category.sortOrder,
      isActive: true,
    } },
    upsert: true,
  } })));

  await Product.bulkWrite(prepared.map((item) => {
    const sku = `LA-${sha1(relativeKey(item.file)).slice(0, 12).toUpperCase()}`;
    const displayName = item.code.slice(0, 150);
    return { updateOne: {
      filter: { sku },
      update: { $set: {
        slug: `${item.category.slug}-${slugify(item.code)}`.slice(0, 180),
        sku,
        name: displayName,
        category: item.category.slug,
        price: 0,
        tag: `${item.category.name} / Customizable`,
        description: `${displayName} is available for customized awards and recognition requirements. Contact Legacy Awards for size, finish, quantity, and pricing options.`,
        badge: "Price on request",
        images: [{ url: item.image.url, publicId: item.image.publicId, alt: `${displayName} – ${item.category.name}` }],
        material: "Multiple options available",
        size: "Multiple sizes available",
        delivery: "Contact for timeline",
        useCase: "Awards and recognition",
        minOrder: 1,
        isActive: true,
        inventory: { track: false, available: 0 },
      } },
      upsert: true,
    } };
  }));

  await Promise.all([
    Product.updateMany({ sku: { $nin: currentSkus } }, { $set: { isActive: false } }),
    Category.updateMany({ slug: { $nin: categorySlugs } }, { $set: { isActive: false } }),
  ]);

  const [activeProducts, activeCategories] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Category.countDocuments({ isActive: true }),
  ]);
  console.log(`Catalog switched successfully: ${activeProducts} products, ${activeCategories} categories.`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => disconnectDatabase());
