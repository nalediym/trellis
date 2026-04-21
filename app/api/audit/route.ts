import { NextResponse } from "next/server";
import { getRecentInvocations } from "@/lib/audit";
import { getCurrentPersona, isAdminPersona } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const persona = await getCurrentPersona();
  if (!isAdminPersona(persona)) {
    return NextResponse.json(
      { error: "forbidden: admin only", personaId: persona.id },
      { status: 403 },
    );
  }
  return NextResponse.json({
    entries: getRecentInvocations(),
  });
}
