/**
 * Zod schemas for every IaC manifest type under `platform/`.
 *
 * These are the runtime validators for the platform's control plane.
 * Every file loaded by `lib/manifests.ts` is parsed as YAML and fed
 * through one of the schemas below. A validation failure crashes the
 * server at startup with a clear message — the repo is the source of
 * truth for what the deployment can do, and we refuse to boot if it's
 * in an invalid state.
 *
 * The shape intentionally mirrors the JSON Schema in
 * `platform/schema/skill.schema.yaml` — keep them in sync when editing.
 */
import { z } from "zod";

// --- primitives -----------------------------------------------------------

const kebabIdSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, "must be lowercase kebab-case");

const nonEmptyString = z.string().min(1);

// --- skill ----------------------------------------------------------------

export const SkillInputSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString,
  type: z.enum(["string", "number", "enum", "boolean", "email", "date"]),
  required: z.boolean().optional().default(true),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  example: z.unknown().optional(),
});

export const SkillOutputSchema = z.object({
  id: nonEmptyString,
  kind: z.enum(["text", "json", "markdown", "citations", "classifier-label"]),
});

export const SkillSchema = z.object({
  id: kebabIdSchema,
  name: nonEmptyString,
  owner: nonEmptyString,
  reviewers: z.array(z.string()).optional().default([]),
  version: nonEmptyString,
  kind: z.enum(["streaming-agent", "one-shot", "classifier", "tool"]),
  description: nonEmptyString,
  tags: z.array(z.string()).optional().default([]),
  inputs: z.array(SkillInputSchema).optional().default([]),
  outputs: z.array(SkillOutputSchema).optional().default([]),
  connectors: z.array(z.string()).optional().default([]),
  models: z
    .object({
      draft: z.string().optional(),
      classifier: z.string().optional(),
    })
    .optional()
    .default({}),
  dlp_rules: z.array(z.string()).optional().default([]),
  disallowed_phrasings: z.array(z.string()).optional().default([]),
  prompt_blueprint: z.string().optional(),
  blueprint_inputs_ref: z.string().optional(),
});

export type Skill = z.infer<typeof SkillSchema>;
export type SkillInput = z.infer<typeof SkillInputSchema>;
export type SkillOutput = z.infer<typeof SkillOutputSchema>;

// --- persona --------------------------------------------------------------

export const PersonaSchema = z.object({
  id: kebabIdSchema,
  name: nonEmptyString,
  description: nonEmptyString,
  role: nonEmptyString,
  attributes: z
    .object({
      school_id: z.string().optional(),
      grade_levels: z.array(z.string()).optional(),
      data_classifications_allowed: z.array(z.string()).optional().default([]),
      data_classifications_forbidden: z
        .array(z.string())
        .optional()
        .default([]),
      special_capabilities: z.array(z.string()).optional().default([]),
    })
    .default({}),
});

export type Persona = z.infer<typeof PersonaSchema>;

// --- policy bindings ------------------------------------------------------

export const PolicyBindingSchema = z.object({
  role: nonEmptyString,
  // "*" means all skills; otherwise an array of skill IDs.
  skills: z.union([z.literal("*"), z.array(kebabIdSchema)]),
  rate_limit: z
    .object({
      per_user_per_day: z.number().int().positive(),
    })
    .optional(),
  reason: z.string().optional(),
});

export const PolicyBindingsFileSchema = z.object({
  bindings: z.array(PolicyBindingSchema).min(1),
});

export type PolicyBinding = z.infer<typeof PolicyBindingSchema>;
export type PolicyBindingsFile = z.infer<typeof PolicyBindingsFileSchema>;

// --- DLP rules ------------------------------------------------------------
//
// We support three shapes:
//   - classifications (regex "block" + "warn") — pii-core
//   - classifier (stubbed LLM) — fern-minors
//   - similarity (shingled compare of output field vs input field) — ticket-paraphrase

export const DlpRegexRuleSchema = z.object({
  id: nonEmptyString,
  pattern: nonEmptyString,
  label: nonEmptyString,
});

export const DlpClassificationRuleSchema = z.object({
  id: kebabIdSchema,
  name: nonEmptyString,
  owner: nonEmptyString,
  reviewers: z.array(z.string()).optional().default([]),
  version: nonEmptyString,
  description: nonEmptyString,
  classifications: z.object({
    block: z.array(DlpRegexRuleSchema).optional().default([]),
    warn: z.array(DlpRegexRuleSchema).optional().default([]),
  }),
  redact_with: z.string().optional().default("[{label}]"),
});

