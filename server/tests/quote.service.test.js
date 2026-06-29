import { describe, expect, it } from "vitest";
import { calculateCustomItem } from "../src/modules/quotes/quote.service.js";

describe("custom quote pricing", () => {
  const design = {
    tip: "classic",
    body: "slim",
    base: "wood",
    size: "small",
    finish: "gold",
    branding: "laser",
    packaging: "standard",
    delivery: "standard",
    text: "WINNER",
  };

  it("calculates the authoritative unit price", () => {
    const item = calculateCustomItem(design, 10);
    expect(item.unitPrice).toBe(1170);
    expect(item.lineTotal).toBe(11700);
  });

  it("applies the quantity discount on the server", () => {
    const item = calculateCustomItem(design, 100);
    expect(item.design.bulkDiscountRate).toBe(10);
    expect(item.lineTotal).toBe(105300);
  });
});
