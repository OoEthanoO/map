import { NextResponse } from "next/server";
import { getDomainInventory } from "@/lib/domain-inventory";
import { createPulseService } from "@/lib/pulse";

export type { Pulse, PulseReport } from "@/lib/pulse";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pulse = createPulseService();

export async function GET() {
  const { hosts } = await getDomainInventory();
  return NextResponse.json(await pulse.getReport(hosts), {
    headers: { "Cache-Control": "no-store" },
  });
}
