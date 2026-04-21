import { NextResponse } from "next/server";
import {
  getConnectors,
  getDlpRules,
  getPersonas,
  getPolicyBindings,
  getSkills,
  listManifestTree,
} from "@/lib/manifests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    tree: listManifestTree(),
    skills: getSkills(),
    personas: getPersonas(),
    connectors: getConnectors(),
    dlpRules: getDlpRules(),
    policyBindings: getPolicyBindings(),
  });
}
