export const formatPrice = (value) => Number(value) > 0
  ? `Rs. ${Number(value).toLocaleString("en-IN")}`
  : "Price on request";
