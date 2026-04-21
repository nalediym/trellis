# Trellis — the platform pivot

*Working name. A trellis is a support structure things grow on. This is the support structure non-technical staff grow AI workflows on.*

## The one-sentence pitch

**Trellis is a declaratively-configured AI platform for mission-driven organizations: a catalog of skills, a DLP-aware runtime, and an audit trail — with permissions, policies, and connectors defined as version-controlled manifests that a non-technical teammate can open a PR against.**

## Why this, instead of another single-purpose agent

Uncommon Schools doesn't need one more AI tool. It needs a way to let **any** staff member safely use AI for the workflow in front of them — and a way for the Data & IT team to govern that usage without becoming the bottleneck. Trellis is the shape of that answer:

- Every capability (*skill*) is a manifest.
- Every permission (*policy*) is a manifest.
- Every integration (*connector*) is a manifest.
- Every invocation is logged, redacted, and auditable.
- Every change to any of the above is a git diff.

That's the JD in six bullets.

## The three "I wants" from the brief, mapped

> *"a platform that will enable people to use my skills that are private and whatnot"*

→ **The Skill Catalog.** `platform/skills/*.yaml` defines every capability. A skill can point at a Claude model + a prompt, a local script, an MCP server, or Naledi's existing `~/.claude/skills/` directory. Non-technical staff see the catalog as a web UI; it's an IaC manifest underneath.

> *"sandbox their permissions and whatnot... sorta like a browser of sorts"*

→ **The Policy Engine + Persona switcher.** `platform/policies/*.yaml` binds roles to skills. `platform/personas/*.yaml` defines archetypes (Teacher, Principal, Ops, Admin) the visitor can switch between to feel the permission boundaries. The browser-of-sorts is `/skills` — filtered by the current persona's role.

> *"gives them warnings when there is confidential information that comes out"*

→ **The DLP layer.** `platform/dlp/*.yaml` declares what counts as confidential (PII patterns, IEP/504 language, medical terms, student names). Every skill output gets scanned; the UI shows banners; restricted findings hard-block return. Same two-layer architecture as the parent-comms demo, generalized to any skill.

> *"connected to the apps and the data that it has"*

→ **Connectors.** `platform/connectors/*.yaml` declares external integrations with their scopes. Drive, Gmail, SIS (mocked), future: Linear, Slack, the Uncommon wiki. A skill's manifest declares which connectors it needs; policy checks whether the invoking persona is allowed that combination.

> *"infrastructure as code"*

→ **Everything above is a file in `platform/`.** The repo is the control plane. A change is a PR. A rollback is `git revert`. A staging environment is a branch. The platform's current state is literally what's in `main`. The UI reads from the manifests, never from a database.

## The user's journey

### Visitor A: a teacher-coach at a partner school

1. Opens the live URL on her laptop between classes.
2. Picks persona **Teacher** from the top-right switcher.
3. Sees 7 skills she's authorized to run: *draft parent-comms*, *summarize lesson plan*, *translate message to Spanish*, *format attendance notes*, ...
4. Picks *draft parent-comms*. Fills the form. Hits Run.
5. Watches the retrieval → redaction → draft pipeline stream. A yellow banner appears: *"PII detected and redacted before reaching the model."*
6. Copies the draft. Edits it in her real email client. Sends.

### Visitor B: a hiring manager reviewing your application

1. Opens the URL. Immediately sees the **Platform overview** page with an architecture diagram + the IaC story.
2. Clicks **Manifests**. Sees the full `platform/` tree side-by-side with a human-readable view of what each manifest does.
3. Switches persona from Teacher → Ops. Watches the skill catalog re-render (fewer cards, different set). Opens the policy manifest that explains why.
4. Switches to **Admin**. Sees the Audit tab light up: a timestamped log of every invocation on this deployment, with DLP findings and outcomes.
5. Thinks: *"I've interviewed people for this role all month. She's the only one who showed me what a whole team would ship in a quarter."*

## Surface area (MVP — what the worktree scaffolds)

| Piece | State at MVP | Post-MVP |
|---|---|---|
| IaC manifests (`platform/*.yaml`) | 5 skills, 4 personas, 3 connectors, 6 DLP rules, 3 policy bindings | dozens, contributed via PR |
| Manifest loader + zod validator (`lib/schemas.ts`, `lib/manifests.ts`) | typed, validated at startup | hot-reload on file change |
| Persona switcher UI | drop-down in header | SSO in prod |
| Skill browser (`/skills`) | grid, filtered by current persona | search, tags, usage stats |
| Skill detail + invocation (`/skills/[id]`) | parent-comms: real stream; others: stubbed with realistic fake output | all skills real |
| DLP scanner (`lib/dlp.ts`) | regex + classified banners | + LLM classifier + red-team suite |
| Audit log (`lib/audit.ts` + `/audit`) | in-memory for current session + JSONL file | Postgres + dashboards |
| Manifest viewer (`/platform`) | tree + raw YAML + rendered view | diff viewer across branches |
| Connectors catalog (`/connectors`) | status cards (configured / not) | live OAuth dance |

Out of scope for MVP: real SSO, real DB, cross-region deployment, cost tracking, feature flags, A/B testing.

## What the parent-comms flow becomes

It stays. It becomes `platform/skills/parent-comms-attendance.yaml` — the flagship skill in the catalog, bound to the Teacher role, using the Drive connector for handbook retrieval and the Gmail connector for delivery (mocked). The existing Next.js route at `/api/draft` becomes the invocation handler for that one skill. No work thrown away.

## What the technical interview walkthrough sounds like

> *"I picked the hardest part of your JD — 'reusable AI stack templates and low-code tools that empower non-technical team members' — and I built a sketch of what that looks like in production. Every capability is a YAML file. Every permission is a YAML file. Every PII rule is a YAML file. Here's a teacher running a skill — watch the DLP layer fire. Here's an admin running the same skill on different data — different redactions. Here's the audit log. Here's the full manifest tree. Every change is a git diff — so a data analyst at Uncommon could propose a new skill by opening a PR, and you'd review it like code. That's the point."*

## Open questions for you

1. **Name.** "Trellis" feels right for an ed-tech platform ("support for growth"). Other candidates: `Atlas` (catalog-of-everything), `Commons` (shared resource), `Foyer` (entry point). Happy to use any, or go unnamed as just "the platform" in the MVP.
2. **Scope** (from the reality check above): ship Option 1/2/3?
3. **Should the existing `main` branch keep the parent-comms demo as-is** (so you have a fallback if the platform work slips), or merge `platform` → `main` when the skeleton's ready?
4. **Which personas most matter for the demo**? My default picks: Teacher, Principal, Ops Analyst, Admin. Principal could be swapped for Dean of Students. Ops Analyst could be swapped for Parent Liaison.

I've scaffolded the platform/ tree + written the vision. Next I'd scaffold the zod schemas and example manifests so the IaC shape is concrete. After that, a background agent can rebuild the Next.js routes to render manifests as UI. Walking up the stack from data to UI keeps the IaC story clean.
