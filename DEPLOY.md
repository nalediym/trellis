# Deploying Trellis to Firebase App Hosting

One-time setup takes ~10 min. Every deploy after that is automatic — `git push origin main` triggers a fresh build. Estimated total cost: **$0/month** (Firebase App Hosting free tier on Blaze billing + AI Studio free tier).

## State at the start of this walkthrough

- `~/Projects/trellis/` — standalone repo at this path
- `nalediym/trellis` — public GitHub repo, branch `main`
- `trellis-nalediym` — dedicated GCP project, billing linked, all required APIs enabled (Firebase, App Hosting, Cloud Build, Run, Artifact Registry, Secret Manager, Gemini, IAM Credentials)

## One-time setup

### 1. Firebase CLI is installed

Already done. Verify:

```bash
firebase --version
```

### 2. Log into Firebase

```bash
firebase login
```

Opens a browser. Pick `nalediymkekana@gmail.com` — the same account that owns the GCP project.

### 3. Promote the GCP project to a Firebase project

Open: <https://console.firebase.google.com/>
- Click **Add project**
- Select **Add Firebase to an existing Google Cloud project**
- Pick `trellis-nalediym`
- Skip Google Analytics (not needed for this demo)
- Click **Add Firebase**

Takes ~30 seconds.

### 4. Link this repo to Firebase App Hosting

```bash
cd ~/Projects/trellis

firebase init apphosting
```

Answers to the prompts:
- **Project**: `trellis-nalediym`
- **Backend name**: `trellis`
- **Region**: `us-central1` (cheapest + lowest-latency for NYC)
- **GitHub repo**: `nalediym/trellis`
- **Branch**: `main`
- **Root dir**: `/` (the Next.js app is at the repo root)

The CLI opens a browser to authorize Firebase's GitHub app against your `nalediym/trellis` repo. Grant it.

### 5. Set the Gemini API key as a secret

Get a free key from <https://aistudio.google.com/app/apikey> — pick the `trellis-nalediym` project when prompted.

```bash
firebase apphosting:secrets:set GOOGLE_GENERATIVE_AI_API_KEY
# Paste the AIza... key when prompted.
# Say "yes" when it asks to grant the App Hosting backend access.
```

Stored encrypted in Google Secret Manager, never committed to git.

### 6. First deploy

The `firebase init apphosting` step in 4 usually kicks off the first rollout automatically. If not:

```bash
firebase apphosting:backends:list                  # confirm `trellis` is there
firebase apphosting:rollouts:create trellis        # trigger a manual rollout
```

Watch the build:

```bash
firebase apphosting:builds:list --backend trellis
```

In ~3–5 min you'll have a live URL like `https://trellis--trellis-nalediym.us-central1.hosted.app`. The Firebase console shows it too:

<https://console.firebase.google.com/project/trellis-nalediym/apphosting>

## After first deploy

- Every `git push origin main` auto-deploys.
- Preview URLs for other branches can be enabled via the console.
- Drop the live URL into:
  - `README.md` line 5 (the `<your-firebase-url>` placeholder)
  - Your resume's Selected AI Projects section
  - Your cover letter's demo paragraph

## Monitoring + logs

```bash
firebase apphosting:logs --backend trellis         # tail logs
firebase apphosting:builds:get <build-id>          # inspect a specific build
```

Or in the browser: <https://console.firebase.google.com/project/trellis-nalediym/apphosting>.

## Rollback

```bash
firebase apphosting:rollouts:rollback --backend trellis
```

Rolls back to the previous successful deploy.

## Cost

- **Firebase App Hosting**: requires Blaze (pay-as-you-go) billing plan, but the free tier covers 2M requests/month; scales to zero when idle.
- **Cloud Run (underlying)**: 2M requests/month free, 360K vCPU-seconds/month free.
- **Cloud Build**: 120 build-minutes/day free (each Trellis build is ~3 min).
- **Artifact Registry**: 0.5 GB free storage.
- **Secret Manager**: 6 active secret versions free, 10K access operations/month free.
- **Gemini API (AI Studio)**: 1,500 requests/day free on Flash, plenty for demo.

**Expected monthly cost at demo scale: $0.** Even 100K requests/month would be under $5.

If traffic goes wild: you'll get a GCP budget alert. Set one explicitly at <https://console.cloud.google.com/billing/budgets?project=trellis-nalediym>.

## Troubleshooting

**Build fails on "cannot find module '@ai-sdk/google'"**
- Cause: `npm install` didn't run. Fix: Firebase App Hosting runs `npm ci` automatically, but `package-lock.json` must be committed. Check the lockfile is in git.

**Build fails on "GOOGLE_GENERATIVE_AI_API_KEY is not defined"**
- Cause: the secret wasn't created or wasn't granted to the backend. Re-run step 5.

**`npm run validate:manifests` fails in the build step**
- Cause: a YAML file broke validation. Fix locally, commit, push. The prebuild gate is intentional — bad manifests can't deploy.

**CORS errors from the browser**
- App Hosting serves the whole app from one origin, so CORS shouldn't fire. If you see it, check that you haven't accidentally pointed a client-side fetch at a different host.

**"Requires Blaze billing plan"**
- The billing account is already linked to `trellis-nalediym` (confirmed by `gcloud billing projects describe trellis-nalediym`). If Firebase still complains, re-link it in the console: <https://console.firebase.google.com/project/trellis-nalediym/usage/details>.
