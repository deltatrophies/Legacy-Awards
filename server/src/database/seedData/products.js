const images = [
  "/images/shopping.jpg",
  "/images/trophy-psq4jil-250.avif",
  "/images/download.jpg",
  "/images/images.jpg",
  "/images/plaques.jpg",
  "/images/medals.jpg",
  "/images/crystal.jpg",
];

const catalog = [
  ["Gold Prestige Trophy", "trophies", 1800, "Corporate / Gold-Plated", "Solid brass body with a gold-plated finish and custom engraving panel.", "Best Seller", 0, "Solid Brass", "30 cm", "5-7 days", "Corporate awards"],
  ["Marble Grand Trophy", "trophies", 2800, "Premium / Marble Base", "Italian marble base with polished metal figurine and laser engraving.", "New", 1, "Marble + Metal", "38 cm", "7 days", "Premium ceremonies"],
  ["Champion's Gold Cup", "trophies", 950, "Sports / Classic", "Classic twin-handle cup with a stable three-tiered base.", "Fast Delivery", 2, "Zinc Alloy", "26 cm", "3-5 days", "Sports tournaments"],
  ["Scholar's Trophy", "trophies", 480, "Academic / Value Range", "Elegant academic trophy made for annual days and school competitions.", "Bulk Deal", 3, "ABS Resin", "22 cm", "3 days", "School events"],
  ["Victory Pedestal Trophy", "trophies", 1200, "Sports / Premium", "Multi-tiered pedestal trophy with a customizable figurine top.", "Premium", 2, "Metal + Resin", "34 cm", "5 days", "Championships"],
  ["Executive Column Trophy", "trophies", 2200, "Corporate / Premium", "Tall brass-finish column trophy on a premium wooden base.", "New", 3, "Brass + Walnut", "42 cm", "7 days", "Executive recognition"],
  ["Gold Prestige Plaque", "plaques", 1200, "Corporate / Gold", "Brushed gold face plate on walnut wood with decorative corners.", "Best Seller", 4, "Brass + Walnut", "30 x 22 cm", "5 days", "Corporate recognition"],
  ["Marble Heritage Plaque", "plaques", 2200, "Premium / Marble", "Black marble plaque with gold lettering and brass corner details.", "Premium", 4, "Italian Marble", "35 x 25 cm", "7 days", "Institutional awards"],
  ["Shield of Honour", "plaques", 680, "Academic / Recognition", "Classic shield design with metal or acrylic customization.", "New", 4, "Metal / Acrylic", "28 x 20 cm", "3-5 days", "Schools and clubs"],
  ["Executive Crest Plaque", "plaques", 1600, "Government / Formal", "Rosewood plaque with a silver-tone crest and UV-printed logo.", "Premium", 4, "Rosewood + Metal", "32 x 24 cm", "6 days", "Formal recognition"],
  ["Slim Line Plaque", "plaques", 890, "Corporate / Modern", "Slim anodised aluminium plaque with laser-cut border detail.", "Fast Delivery", 4, "Aluminium", "30 x 10 cm", "3 days", "Modern offices"],
  ["Gold Victory Medal", "medals", 180, "Sports / Gold Finish", "Die-cast gold enamel medal supplied with a satin ribbon.", "Best Seller", 5, "Zinc Alloy", "6.5 cm", "3 days", "Sports events"],
  ["Silver Achievement Medal", "medals", 160, "Sports / Silver Finish", "Silver-finish medal with an embossed laurel wreath design.", "Bulk Deal", 5, "Zinc Alloy", "6.5 cm", "3 days", "Runner-up awards"],
  ["Custom Logo Medal", "medals", 120, "Corporate / Participation", "Full-colour logo medal with custom ribbon and reverse text.", "Bulk Deal", 5, "Zinc Alloy", "6 cm", "5 days", "Participation events"],
  ["Scholar Excellence Medal", "medals", 220, "Academic / Excellence", "Premium brass academic medal with custom text and presentation box.", "New", 5, "Brass", "7 cm", "5 days", "Academic excellence"],
  ["Bronze Honour Medal", "medals", 140, "Sports / Bronze", "Classic bronze competition medal with a high-relief design.", "Fast Delivery", 5, "Zinc Alloy", "6.5 cm", "3 days", "Sports competitions"],
  ["Diamond Crystal Award", "crystal", 3400, "Corporate / Optical Crystal", "Hand-polished optical crystal with 3D internal laser engraving.", "Premium", 6, "Optical Crystal", "20 cm", "7 days", "Corporate milestones"],
  ["Pyramid Crystal Plaque", "crystal", 2800, "Director / Prestige", "Pyramid-cut crystal on a gold base for boardroom recognition.", "Premium", 6, "Optical Crystal", "18 cm", "7 days", "Leadership awards"],
  ["Arch Crystal Award", "crystal", 2200, "Tech / Innovation", "Modern arch-shaped crystal award with a polished metal base.", "New", 6, "Optical Crystal", "22 cm", "6 days", "Innovation events"],
  ["Globe Crystal Trophy", "crystal", 4200, "Lifetime / Achievement", "Crystal globe on rosewood for memorable lifetime achievement awards.", "Premium", 6, "Optical Crystal", "25 cm", "10 days", "Lifetime achievement"],
  ["Crystal Cube Award", "crystal", 1900, "Corporate / Cube", "Minimal optical crystal cube with internal laser engraving.", "New", 6, "Optical Crystal", "10 x 10 cm", "5 days", "Executive gifting"],
];

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const seedProducts = catalog.map(([name, category, price, tag, description, badge, image, material, size, delivery, useCase]) => ({
  id: slugify(name),
  name,
  category,
  price,
  tag,
  description,
  badge,
  image: images[image],
  material,
  size,
  delivery,
  useCase,
  minOrder: category === "medals" ? 10 : 1,
}));
