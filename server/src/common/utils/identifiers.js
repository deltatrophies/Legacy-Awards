import { randomInt } from "node:crypto";

export function createReference(prefix) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${date}-${randomInt(100000, 999999)}`;
}
