#!/usr/bin/env bash
# Non-interactive Firebase App Hosting deploy for Trellis.
# Everything in firebase.json + .firebaserc is treated as source of truth.
#
# Usage (first time):
#   firebase login                                   # opens browser, one-time
#   # open https://console.firebase.google.com/ → Add project → existing GCP project → trellis-nalediym
#   # (one-time: links Firebase + authorizes Firebase's GitHub app against nalediym/trellis)
#   export GEMINI_API_KEY=AIza...                    # from https://aistudio.google.com/app/apikey
#   bash scripts/deploy.sh
#
# Every subsequent deploy:
#   git push origin main                             # App Hosting watches main, auto-builds + rolls out.
#
# This script drives `firebase apphosting:backends:create` non-interactively
# for the first setup, then creates the secret, then kicks a manual rollout
# (useful if you don't want to wait for the auto-trigger from push).

set -euo pipefail

# Read the default project from .firebaserc (single source of truth).
PROJECT="$(python3 -c "import json;print(json.load(open('.firebaserc'))['projects']['default'])" 2>/dev/null || echo trellis-4e361)"
BACKEND=trellis
REGION=us-central1

# --- sanity ---------------------------------------------------------------

if ! command -v firebase >/dev/null 2>&1; then
  echo "ERROR: firebase CLI not installed. Run 'npm install -g firebase-tools'." >&2
  exit 1
fi

if ! firebase projects:list 2>/dev/null | grep -q "$PROJECT"; then
  cat >&2 <<EOF
ERROR: firebase can't see project '$PROJECT'.

Likely causes:
  1. You're not logged in yet.    Fix: firebase login
  2. $PROJECT hasn't been promoted to a Firebase project yet.
     Fix: open https://console.firebase.google.com/ → Add project →
          "Add Firebase to an existing Google Cloud project" → pick
          $PROJECT → skip analytics.
EOF
  exit 1
fi

# --- create backend (idempotent: skips if it already exists) --------------

echo "==> Checking App Hosting backend '$BACKEND' in $PROJECT/$REGION..."
if firebase apphosting:backends:list --project="$PROJECT" 2>/dev/null | grep -q "$BACKEND"; then
  echo "    ✓ backend exists, skipping create"
else
  echo "    creating backend..."
  firebase apphosting:backends:create \
    --project="$PROJECT" \
    --backend="$BACKEND" \
    --primary-region="$REGION" \
    --root-dir=/ \
    --non-interactive

  # Note: this creates the backend metadata but doesn't link a GitHub repo.
  # The GitHub link is done via `firebase init apphosting` in the CLI, or
  # through the console at:
  #   https://console.firebase.google.com/project/$PROJECT/apphosting
  # — that's the one remaining manual step. After linking, every push to
  # the configured branch auto-deploys.
  echo
  echo "    ⚠ Backend created. Now LINK YOUR GITHUB REPO to this backend:"
  echo "      https://console.firebase.google.com/project/$PROJECT/apphosting"
  echo "      → click the backend → 'Connect a GitHub repository' →"
  echo "        pick nalediym/trellis, branch main, root /"
  echo
  echo "    (Or: run 'firebase init apphosting' — it'll pick up this config"
  echo "     and only ask you to authorize the GitHub connection.)"
fi

# --- secret ---------------------------------------------------------------

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  cat <<EOF

==> Gemini API key not set in GEMINI_API_KEY env var.

Get a free key (pick project '$PROJECT' when prompted):
  https://aistudio.google.com/app/apikey

Then re-run this script with:
  export GEMINI_API_KEY=AIza...
  bash scripts/deploy.sh

Or set the secret interactively right now (it'll prompt for the value):
  firebase apphosting:secrets:set GOOGLE_GENERATIVE_AI_API_KEY --project=$PROJECT
EOF
  exit 0
fi

echo "==> Storing Gemini key in Secret Manager as GOOGLE_GENERATIVE_AI_API_KEY..."
printf '%s' "$GEMINI_API_KEY" | firebase apphosting:secrets:set GOOGLE_GENERATIVE_AI_API_KEY \
  --project="$PROJECT" \
  --data-file=- \
  --force >/dev/null

echo "    granting backend '$BACKEND' access..."
firebase apphosting:secrets:grantaccess GOOGLE_GENERATIVE_AI_API_KEY \
  --project="$PROJECT" \
  --backend="$BACKEND" >/dev/null 2>&1 || true

# --- kick a rollout if GitHub is linked -----------------------------------

echo
echo "==> Done. Next:"
echo "    - If you haven't linked GitHub yet, do so in the console (link above)."
echo "    - Push to main to auto-deploy:  git push origin main"
echo "    - Or trigger a manual rollout:  firebase apphosting:rollouts:create $BACKEND --project=$PROJECT"
echo "    - Watch builds:                  firebase apphosting:builds:list --project=$PROJECT --backend=$BACKEND"
