export const BUSINESS_NAME = "Legacy Awards";
export const BUSINESS_WHATSAPP = "91XXXXXXXXXX";
export const BUSINESS_EMAIL = "orders@legacyawards.in";
export const BUSINESS_ADDRESS = "B-14, Okhla Phase II, New Delhi - 110020";

export function createWhatsAppUrl(message, number = BUSINESS_WHATSAPP) {
  if (!/^\d{10,15}$/.test(number)) return "/contact";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
