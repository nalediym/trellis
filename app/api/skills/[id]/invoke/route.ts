import { NextResponse } from "next/server";
import { z } from "zod";

import { runSkillStream, validateSkillInputs } from "@/lib/skill-runtime";
import { getCurrentPersona } from "@/lib/personas";
import { getSkill } from "@/lib/manifests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  inputs: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const skill = getSkill(id);
  if (!skill) {
    return NextResponse.json(
      { error: `unknown skill "${id}"` },
      { status: 404 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = BodySchema.parse(rawBody);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid request shape",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  let normalized;
  try {
    normalized = validateSkillInputs(id, parsed.inputs as Record<string, unknown>);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid inputs",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const persona = await getCurrentPersona();

  const stream = runSkillStream({
    skillId: id,
    personaId: persona.id,
    inputs: normalized,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
