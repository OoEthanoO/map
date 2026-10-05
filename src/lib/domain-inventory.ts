import { readFile } from "node:fs/promises";
import fallbackData from "@/data/domains.json";
import { createInventoryReader } from "@/lib/domain-inventory-core";

// This module is only imported by server components and route handlers.
// The DNS API credential belongs to the external sync task, never to Next.js.
export const getDomainInventory = createInventoryReader(fallbackData, async () => {
  const path = process.env.MAP_DOMAINS_FILE;
  if (!path) throw new Error("No runtime inventory configured");
  const text = await readFile(path, "utf8");
  if (text.length > 1_000_000) throw new Error("Inventory is too large");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
});
