import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Readiness probe for deploy/windows: a release only takes traffic once this reports its own commit. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "map",
    commit: process.env.MAP_COMMIT_SHA ?? null,
  });
}
