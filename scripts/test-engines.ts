/**
 * Smoke tests for the policy engine + DLP scanner. 10 cases total,
 * no test runner — just asserts and a summary. `npm run test:engines`.
 */
import { canInvoke, previewInvoke, resetRateLimits } from "../lib/policy";
import { scanOutput } from "../lib/dlp";

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

const results: Result[] = [];

function expect(name: string, cond: boolean, detail: string): void {
  results.push({ name, ok: cond, detail });
}

// --- policy tests ---------------------------------------------------------

resetRateLimits();

const p1 = previewInvoke({
  personaId: "teacher",
  skillId: "parent-comms-attendance",
});
expect(
  "policy:teacher-allowed-parent-comms",
  p1.allowed === true,
  `allowed=${p1.allowed} reason=${p1.reason}`,
);

const p2 = previewInvoke({
  personaId: "ops-analyst",
  skillId: "parent-comms-attendance",
});
expect(
  "policy:ops-denied-parent-comms",
  p2.allowed === false,
  `allowed=${p2.allowed} reason=${p2.reason}`,
);

const p3 = previewInvoke({ personaId: "admin", skillId: "ops-ticket-triage" });
expect(
  "policy:admin-wildcard",
  p3.allowed === true,
  `reason=${p3.reason}`,
);

const p4 = previewInvoke({ personaId: "teacher", skillId: "ops-ticket-triage" });
expect(
  "policy:teacher-denied-ops-ticket",
  p4.allowed === false,
  `reason=${p4.reason}`,
);

const p5 = previewInvoke({ personaId: "ghost", skillId: "parent-comms-attendance" });
expect(
  "policy:unknown-persona-denied",
  p5.allowed === false,
  `reason=${p5.reason}`,
);

// --- rate-limit bookkeeping ----------------------------------------------

resetRateLimits();
let lastRemaining = Infinity;
for (let i = 0; i < 5; i++) {
  const d = canInvoke({ personaId: "teacher", skillId: "lesson-plan-qa" });
  if (d.remainingRateLimit != null) {
    lastRemaining = d.remainingRateLimit;
  }
}
expect(
  "policy:rate-limit-decrements",
  lastRemaining === 45,
  `remaining after 5 calls = ${lastRemaining} (expected 45)`,
);

// --- DLP tests ------------------------------------------------------------

const dlp1 = scanOutput({
  output: "call me at (917) 555-1234",
  dlpRuleIds: ["pii-core"],
});
expect(
  "dlp:phone-warns",
  dlp1.findings.some((f) => f.severity === "warn" && f.label === "Phone number"),
  `findings=${JSON.stringify(dlp1.findings.map((f) => f.label))}`,
);

const dlp2 = scanOutput({
  output: "SSN 123-45-6789",
  dlpRuleIds: ["pii-core"],
});
expect(
  "dlp:ssn-blocks",
  dlp2.blocked === true,
  `blocked=${dlp2.blocked}`,
);

const dlp3 = scanOutput({
  output: "Two unexplained absences trigger a guardian call.",
  dlpRuleIds: ["pii-core"],
});
expect(
  "dlp:clean-text-passes",
  dlp3.findings.filter((f) => f.severity !== "info").length === 0 && !dlp3.blocked,
  `findings=${JSON.stringify(dlp3.findings)}`,
);

// Similarity-rule test
const dlp4 = scanOutput({
  output: "",
  dlpRuleIds: ["ticket-paraphrase"],
  structuredOutput: { rationale: "login access issue on the student system" },
  inputs: { ticket_body: "login access issue on the student system" },
});
expect(
  "dlp:similarity-fires-on-echo",
  dlp4.findings.some((f) => f.rule_id === "ticket-paraphrase"),
  `findings=${JSON.stringify(dlp4.findings)}`,
);

// --- summary --------------------------------------------------------------

const passed = results.filter((r) => r.ok).length;
const total = results.length;

console.log("─".repeat(72));
console.log("Trellis — engine smoke tests");
console.log("─".repeat(72));
for (const r of results) {
  console.log(
    `${r.ok ? "✓" : "✗"} ${r.name.padEnd(44)} ${r.ok ? "" : "— " + r.detail}`,
  );
}
console.log("─".repeat(72));
console.log(`${passed}/${total} passed`);

if (passed !== total) {
  process.exit(1);
}
