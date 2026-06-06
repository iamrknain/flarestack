// ── Shared shell ────────────────────────────────────────────────────────────

function row(label: string, value: string) {
    return `<tr>
      <td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">${label}</td>
      <td style="padding:8px 0;text-align:right;color:#0f172a;font-weight:700;font-size:14px;">${value}</td>
    </tr>`;
}

function emailShell(headerBg: string, title: string, subtitle: string, tableRows: string, note: string) {
    const appUrl = (process.env.NEXTJS_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

    return `<!DOCTYPE html><html>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:0;margin:0;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:0;overflow:hidden;">
    <div style="background:${headerBg};padding:24px 20px;color:#fff;">
      <h2 style="margin:0;font-size:20px;font-weight:800;">${title}</h2>
      <p style="margin:8px 0 0;font-size:14px;opacity:.9;">${subtitle}</p>
    </div>
    <div style="padding:24px 20px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${tableRows}</table>
      <div style="background:#f8fafc;border-radius:0;padding:16px;margin-bottom:24px;font-size:14px;font-weight:500;line-height:1.5;">${note}</div>
      
      <div style="border-top:1px solid #f1f5f9;margin-top:24px;padding-top:16px;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:#475569;font-weight:600;">
          <a href="${appUrl}" target="_blank" style="color:#2563eb;text-decoration:none;">Visit FlareStack Dashboard</a>
        </p>
        <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;line-height:1.4;">
          FlareStack &bull; Real-time Threat Intelligence & Edge Shielding.
        </p>
        <p style="margin:0 0 12px;font-size:10px;color:#cbd5e1;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">
          Developed by Ravi
        </p>
        <p style="margin:0;font-size:10px;color:#94a3b8;">Sent automatically by FlareStack.</p>
      </div>
    </div>
  </div>
</body></html>`;
}

// ── Under Attack Mode templates ────────────────────────────────────────────

export function vercelAttackOnEmail(
    name: string,
    domain: string | null | undefined,
    vercelProjectId: string,
    trafficSource: string,
    total: number,
    threshold: number,
    window: number
) {
    return emailShell(
        "linear-gradient(135deg,#e11d48,#be123c)",
        "Security Alert: Vercel Attack Mode Activated",
        "Project traffic has exceeded security thresholds.",
        row("Project Name", name) +
        row("Domain", domain || "N/A") +
        row("Vercel Project ID", vercelProjectId) +
        row("Traffic Source", trafficSource === "cloudflare" ? "Cloudflare Analytics" : "Direct Log Drain") +
        row("Traffic Window", `${window}s`) +
        row("Current Traffic", `${total.toLocaleString()} reqs`) +
        row("Trigger Limit", `${threshold.toLocaleString()} reqs`),
        "Vercel Attack Mode has been programmatically enabled to protect your application.",
    );
}

export function vercelAttackOffEmail(
    name: string,
    domain: string | null | undefined,
    vercelProjectId: string,
    trafficSource: string,
    total: number,
    threshold: number,
    window: number
) {
    return emailShell(
        "linear-gradient(135deg,#10b981,#047857)",
        "Security Resolved: Vercel Attack Mode Deactivated",
        "Project traffic has returned to normal.",
        row("Project Name", name) +
        row("Domain", domain || "N/A") +
        row("Vercel Project ID", vercelProjectId) +
        row("Traffic Source", trafficSource === "cloudflare" ? "Cloudflare Analytics" : "Direct Log Drain") +
        row("Traffic Window", `${window}s`) +
        row("Current Traffic", `${total.toLocaleString()} reqs`) +
        row("Recovery Limit", `${threshold.toLocaleString()} reqs`),
        "Vercel Attack Mode has been programmatically disabled.",
    );
}

// ── Bot Protection templates ───────────────────────────────────────────────

export function vercelBotProtectionOnEmail(
    name: string,
    domain: string | null | undefined,
    vercelProjectId: string,
    trafficSource: string,
    total: number,
    threshold: number,
    action: string,
    window: number
) {
    return emailShell(
        "linear-gradient(135deg,#f59e0b,#d97706)",
        "Security Alert: Vercel Bot Protection Enabled",
        "Project traffic has exceeded security thresholds.",
        row("Project Name", name) +
        row("Domain", domain || "N/A") +
        row("Vercel Project ID", vercelProjectId) +
        row("Traffic Source", trafficSource === "cloudflare" ? "Cloudflare Analytics" : "Direct Log Drain") +
        row("Traffic Window", `${window}s`) +
        row("Current Traffic", `${total.toLocaleString()} reqs`) +
        row("Trigger Limit", `${threshold.toLocaleString()} reqs`) +
        row("Mitigation Action", action),
        `Vercel Bot Protection has been programmatically enabled with action: <strong>${action}</strong>.`,
    );
}

export function vercelBotProtectionOffEmail(
    name: string,
    domain: string | null | undefined,
    vercelProjectId: string,
    trafficSource: string,
    total: number,
    threshold: number,
    window: number
) {
    return emailShell(
        "linear-gradient(135deg,#10b981,#047857)",
        "Security Resolved: Bot Protection Deactivated",
        "Project traffic has returned to normal.",
        row("Project Name", name) +
        row("Domain", domain || "N/A") +
        row("Vercel Project ID", vercelProjectId) +
        row("Traffic Source", trafficSource === "cloudflare" ? "Cloudflare Analytics" : "Direct Log Drain") +
        row("Traffic Window", `${window}s`) +
        row("Current Traffic", `${total.toLocaleString()} reqs`) +
        row("Recovery Limit", `${threshold.toLocaleString()} reqs`),
        "Vercel Bot Protection has been programmatically disabled.",
    );
}
