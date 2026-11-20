import type { Trade } from "@/types";

export const tradeLabels: Record<Trade, string> = {
  heating: "Heating",
  plumbing: "Plumbing",
  electrical: "Electrical",
  locksmith: "Locksmith",
  appliances: "Appliances",
  windows_doors: "Windows & doors",
  pest_control: "Pest control",
  roofing: "Roofing",
  general: "General repairs",
};

export const tradesByLabel = (Object.keys(tradeLabels) as Trade[]).sort((a, b) =>
  tradeLabels[a].localeCompare(tradeLabels[b]),
);
