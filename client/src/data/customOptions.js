export const customOptions = {
  tips: [
    { id: "classic", name: "Classic Cup", image: "/images/tip.jpg", price: 300 },
    { id: "star", name: "Star Tip", image: "/images/tip2.png", price: 360 },
    { id: "flame", name: "Crystal Flame", image: "/images/crystal 2.jpg", price: 520 },
  ],
  bodies: [
    { id: "slim", name: "Slim Gold", image: "/images/body.jpg", price: 450 },
    { id: "marble", name: "Marble Pillar", image: "/images/body2.png", price: 620 },
    { id: "crystal", name: "Crystal Tower", image: "/images/crystal.jpg", price: 780 },
  ],
  bases: [
    { id: "wood", name: "Wood Base", image: "/images/base.jpg", price: 300 },
    { id: "marble", name: "Marble Base", image: "/images/base2.png", price: 380 },
    { id: "metal", name: "Metal Base", image: "/images/Metal-Trophies-3.jpg", price: 420 },
  ],
  sizes: [{ id: "small", name: "8 inch", multiplier: 1 }, { id: "medium", name: "10 inch", multiplier: 1.25 }, { id: "large", name: "12 inch", multiplier: 1.5 }, { id: "xl", name: "15 inch", multiplier: 1.85 }],
  finishes: [{ id: "gold", name: "Classic Gold", color: "#c9a84c", price: 0 }, { id: "rose", name: "Rose Gold", color: "#c9866a", price: 120 }, { id: "silver", name: "Silver Chrome", color: "#c9ced6", price: 90 }, { id: "black", name: "Matte Black", color: "#28251f", price: 150 }],
};

export const designPresets = [
  { name: "School Annual Day", tip: "star", body: "slim", base: "wood", finish: "gold", text: "ANNUAL DAY\nEXCELLENCE AWARD", font: "classic" },
  { name: "Corporate Excellence", tip: "flame", body: "crystal", base: "metal", finish: "silver", text: "EXCELLENCE\n2026", font: "modern" },
  { name: "Sports Winner", tip: "classic", body: "marble", base: "marble", finish: "gold", text: "CHAMPION\nFIRST PLACE", font: "bold" },
  { name: "Retirement Appreciation", tip: "flame", body: "crystal", base: "wood", finish: "rose", text: "WITH GRATITUDE\nFOR YEARS OF SERVICE", font: "script" },
  { name: "Employee of the Month", tip: "star", body: "slim", base: "metal", finish: "black", text: "EMPLOYEE\nOF THE MONTH", font: "modern" },
];

export const blankDesign = { tip: "classic", body: "slim", base: "wood", size: "small", finish: "gold", branding: "laser", packaging: "standard", text: "BEST PERFORMER\nYOUR NAME", font: "classic", align: "center", textSize: 16, textColor: "#5c1a1a", textPosition: "base", logoSize: 70, logoX: 50, logoY: 38, quantity: 10, logo: "" };
