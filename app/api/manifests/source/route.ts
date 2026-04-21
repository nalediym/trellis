import { NextResponse } from "next/server";
import { readManifestSource } from "@/lib/manifests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  if (!file) {
    return NextResponse.json(
      { error: "missing `file` query param" },
      { status: 400 },
    );
  }
  try {
    const source = readManifestSource(file);
    return new Response(source, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 },
    );
  }
}
