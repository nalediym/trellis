/**
 * Manifest loader — reads every YAML file in `platform/` at startup,
 * validates with zod, and freezes into an in-memory Registry.
 *
 * This is the entire "control plane read path" of the platform. Every
 * HTTP request reads from this registry; nothing ever reads YAML at
 * request time. A broken manifest crashes the server at startup with a
 * clear pointer to which file + which field — so bad state can never
 * reach a user.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

import {
  ConnectorSchema,
  PersonaSchema,
  PolicyBindingsFileSchema,
  SkillSchema,
  parseDlpRule,
  type Connector,
  type DlpRule,
  type Persona,
  type PolicyBinding,
  type Skill,
} from "./schemas";

export interface Registry {
  skills: ReadonlyArray<Skill>;
  skillsById: ReadonlyMap<string, Skill>;
  personas: ReadonlyArray<Persona>;
  personasById: ReadonlyMap<string, Persona>;
  connectors: ReadonlyArray<Connector>;
  connectorsById: ReadonlyMap<string, Connector>;
  dlpRules: ReadonlyArray<DlpRule>;
  dlpRulesById: ReadonlyMap<string, DlpRule>;
  policyBindings: ReadonlyArray<PolicyBinding>;
}

function platformDir(): string {
  return path.join(process.cwd(), "platform");
}

function readYaml(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return yaml.load(raw);
}

function listYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort()
    .map((f) => path.join(dir, f));
}

function formatZodError(filePath: string, err: unknown): string {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: unknown[]; message: string }> })
      .issues;
    return (
      `manifest validation failed for ${filePath}:\n` +
      issues
        .map((i) => `  · ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n")
    );
  }
  return `manifest load failed for ${filePath}: ${
    err instanceof Error ? err.message : String(err)
  }`;
}

function loadSkills(): Skill[] {
  const files = listYamlFiles(path.join(platformDir(), "skills"));
  const out: Skill[] = [];
  for (const f of files) {
    try {
      out.push(SkillSchema.parse(readYaml(f)));
    } catch (err) {
      throw new Error(formatZodError(f, err));
    }
  }
  return out;
}

function loadPersonas(): Persona[] {
  const files = listYamlFiles(path.join(platformDir(), "personas"));
  const out: Persona[] = [];
  for (const f of files) {
    try {
      out.push(PersonaSchema.parse(readYaml(f)));
    } catch (err) {
      throw new Error(formatZodError(f, err));
    }
  }
  return out;
}

function loadConnectors(): Connector[] {
  const files = listYamlFiles(path.join(platformDir(), "connectors"));
  const out: Connector[] = [];
  for (const f of files) {
    try {
      out.push(ConnectorSchema.parse(readYaml(f)));
    } catch (err) {
      throw new Error(formatZodError(f, err));
    }
  }
  return out;
}

function loadDlpRules(): DlpRule[] {
  const files = listYamlFiles(path.join(platformDir(), "dlp"));
  const out: DlpRule[] = [];
  for (const f of files) {
    try {
      out.push(parseDlpRule(readYaml(f)));
    } catch (err) {
      throw new Error(formatZodError(f, err));
    }
  }
  return out;
}

function loadPolicyBindings(): PolicyBinding[] {
  const file = path.join(platformDir(), "policies", "bindings.yaml");
  try {
    return PolicyBindingsFileSchema.parse(readYaml(file)).bindings;
  } catch (err) {
    throw new Error(formatZodError(file, err));
  }
}

function buildRegistry(): Registry {
  const skills = loadSkills();
  const personas = loadPersonas();
  const connectors = loadConnectors();
  const dlpRules = loadDlpRules();
  const policyBindings = loadPolicyBindings();

  // --- cross-manifest integrity checks ----------------------------------

  const skillIds = new Set(skills.map((s) => s.id));
  const connectorIds = new Set(connectors.map((c) => c.id));
  const dlpIds = new Set(dlpRules.map((r) => r.id));
  const personaRoles = new Set(personas.map((p) => p.role));

  // Every connector and DLP rule reference in a skill must exist.
  for (const s of skills) {
    for (const c of s.connectors ?? []) {
      if (!connectorIds.has(c)) {
        throw new Error(
          `skill ${s.id} references unknown connector "${c}"`,
        );
      }
    }
    for (const d of s.dlp_rules ?? []) {
      if (!dlpIds.has(d)) {
        throw new Error(`skill ${s.id} references unknown DLP rule "${d}"`);
      }
    }
  }

  // Every policy binding must point at a known role and skills.
  for (const b of policyBindings) {
    if (!personaRoles.has(b.role)) {
      throw new Error(
        `policy binding role "${b.role}" does not match any persona role`,
      );
    }
    if (Array.isArray(b.skills)) {
      for (const sid of b.skills) {
        if (!skillIds.has(sid)) {
          throw new Error(
            `policy binding (role=${b.role}) references unknown skill "${sid}"`,
          );
        }
      }
    }
  }

  return Object.freeze({
    skills: Object.freeze(skills),
    skillsById: new Map(skills.map((s) => [s.id, s])),
    personas: Object.freeze(personas),
    personasById: new Map(personas.map((p) => [p.id, p])),
    connectors: Object.freeze(connectors),
    connectorsById: new Map(connectors.map((c) => [c.id, c])),
    dlpRules: Object.freeze(dlpRules),
    dlpRulesById: new Map(dlpRules.map((r) => [r.id, r])),
    policyBindings: Object.freeze(policyBindings),
  });
}

let cached: Registry | null = null;
export function getRegistry(): Registry {
  if (!cached) cached = buildRegistry();
  return cached;
}

// --- convenience accessors used throughout the app ----------------------

export function getSkills(): ReadonlyArray<Skill> {
  return getRegistry().skills;
}

export function getSkill(id: string): Skill | undefined {
  return getRegistry().skillsById.get(id);
}

export function getPersonas(): ReadonlyArray<Persona> {
  return getRegistry().personas;
}

export function getPersona(id: string): Persona | undefined {
  return getRegistry().personasById.get(id);
}

export function getConnectors(): ReadonlyArray<Connector> {
  return getRegistry().connectors;
}

export function getConnector(id: string): Connector | undefined {
  return getRegistry().connectorsById.get(id);
}

export function getDlpRules(): ReadonlyArray<DlpRule> {
  return getRegistry().dlpRules;
}

export function getDlpRule(id: string): DlpRule | undefined {
  return getRegistry().dlpRulesById.get(id);
}

export function getPolicyBindings(): ReadonlyArray<PolicyBinding> {
  return getRegistry().policyBindings;
}

/**
 * Return the raw YAML text for a manifest file — used by the /platform
 * viewer to display the source of truth alongside the rendered view.
 */
export function readManifestSource(relativePath: string): string {
  const safe = relativePath.replace(/\.\.+/g, "");
  const full = path.join(platformDir(), safe);
  if (!fs.existsSync(full)) {
    throw new Error(`manifest not found: ${relativePath}`);
  }
  return fs.readFileSync(full, "utf-8");
}

/**
 * Enumerate the platform tree so the UI can render it. Returns
 * {section, file, id} tuples without reading bodies.
 */
export interface ManifestTreeEntry {
  section: "skills" | "personas" | "policies" | "dlp" | "connectors" | "schema";
  file: string; // relative to platform/
  id: string;
}

export function listManifestTree(): ManifestTreeEntry[] {
  const sections: Array<ManifestTreeEntry["section"]> = [
    "skills",
    "personas",
    "policies",
    "dlp",
    "connectors",
    "schema",
  ];
  const out: ManifestTreeEntry[] = [];
  for (const section of sections) {
    const dir = path.join(platformDir(), section);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
      out.push({
        section,
        file: `${section}/${f}`,
        id: f.replace(/\.(yaml|yml)$/, ""),
      });
    }
  }
  return out;
}
