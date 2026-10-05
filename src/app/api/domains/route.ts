import { NextResponse } from "next/server";
import { getDomainInventory } from "@/lib/domain-inventory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { domain, updatedAt, hosts, source, stale } = await getDomainInventory();
  return NextResponse.json(
    { domain, updatedAt, hosts, source, stale },
    { headers: { "Cache-Control": "no-store" } },
  );
}