export const DlpClassifierTargetSchema = z.object({
  id: nonEmptyString,
  description: nonEmptyString,
  on_finding: z.enum(["redact", "warn", "block"]),
});

export const DlpClassifierRuleSchema = z.object({
  id: kebabIdSchema,
  name: nonEmptyString,
  owner: nonEmptyString,
  reviewers: z.array(z.string()).optional().default([]),
  version: nonEmptyString,
  description: nonEmptyString,
  classifier_model: nonEmptyString,
  targets: z.array(DlpClassifierTargetSchema).min(1),
  confidence_threshold: z.number().min(0).max(1),
});

export const DlpSimilarityRuleSchema = z.object({
  id: kebabIdSchema,
  name: nonEmptyString,
  owner: nonEmptyString,
  reviewers: z.array(z.string()).optional().default([]),
  version: nonEmptyString,
  description: nonEmptyString,
  mode: z.literal("similarity"),
  similarity_threshold: z.number().min(0).max(1),
  compare_output_field: nonEmptyString,
  to_input_field: nonEmptyString,
  on_finding: z.enum(["redact", "warn", "block"]),
  replacement: z.string(),
});

/**
 * Discriminated union of DLP rule shapes. The discriminator isn't a single
 * field — it's the presence of `classifications` vs `classifier_model` vs
 * `mode: similarity`, so we tag the normalized result with `kind`.
 */
export type DlpRuleKind = "classification" | "classifier" | "similarity";

export type DlpRule =
  | ({ kind: "classification" } & z.infer<typeof DlpClassificationRuleSchema>)
  | ({ kind: "classifier" } & z.infer<typeof DlpClassifierRuleSchema>)
  | ({ kind: "similarity" } & z.infer<typeof DlpSimilarityRuleSchema>);

export function parseDlpRule(raw: unknown): DlpRule {
  // Determine kind by shape:
  //   - has `classifications.block|warn` -> regex
  //   - has `classifier_model` -> classifier (stubbed)
  //   - has `mode: similarity` -> similarity
  if (
    typeof raw === "object" &&
    raw !== null &&
    "classifications" in (raw as Record<string, unknown>)
  ) {
    return {
      kind: "classification",
      ...DlpClassificationRuleSchema.parse(raw),
    };
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "classifier_model" in (raw as Record<string, unknown>)
  ) {
    return {
      kind: "classifier",
      ...DlpClassifierRuleSchema.parse(raw),
    };
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    (raw as Record<string, unknown>).mode === "similarity"
  ) {
    return {
      kind: "similarity",
      ...DlpSimilarityRuleSchema.parse(raw),
    };
  }
  throw new Error(
    "unrecognized DLP rule shape: expected `classifications`, `classifier_model`, or `mode: similarity`",
  );
}

// --- connectors -----------------------------------------------------------

export const ConnectorSchema = z.object({
  id: kebabIdSchema,
  name: nonEmptyString,
  owner: nonEmptyString,
  reviewers: z.array(z.string()).optional().default([]),
  version: nonEmptyString,
  kind: z.enum(["static-markdown", "oauth2", "internal-api", "mcp"]),
  description: nonEmptyString,
  status: z.enum(["real", "mocked", "planned"]).optional().default("real"),

  // static-markdown
  source: z.string().optional(),
  chunk_by: z.string().optional(),
  retrieval: z.string().optional(),
  max_chunks_per_query: z.number().int().positive().optional(),

  // oauth2
  production_scopes: z.array(z.string()).optional(),
  rate_limit: z
    .object({
      per_user_per_day: z.number().int().positive().optional(),
    })
    .optional(),

  // internal-api
  read_only: z.boolean().optional(),
  scopes_allowed: z.array(z.string()).optional(),
  scopes_forbidden: z.array(z.string()).optional(),
  cache_policy: z
    .object({
      max_age_minutes: z.number().int().positive().optional(),
      evict_on_role_change: z.boolean().optional(),
    })
    .optional(),

  auth: z.string().optional(),
  notes: z.string().optional(),
});

export type Connector = z.infer<typeof ConnectorSchema>;
