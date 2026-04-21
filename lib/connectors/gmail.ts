/**
 * Gmail connector — MOCKED.
 *
 * Real production code path would go through the OAuth2 scopes declared
 * in `platform/connectors/gmail.yaml`. Here we stub the `draftMessage`
 * function so the flagship skill can "prepare to deliver" without
 * actually hitting Google. The manifest is still the source of truth for
 * what scopes WOULD be requested.
 *
 * Every call is logged via the audit layer so a visitor sees that a
 * draft would have been created.
 */
export interface GmailDraftRequest {
  to: string;
  subject: string;
  body: string;
}

export interface GmailDraftResponse {
  draftId: string;
  status: "mocked";
  preview: {
    to: string;
    subject: string;
    preview_body: string;
  };
}

/**
 * Prepare a mock Gmail draft. Does not send. Never hits the network.
 * Returns a deterministic-ish ID so the UI can display it consistently.
 */
export function draftMessage(
  req: GmailDraftRequest,
): GmailDraftResponse {
  const stamp = Date.now().toString(36);
  const draftId = `mock-gmail-draft-${stamp}`;
  return {
    draftId,
    status: "mocked",
    preview: {
      to: req.to,
      subject: req.subject,
      preview_body:
        req.body.length > 280 ? req.body.slice(0, 277) + "..." : req.body,
    },
  };
}

/** Status reported by the /connectors UI. */
export function gmailStatus(): {
  status: "mocked";
  lastUsedAt: string | null;
} {
  return {
    status: "mocked",
    lastUsedAt: lastCallAt,
  };
}

let lastCallAt: string | null = null;

export function markGmailUsed(): void {
  lastCallAt = new Date().toISOString();
}
