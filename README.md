# Trellis

[![CI](https://github.com/nalediym/trellis/actions/workflows/ci.yml/badge.svg)](https://github.com/nalediym/trellis/actions/workflows/ci.yml)

*An AI platform for mission-driven education orgs — declaratively configured, DLP-aware, audited by design.*

> **Status:** MVP on `main`, deployable to Firebase App Hosting (see [DEPLOY.md](./DEPLOY.md)). Control plane (5 skills, 4 personas, 3 DLP rules, 3 connectors), runtime (policy + DLP + audit), and UI (catalog, runner, manifest viewer, audit, connectors) all live. Every skill has a working runtime that falls back to a deterministic stub when `GOOGLE_GENERATIVE_AI_API_KEY` is unset. CI runs lint + typecheck + manifest validation + engine tests + build on every push. See [PLATFORM.md](./PLATFORM.md) for the vision, [BUILD-CHECKLIST.md](./BUILD-CHECKLIST.md) for what's in scope.

## The point

This is a sketch of what the JD's hardest bullet actually looks like in production:

> *"Establish reusable AI stack templates and low-code tools that empower non-technical team members to develop solutions independently."*

Every skill, every permission, every integration, every PII rule — a file in [`platform/`](./platform/). A change is a PR. A rollback is a `git revert`. The deployed app is the rendered state of the repo.

## How it maps to the Uncommon JD

| JD language | Where in this repo |
|---|---|
| "reusable AI stack templates" | `platform/skills/*.yaml` |
| "low-code tools for non-technical staff" | the whole UI + the blueprint PR workflow |
| "library of Prompt Blueprints" | `blueprints/*.md` + the `owner`/`reviewers` fields in every skill manifest |
| "100% compliance with security audits regarding PII handling" | `platform/dlp/*.yaml` + `lib/dlp.ts` enforcement |
| "secure API integrations with core Uncommon databases" | `platform/connectors/*.yaml` with scoped fields + explicit forbidden fields |
| "comprehensive documentation of AI environments, tools, and data flows" | the IaC manifests ARE the documentation |
| "coach and support adjacent teams on AI development methodologies" | manifest schemas, PR review workflow, the onboarding surface at `/skills` |
| "translate business challenges into comprehensive technical specifications" | every skill manifest's `description` + `prompt_blueprint` pair |

## What a visitor sees

1. **Persona switcher** top-right — Teacher, Principal, Ops Analyst, Admin. Catalog re-renders.
2. **Skill catalog** — cards filtered by what the current persona is allowed to run.
3. **Skill page** — form + blueprint + live retrieval + DLP scanner + streaming draft.
4. **DLP banners** — yellow for redacted PII, red for hard-blocked content. Every invocation shows exactly which rules fired.
5. **Manifest viewer** — the `platform/` tree with raw YAML and a human-readable rendering side-by-side. The IaC pitch in one screen.
6. **Audit log** (admin only) — every invocation: persona, skill, timestamp, DLP findings, outcome.

## Tech stack

- **Next.js 16 App Router**, React 19, strict TypeScript
- **Tailwind CSS v4**, warm-terracotta accent
- **Vercel AI SDK v6** with `google/<model>` gateway strings (Gemini 2.5 Pro for drafts, 2.5 Flash for classifiers)
- **zod** for runtime validation of every manifest at startup
- **js-yaml** for manifest parsing (no dynamic code)
- No database. No auth. In-memory state. The point is the shape, not the scale.

## Run it locally

```bash
npm install
cp .env.example .env.local   # drop GOOGLE_GENERATIVE_AI_API_KEY in here for live drafts
npm run validate:manifests   # load + lint every YAML in platform/ (also runs before build)
npm run test:engines         # 10-case smoke test for policy + DLP
npm run dev                  # http://localhost:3000
```

Without the key the app still runs end-to-end — every skill swaps to a deterministic stub, the full pipeline (policy → input DLP → retrieval → output → output DLP → audit) still streams, and a "stub mode" badge appears on the results panel.

## The five skills

All five have working runtimes; all five fall back to deterministic stubs when no API key is set, so the pipeline (policy → DLP → retrieval → generation → DLP → audit) is demonstrable either way.

| Skill | Kind | DLP rules | Notes |
|---|---|---|---|
| `parent-comms-attendance` | streaming-agent | pii-core, fern-minors | Flagship. Gemini 2.5 Pro draft with handbook retrieval. |
| `lesson-plan-qa` | streaming-agent | pii-core | Gemini 2.5 Flash answer grounded in handbook citations. |
| `policy-handbook-summary` | one-shot | pii-core | Gemini 2.5 Flash summary of a handbook section, audience-aware. |
| `parent-contact-translate` | one-shot | pii-core | Gemini 2.5 Pro translation with `review_required: true` classifier label. |
| `ops-ticket-triage` | classifier | pii-core, ticket-paraphrase | Gemini 2.5 Flash structured JSON; similarity rule blocks rationale echo. |

## What this is NOT

- A production platform. No SSO, no DB, no multi-tenant isolation, no cost tracking.
- A replacement for existing Uncommon systems. It's a sketch of a control plane.
- Ready to touch real student data. Every handbook page, every input, every connector response is synthesized.

See [PLATFORM.md](./PLATFORM.md) for the vision, architecture, and scope boundary.

## Related artifacts

- The Python-era CLI version lives in the git history on `main`, pre-commit `459babc`.
- The interview prep for this application is in [`../interview-prep/`](../interview-prep/).
- The system-design doc for the flagship skill in production is at [`../interview-prep/system-design-parent-comms.md`](../interview-prep/system-design-parent-comms.md) — this repo is a smaller, clickable version of that doc.
