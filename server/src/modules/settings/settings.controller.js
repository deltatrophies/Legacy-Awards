import { sendData } from "../../common/utils/response.js";
import { Settings } from "./settings.model.js";

const defaultSettings = {
  key: "site",
  businessName: "Legacy Awards",
  email: "orders@legacyawards.in",
  phone: "",
  whatsapp: "91XXXXXXXXXX",
  address: "B-14, Okhla Phase II, New Delhi - 110020",
  timings: "Mon-Sat, 10:00 AM - 7:00 PM",
  mapUrl: "",
  instagramUrl: "",
  facebookUrl: "",
};

const serialize = (settings) => ({
  businessName: settings.businessName,
  email: settings.email,
  phone: settings.phone || "",
  whatsapp: settings.whatsapp || "",
  address: settings.address,
  timings: settings.timings || "",
  mapUrl: settings.mapUrl || "",
  instagramUrl: settings.instagramUrl || "",
  facebookUrl: settings.facebookUrl || "",
  updatedAt: settings.updatedAt,
});

async function getOrCreateSettings() {
  return Settings.findOneAndUpdate(
    { key: "site" },
    { $setOnInsert: defaultSettings },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function getSettings(_req, res) {
  return sendData(res, serialize(await getOrCreateSettings()));
}

export async function updateSettings(req, res) {
  const settings = await Settings.findOneAndUpdate(
    { key: "site" },
    { ...req.body, key: "site" },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return sendData(res, serialize(settings));
}
