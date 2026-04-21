/**
 * Policy engine. Given a (persona, skill) pair plus inputs, answer:
 *
 *   canInvoke({personaId, skillId, inputs}) -> {
 *     allowed: boolean,
 *     reason: string,
 *     remainingRateLimit: number | null,
 *   }
 *
 * The default is closed: if a role has no binding for a skill, the call
 * is denied with a human-readable reason. Rate limits are enforced in
 * an in-memory map keyed on `(personaId, skillId)`. The counter rolls
 * every 24h from first seen.
 */
import {
  getPersona,
  getPolicyBindings,
  getSkill,
} from "./manifests";
import type { PolicyBinding } from "./schemas";

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  remainingRateLimit: number | null;
}

interface RateLimitRecord {
  windowStart: number;
  count: number;
  perUserPerDay: number;
}

const RATE_LIMITS = new Map<string, RateLimitRecord>();
const DAY_MS = 24 * 60 * 60 * 1000;

function rateLimitKey(personaId: string, skillId: string): string {
  return `${personaId}::${skillId}`;
}

export function resetRateLimits(): void {
  RATE_LIMITS.clear();
}

function bindingFor(
  role: string,
  bindings: ReadonlyArray<PolicyBinding>,
): PolicyBinding | undefined {
  return bindings.find((b) => b.role === role);
}

function skillAllowedByBinding(
  binding: PolicyBinding,
  skillId: string,
): boolean {
  if (binding.skills === "*") return true;
  return binding.skills.includes(skillId);
}

/** The preview version that does not consume a rate-limit slot. */
export function previewInvoke({
  personaId,
  skillId,
}: {
  personaId: string;
  skillId: string;
}): PolicyDecision {
  const persona = getPersona(personaId);
  if (!persona) {
    return {
      allowed: false,
      reason: `unknown persona "${personaId}"`,
      remainingRateLimit: null,
    };
  }
  const skill = getSkill(skillId);
  if (!skill) {
    return {
      allowed: false,
      reason: `unknown skill "${skillId}"`,
      remainingRateLimit: null,
    };
  }

  const binding = bindingFor(persona.role, getPolicyBindings());
  if (!binding) {
    return {
      allowed: false,
      reason: `no policy binding for role "${persona.role}" — default is closed`,
      remainingRateLimit: null,
    };
  }
  if (!skillAllowedByBinding(binding, skillId)) {
    return {
      allowed: false,
      reason: `role "${persona.role}" is not bound to skill "${skillId}"`,
      remainingRateLimit: null,
    };
  }

  // Rate-limit preview (non-consuming).
  const limit = binding.rate_limit?.per_user_per_day;
  if (limit != null) {
    const key = rateLimitKey(personaId, skillId);
    const now = Date.now();
    const rec = RATE_LIMITS.get(key);
    if (rec && now - rec.windowStart < DAY_MS) {
      return {
        allowed: rec.count < limit,
        reason:
          rec.count < limit
            ? "allowed"
            : `daily rate limit (${limit}) exceeded for ${personaId}`,
        remainingRateLimit: Math.max(0, limit - rec.count),
      };
    }
    return { allowed: true, reason: "allowed", remainingRateLimit: limit };
  }

  return { allowed: true, reason: "allowed", remainingRateLimit: null };
}

/**
 * Authoritative check — consumes a rate-limit slot on success. Call once
 * per invocation, at the top of the route handler.
 */
export function canInvoke({
  personaId,
  skillId,
}: {
  personaId: string;
  skillId: string;
  inputs?: Record<string, unknown>;
}): PolicyDecision {
  const preview = previewInvoke({ personaId, skillId });
  if (!preview.allowed) return preview;

  // Consume a slot.
  const persona = getPersona(personaId)!;
  const binding = bindingFor(persona.role, getPolicyBindings())!;
  const limit = binding.rate_limit?.per_user_per_day;
  if (limit != null) {
    const key = rateLimitKey(personaId, skillId);
    const now = Date.now();
    const rec = RATE_LIMITS.get(key);
    if (!rec || now - rec.windowStart >= DAY_MS) {
      RATE_LIMITS.set(key, {
        windowStart: now,
        count: 1,
        perUserPerDay: limit,
      });
      return {
        allowed: true,
        reason: "allowed",
        remainingRateLimit: limit - 1,
      };
    }
    rec.count += 1;
    return {
      allowed: true,
      reason: "allowed",
      remainingRateLimit: Math.max(0, limit - rec.count),
    };
  }

  return preview;
}
