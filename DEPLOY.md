# Deploying Trellis to Firebase App Hosting

Almost everything is declared in files. The only genuinely interactive step is the first-time GitHub OAuth (Firebase's app has to be granted access to your repo from a browser). Estimated cost at demo scale: **$0/month** (Firebase free tier on Blaze billing + AI Studio free tier).

## State before you start

- `~/Projects/trellis/` — repo root
- `github.com/nalediym/trellis` — public GitHub repo, `main` branch
- `trellis-nalediym` — dedicated GCP project, billing linked, all APIs enabled

## Config files — the declarative part

| File | What it pins |
|---|---|
| `.firebaserc` | The Firebase project ID (`trellis-nalediym`) — no "which project?" prompt |
| `firebase.json` | Backend name (`trellis`), root dir (`/`), ignore list |
| `apphosting.yaml` | Runtime config: scale-to-zero, 512 MiB, 120s timeout, secret-backed env |
| `scripts/deploy.sh` | Non-interactive driver for `firebase apphosting:backends:create` + secret creation |

All committed. Nothing to re-enter every deploy.

## One-time setup (~6 min)

### 1. Log into Firebase

```bash
firebase login
```

Browser opens. Pick `nalediymkekana@gmail.com`.

### 2. Promote the GCP project to a Firebase project

<https://console.firebase.google.com/> → **Add project** → **Add Firebase to an existing Google Cloud project** → pick `trellis-nalediym` → skip analytics → done.

~30 seconds.

### 3. Grab a free Gemini key

<https://aistudio.google.com/app/apikey> → **Create API key** → pick `trellis-nalediym` → copy the `AIza...` string.

### 4. Run the deploy script

```bash
cd ~/Projects/trellis
export GEMINI_API_KEY='AIza...your-key...'
bash scripts/deploy.sh
```

The script:
- Verifies you're logged in and the project is visible
- Creates the App Hosting backend `trellis` in `us-central1` (non-interactive; reads `firebase.json` for the name + root dir)
- Stores your Gemini key in Secret Manager as `GOOGLE_GENERATIVE_AI_API_KEY`
- Grants the backend access to that secret

Output ends with a link to the Firebase console where you'll do the last manual step.

### 5. Link the GitHub repo (the one interactive step)

Open the link the script printed:

<https://console.firebase.google.com/project/trellis-nalediym/apphosting>

- Click your `trellis` backend
- Click **Connect a GitHub repository**
- Authorize Firebase's GitHub app if it hasn't been (this is the OAuth dance)
- Pick `nalediym/trellis`, branch `main`, root `/`
- Hit **Save**

This step exists because Firebase needs the user's GitHub permission to install its webhook — no CLI way around it. Do it once, and every subsequent `git push origin main` auto-deploys.

### 6. Trigger the first rollout

The link step above usually kicks off the first build automatically. If not:

```bash
firebase apphosting:rollouts:create trellis --project=trellis-nalediym
```

## Ongoing deploys

```bash
git push origin main
```

That's it. App Hosting sees the push, rebuilds, rolls out. Takes ~3–5 min per deploy.

Watch builds:

```bash
firebase apphosting:builds:list --project=trellis-nalediym --backend=trellis
firebase apphosting:logs --project=trellis-nalediym --backend=trellis
```

Or in the browser: <https://console.firebase.google.com/project/trellis-nalediym/apphosting>.

## After first deploy — update your portfolio

Once the live URL is printed (something like `https://trellis--trellis-nalediym.us-central1.hosted.app`), paste it into:

- `README.md` line 5 (replaces `<your-firebase-url>`)
- Your resume's Selected AI Projects section (it can replace or complement `linux-jr`)
- Your cover letter's demo paragraph

## Rollback

```bash
firebase apphosting:rollouts:rollback --project=trellis-nalediym --backend=trellis
```

## Cost

| Component | Free tier / realistic cost |
|---|---|
| App Hosting | 2M requests/month free, scales to zero |
| Cloud Run (underlying) | 2M requests/month free, 360K vCPU-seconds/month free |
| Cloud Build | 120 build-minutes/day free (each Trellis build ~3 min) |
| Artifact Registry | 0.5 GB storage free |
| Secret Manager | 6 active secret versions free, 10K access ops/month free |
| Gemini API (AI Studio) | 1,500 requests/day on Flash, plenty for demo |
| **Total at demo scale** | **$0/month** |

Set a budget alert at <https://console.cloud.google.com/billing/budgets?project=trellis-nalediym> if you want insurance against surprises.

## Troubleshooting

**`scripts/deploy.sh` says "firebase can't see project"**
- Step 1 (`firebase login`) or step 2 (promote to Firebase project) hasn't been done. Run those.

**Build fails on "cannot find module '@ai-sdk/google'"**
- `package-lock.json` isn't committed. Fix: `git add package-lock.json && git commit && git push`.

**Build fails on "GOOGLE_GENERATIVE_AI_API_KEY is not defined"**
- The secret wasn't created or wasn't granted to the backend. Re-run `deploy.sh` with `GEMINI_API_KEY` set.

**`npm run validate:manifests` fails in the build step**
- A YAML file broke validation. Fix locally, push. The prebuild gate is intentional — bad manifests can't deploy.

**"Requires Blaze billing plan"**
- Billing is already linked to `trellis-nalediym` (confirmed during project setup). If it still complains, re-link in the console: <https://console.firebase.google.com/project/trellis-nalediym/usage/details>.
