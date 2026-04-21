# `platform/` — Trellis control plane

Everything in this directory is **infrastructure as code**. The deployed app reads these files at startup and renders them as UI. To change the platform's behavior, open a PR against a file in here — there are no hidden runtime tables.

## Layout

```
platform/
├── README.md                       ← this file
├── schema/                         ← JSON Schema for each manifest type (validated at load)
│   ├── skill.schema.yaml
│   ├── persona.schema.yaml         (TODO)
│   ├── policy.schema.yaml          (TODO)
│   ├── dlp.schema.yaml             (TODO)
│   └── connector.schema.yaml       (TODO)
├── skills/                         ← one file = one skill
│   ├── parent-comms-attendance.yaml
│   ├── lesson-plan-qa.yaml
│   ├── ops-ticket-triage.yaml
│   ├── policy-handbook-summary.yaml
│   └── parent-contact-translate.yaml
├── personas/                       ← who uses the platform
│   ├── teacher.yaml
│   ├── principal.yaml
│   ├── ops-analyst.yaml
│   └── admin.yaml
├── policies/                       ← who can do what
│   └── bindings.yaml               ← role → skills + rate limits
├── dlp/                            ← what must not leak
│   ├── pii-core.yaml               ← regex layer (SSN, phone, address)
│   ├── fern-minors.yaml            ← FERPA-adjacent (IEP, medical, third-party minors)
│   └── ticket-paraphrase.yaml      ← "don't echo the ticket body in the triage rationale"
└── connectors/                     ← external systems this platform is allowed to touch
    ├── handbook.yaml               ← static markdown, real
    ├── gmail.yaml                  ← mocked; production scopes declared
    └── sis.yaml                    ← mocked; scoped reads + explicit forbidden fields
```

## Who edits what

| File type | Who can open a PR | Who must approve |
|-----------|-------------------|------------------|
| `skills/*.yaml` | any contributor | the skill's `owner` + one `reviewer` |
| `personas/*.yaml` | Data & IT | Security officer |
| `policies/*.yaml` | Data & IT | Security officer + legal liaison |
| `dlp/*.yaml` | Data & IT, security officer | Legal liaison (required) |
| `connectors/*.yaml` | Data & IT | Security officer + the system's owner |

(These are intended workflows for a real deployment. In the demo every file is editable by you — but the `owner`/`reviewers` fields appear in the UI so a visitor sees the intent.)

## Validating a change locally

```bash
npm run validate:manifests    # typecheck + zod validation of every file in platform/
```

This runs at `npm run build` time too, so a broken manifest fails CI before it hits production.

## How the UI renders these

- `/` — landing page; links to the sections below
- `/skills` — reads `skills/*.yaml` + `policies/bindings.yaml`, filters by current persona
- `/skills/[id]` — reads the skill + its blueprint + its DLP rules, runs the invocation with policy + DLP enforcement
- `/platform` — the manifest viewer: browse the tree, see the raw YAML, see the rendered interpretation
- `/audit` — the log of every invocation (admin-only)
- `/connectors` — status cards for each connector

Every page is a direct projection of these YAML files. Nothing is rendered from a database.
