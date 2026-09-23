import { describe, expect, it } from "vitest";
import { cloudinaryPublicId } from "../src/modules/uploads/upload.service.js";

describe("cloudinaryPublicId", () => {
  it("uses a stored pre-rename public id", () => {
    expect(cloudinaryPublicId({ publicId: "legacy-trophies/product-images/award_123" }))
      .toBe("legacy-trophies/product-images/award_123");
  });

  it("derives a public id from a pre-rename Cloudinary URL", () => {
    expect(cloudinaryPublicId({
      url: "https://res.cloudinary.com/demo/image/upload/v1234567890/legacy-trophies/product-images/award_123.png",
    })).toBe("legacy-trophies/product-images/award_123");
  });

  it("does not target unrelated Cloudinary assets", () => {
    expect(cloudinaryPublicId({
      url: "https://res.cloudinary.com/demo/image/upload/v1234567890/another-folder/award.png",
    })).toBe("");
  });
});
