# Deploying Trellis to Firebase App Hosting

One-time setup takes ~10 min. Every deploy after that is automatic — `git push origin platform` triggers a fresh build. Estimated total cost: **$0/month** (Spark plan free tier + AI Studio free tier).

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

Opens a browser. Pick the Google account you want to deploy under (probably `nalediymkekana@gmail.com`).

### 3. Add Firebase to the existing GCP project

You already have `job-network-helper` as a GCP project with APIs enabled. Promote it to a Firebase project:

Open: <https://console.firebase.google.com/>
- Click **Add project**
- Select **Add Firebase to an existing Google Cloud project**
- Pick `job-network-helper`
- Skip Google Analytics (not needed for this demo)
- Click **Add Firebase**

Takes ~30 seconds.

### 4. Link this repo to Firebase App Hosting

```bash
cd ~/Projects/apply-uncommon-school-platform/demo-prompt-blueprint

firebase init apphosting
```

Answers:
- Project: `job-network-helper`
- Backend name: `trellis`
- Region: `us-central1` (cheapest + lowest-latency for NYC)
- GitHub repo: `nalediym/demo-prompt-blueprint`
- Branch: `platform` (or `main` once you merge)
- Root dir: `demo-prompt-blueprint`

The CLI will open a browser to authorize Firebase's GitHub app against your `nalediym/demo-prompt-blueprint` repo. Grant it.

### 5. Set the Gemini API key as a secret

Get a free key from <https://aistudio.google.com/app/apikey>.

```bash
firebase apphosting:secrets:set GOOGLE_GENERATIVE_AI_API_KEY
# Paste the AIza... key when prompted.
# Say "yes" when it asks to grant the App Hosting backend access.
```

Stored encrypted in Google Secret Manager. Never committed to git.

### 6. First deploy

```bash
firebase apphosting:backends:list          # confirm `trellis` is there
git push origin platform                   # triggers the first build
```

Watch the build:

```bash
firebase apphosting:builds:list --backend trellis
```

In ~3–5 min you'll have a live URL like `https://trellis--job-network-helper.us-central1.hosted.app` (or similar). Firebase will print it when the build completes.

## After first deploy

- Every `git push origin platform` auto-deploys.
- Preview URLs for other branches can be enabled via Firebase console.
- Drop the live URL into `README.md` line 5 (the `<your-firebase-url>` placeholder) + your resume's linux-jr line + your cover letter.

## Monitoring + logs

```bash
firebase apphosting:logs --backend trellis         # tail logs
firebase apphosting:builds:get <build-id>          # inspect a specific build
```

Or in the browser: <https://console.firebase.google.com/project/job-network-helper/apphosting>.

## Rollback

```bash
firebase apphosting:rollouts:rollback --backend trellis
```

Rolls back to the previous successful deploy.

## Cost

- **Hosting**: Spark plan (free) covers 10 GB storage, 360 MB/day egress, unlimited builds. Demo traffic stays well inside this.
- **App Hosting runtime**: 2M requests/month free, then ~$0.40 per million. Scales to zero when idle.
- **Gemini API (AI Studio)**: 1,500 requests/day free. More than enough for demo use.
- **Secrets / Cloud Build / Cloud Logging**: within the free tier.

If traffic ever explodes: upgrade to Blaze (pay-as-you-go). Still cheap — a 100k/month demo is ~$5.

## Troubleshooting

**Build fails on "cannot find module '@ai-sdk/google'"**
- Cause: `npm install` didn't run. Fix: Firebase App Hosting runs `npm ci` automatically, but `package-lock.json` must be committed. Check that the lockfile is in git.

**Build fails on "GOOGLE_GENERATIVE_AI_API_KEY is not defined"**
- Cause: the secret wasn't created or wasn't granted to the backend. Re-run step 5.

**`npm run validate:manifests` fails in CI**
- Cause: a YAML file broke validation. Fix locally, commit, push. The prebuild gate is intentional — bad manifests can't deploy.

**CORS errors from the browser**
- App Hosting serves the whole app from one origin, so CORS shouldn't fire. If you see it, check that you haven't accidentally pointed a client-side fetch at a different host.
