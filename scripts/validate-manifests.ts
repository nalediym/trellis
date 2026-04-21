/**
 * Standalone validator for the platform/ tree.
 *
 * Invoked by `npm run validate:manifests`. Exits 0 on success and prints
 * a table of loaded items; exits non-zero with a pointer at the first
 * validation failure otherwise. Runs in CI on every PR.
 */
import {
  getConnectors,
  getDlpRules,
  getPersonas,
  getPolicyBindings,
  getSkills,
  getRegistry,
} from "../lib/manifests";

function hr(n = 72): string {
  return "─".repeat(n);
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

function main(): void {
  try {
    getRegistry(); // force load
  } catch (err) {
    console.error("\n❌ manifest validation failed\n");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const skills = getSkills();
  const personas = getPersonas();
  const connectors = getConnectors();
  const dlpRules = getDlpRules();
  const bindings = getPolicyBindings();

  console.log(hr());
  console.log("Trellis — manifest validation");
  console.log(hr());
  console.log(`  skills:      ${skills.length}`);
  console.log(`  personas:    ${personas.length}`);
  console.log(`  connectors:  ${connectors.length}`);
  console.log(`  dlp rules:   ${dlpRules.length}`);
  console.log(`  bindings:    ${bindings.length}`);
  console.log(hr());

  console.log("\nSkills");
  console.log(hr());
  console.log(
    pad("id", 34) +
      pad("kind", 18) +
      pad("version", 10) +
      "dlp_rules",
  );
  console.log(hr());
  for (const s of skills) {
    console.log(
      pad(s.id, 34) +
        pad(s.kind, 18) +
        pad(s.version, 10) +
        (s.dlp_rules ?? []).join(","),
    );
  }

  console.log("\nPersonas");
  console.log(hr());
  console.log(pad("id", 20) + pad("role", 14) + "name");
  console.log(hr());
  for (const p of personas) {
    console.log(pad(p.id, 20) + pad(p.role, 14) + p.name);
  }

  console.log("\nPolicy bindings");
  console.log(hr());
  console.log(pad("role", 14) + pad("skills", 34) + "per_day");
  console.log(hr());
  for (const b of bindings) {
    const s = b.skills === "*" ? "*" : `[${b.skills.length}]`;
    console.log(
      pad(b.role, 14) +
        pad(s, 34) +
        String(b.rate_limit?.per_user_per_day ?? "—"),
    );
  }

  console.log("\nDLP rules");
  console.log(hr());
  console.log(pad("id", 26) + pad("kind", 16) + "version");
  console.log(hr());
  for (const r of dlpRules) {
    console.log(pad(r.id, 26) + pad(r.kind, 16) + r.version);
  }

  console.log("\nConnectors");
  console.log(hr());
  console.log(
    pad("id", 16) + pad("kind", 18) + pad("status", 10) + "name",
  );
  console.log(hr());
  for (const c of connectors) {
    console.log(
      pad(c.id, 16) +
        pad(c.kind, 18) +
        pad(c.status ?? "real", 10) +
        c.name,
    );
  }

  console.log("\n✅ all manifests validated");
}

main();
