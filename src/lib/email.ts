/**
 * High-risk / confirmed counterfeit alert emails.
 * Uses Resend (free tier is enough for alerts).
 * Set RESEND_API_KEY in env. If missing, alerts are logged to console only.
 */

type AlertPayload = {
  storeName: string;
  storeTown: string;
  storeProvince: string;
  assessmentId: string;
  risk: string;
  notes?: string | null;
  agentName?: string | null;
  visitDate?: string | null;
};

export async function sendHighRiskAlert(payload: AlertPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO || process.env.SEED_ADMIN_EMAIL;
  const from = process.env.ALERT_EMAIL_FROM || "Real Makoya Alerts <onboarding@resend.dev>";

  const subject = `[Real Makoya] ${payload.risk} risk — ${payload.storeName}`;
  const body = `
A field assessment has been flagged with elevated counterfeit risk.

Store: ${payload.storeName}
Location: ${payload.storeTown}, ${payload.storeProvince}
Risk: ${payload.risk}
Visit date: ${payload.visitDate || "—"}
Agent: ${payload.agentName || "—"}
Notes: ${payload.notes || "—"}

Assessment ID: ${payload.assessmentId}

Please review and approve (or flag) in the agency dashboard before this data appears in any client report.
`.trim();

  if (!apiKey || !to) {
    console.warn("[email] RESEND_API_KEY or ALERT_EMAIL_TO not set — logging alert instead");
    console.warn(subject, body);
    return { ok: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[email] Resend error", res.status, errText);
      return { ok: false, reason: errText };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { ok: false, reason: String(err) };
  }
}
