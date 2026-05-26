import { Resend } from 'resend';

/**
 * Sends a verification email via Resend (HTTP-based, works on Cloudflare Workers/Pages).
 * Requires RESEND_API_KEY in env or process.env.
 */
export async function sendVerificationEmail(
  env: { RESEND_API_KEY?: string; RESEND_FROM?: string; BETTER_AUTH_BASE_URL?: string },
  to: string,
  url: string
): Promise<void> {
  const apiKey = (env.RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim();
  const from = (env.RESEND_FROM || process.env.RESEND_FROM || 'FlareStack <onboarding@resend.dev>').trim();
  const baseUrl = (env.BETTER_AUTH_BASE_URL || process.env.BETTER_AUTH_BASE_URL || '').trim();

  if (!apiKey) {
    throw new Error("Resend API Key is missing.");
  }

  const resend = new Resend(apiKey);
  const logoUrl = `${baseUrl}/assets/icon.png`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Verify your FlareStack account',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 40px 20px;border-bottom:1px solid #f1f5f9;">
              <img src="${logoUrl}" alt="FlareStack" height="36" style="display:block;height:36px;width:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">
                Verify your email address
              </h1>
              <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">
                Click the button below to verify your email and activate your FlareStack account.
                This link expires in 24 hours.
              </p>
              <a href="${url}"
                 style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;
                        padding:14px 28px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.2px;">
                Verify Email Address
              </a>
              <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
                If you didn't create a FlareStack account, you can safely ignore this email.<br />
                Or copy this link: <span style="color:#0f172a;word-break:break-all;">${url}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                FlareStack — Edge-native IP reputation &amp; automated blocking
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
    text: `Verify your FlareStack account\n\nClick this link to verify your email:\n${url}\n\nThis link expires in 24 hours.`,
  });

  if (error) {
    console.error('[FlareStack] Failed to send verification email:', error);
    throw new Error(`Email delivery failed: ${error.message ?? JSON.stringify(error)}`);
  }
}
