/**
 * Persona selection — cookie-backed.
 *
 * The demo lets a visitor toggle between Teacher, Principal, Ops Analyst,
 * and Admin to feel the permission boundaries. The selection is stored in
 * a cookie so server components can read it synchronously on render.
 *
 * In production this would be SSO + role claims. Here it's a dropdown.
 */
import { cookies } from "next/headers";
import { getPersona, getPersonas } from "./manifests";
import type { Persona } from "./schemas";

export const PERSONA_COOKIE = "trellis.persona";
export const DEFAULT_PERSONA_ID = "teacher";

/** Read the persona from the request cookie; fall back to default. */
export async function getCurrentPersona(): Promise<Persona> {
  const jar = await cookies();
  const raw = jar.get(PERSONA_COOKIE)?.value;
  const fromCookie = raw ? getPersona(raw) : undefined;
  if (fromCookie) return fromCookie;

  const fallback = getPersona(DEFAULT_PERSONA_ID);
  if (fallback) return fallback;

  // Defensive: if the default is missing, return the first one.
  const all = getPersonas();
  if (all.length === 0) {
    throw new Error("no personas defined in platform/personas/");
  }
  return all[0];
}

/** Synchronous ID accessor for non-async contexts (rare). */
export async function getCurrentPersonaId(): Promise<string> {
  return (await getCurrentPersona()).id;
}

export function isAdminPersona(persona: Persona): boolean {
  return persona.role === "admin";
}
