# Trellis build checklist

Pivot from parent-comms demo to platform. Timeline: ~1 week push. This doc tracks what's in flight and what's left.

Legend: [x] done · [~] in progress · [ ] todo · [?] open question

## Phase A · IaC scaffold — DONE (2026-04-21)

- [x] `platform/` directory tree
- [x] 5 skill manifests
- [x] 4 persona manifests
- [x] 1 policy-bindings file
- [x] 3 DLP rule manifests
- [x] 3 connector manifests
- [x] Skill JSON schema
- [x] `PLATFORM.md` vision doc
- [x] `README.md` Trellis framing
- [x] `platform/README.md` control-plane tour

## Phase B · runtime wiring — DONE (2026-04-21)

- [x] `lib/schemas.ts` — zod schemas for skill / persona / policy-binding / dlp-rule / connector
- [x] `lib/manifests.ts` — YAML loader, validator, frozen in-memory registry
- [x] `lib/policy.ts` — `canInvoke(persona, skill, inputs) → {allowed, reason}` + rate-limit bookkeeping
- [x] `lib/dlp.ts` — generalized scanner consuming DLP manifests; returns findings + transformed payload
- [x] `lib/audit.ts` — append-only JSONL + in-memory ring buffer
- [x] `lib/personas.ts` — persona switcher with cookie-backed selection for the demo
- [x] `lib/connectors/handbook.ts` — real (reads `handbook/*.md`)
- [x] `lib/connectors/gmail.ts` — mocked (types + fake responses)
- [x] `lib/connectors/sis.ts` — mocked (scoped reads only)
- [x] `scripts/validate-manifests.ts` — standalone validator, used by `npm run validate:manifests` + prebuilt into `npm run build`
- [x] `.env.example` update
- [x] `package.json` deps (js-yaml, tsx)

## Phase C · UI routes — DONE (2026-04-21)

- [x] `/` landing — pitch + persona switcher + primary CTA into `/skills`
- [x] `/skills` catalog — filtered by current persona via policy engine
- [x] `/skills/[id]` — runtime form + streaming output panel + DLP banners
- [x] `/platform` — manifest viewer: tree + raw YAML + rendered interpretation
- [x] `/audit` — log viewer (admin-only via persona check)
- [x] `/connectors` — connector status page
- [x] `components/persona-switcher.tsx`
- [x] `components/dlp-warning.tsx`
- [x] `components/manifest-viewer.tsx`
- [x] `components/audit-row.tsx`
- [x] `components/connector-card.tsx`
- [x] `components/skill-card.tsx`
- [x] `components/skill-runner.tsx`
- [x] `components/site-header.tsx`

## Phase D · skill runtimes — DONE (2026-04-21)

- [x] `parent-comms-attendance` — flagship, real streaming via Opus (rewired through policy + new DLP scanner + audit)
- [x] `lesson-plan-qa` — real (retrieval over handbook + Haiku streaming answer + citations)
- [x] `ops-ticket-triage` — real (Haiku structured JSON output; `ticket-paraphrase` similarity DLP rule fires)
- [x] `policy-handbook-summary` — real (one-shot Haiku summary of selected section)
- [x] `parent-contact-translate` — real (one-shot Opus translation + `review_required: true` classifier-label)

Every runner degrades to a deterministic stub when `ANTHROPIC_API_KEY` is absent. The `fern-minors` classifier DLP rule ships intentionally stubbed — see `lib/dlp.ts` and `platform/dlp/fern-minors.yaml`.

## Phase E · polish

- [ ] README: drop in the Vercel URL once deployed
- [ ] PLATFORM.md: fill the "TODO" schema references
- [ ] Screenshots / GIFs embedded in README
- [ ] A loom or short recording (optional)
- [ ] Manifest validator runs in CI on every PR (GitHub Actions)
- [x] `npm run test:engines` for the policy engine + DLP scanner (10 cases)

## Phase F · ship (Firebase App Hosting)

See [DEPLOY.md](./DEPLOY.md) for the full walkthrough.

- [ ] `gh repo create nalediym/demo-prompt-blueprint --public --source=. --remote=origin` *(from worktree root)*
- [ ] `git push -u origin platform`
- [ ] `firebase login`
- [ ] Add Firebase to existing GCP project `job-network-helper` via console
- [ ] `firebase init apphosting` → backend `trellis`, branch `platform`
- [ ] `firebase apphosting:secrets:set GOOGLE_GENERATIVE_AI_API_KEY` *(AI Studio key)*
- [ ] Grab live URL from Firebase console; paste into `README.md` + this checklist
- [ ] Update resume Projects section with Trellis live URL
- [ ] Update cover letter: repoint demo paragraph to Trellis + new URL
- [ ] Update `~/.claude/plans/please-use-chrome-and-agile-quail.md` with the final submission packet

## Application submission — BLOCKED on Phase F

Originally scoped for this week; pushed ~1 week per user decision.

## Open questions

- [?] Keep the repo name `demo-prompt-blueprint` (existing GitHub URL, unchanged resume links) or rename to `trellis` (stronger branding)? Keeping the old name is safer; renaming is a better story but requires a resume/cover-letter edit.
- [?] Merge `platform` into `main` once it's solid, or keep `main` as the small-scope fallback?
- [?] Include screenshots / short recording in the README before submission?
