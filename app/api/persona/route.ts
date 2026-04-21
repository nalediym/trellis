import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getPersona } from "@/lib/manifests";
import { PERSONA_COOKIE } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  personaId: z.string().min(1),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid body",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  if (!getPersona(parsed.personaId)) {
    return NextResponse.json(
      { error: `unknown persona "${parsed.personaId}"` },
      { status: 404 },
    );
  }

  const jar = await cookies();
  jar.set(PERSONA_COOKIE, parsed.personaId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true, personaId: parsed.personaId });
}
