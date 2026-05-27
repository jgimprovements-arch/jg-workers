// jg-workers/render-contract/src/draw-request-template.js
// ═══════════════════════════════════════════════════════════════════════════
// Progress Draw Request — HTML template
// Rendered by the same Cloudflare Worker that serves /render-contract and
// the CO endpoint. The /render-draw-request route POSTs JSON, this template
// returns HTML, and the worker passes it to the PDF generator (Puppeteer-style
// or html-pdf service) — identical pattern to co-template.js.
//
// Payload shape (from rebuild-sov.js openRequestDrawModal):
// {
//   type: 'draw_request',
//   draw: { id, draw_num, trigger_event, percent, total_amount, requested_at, note },
//   sov:  { contract_total, paid_to_date, balance_remaining, draw_count },
//   project: { id, albi_job_number, customer_name, customer_email, property_address,
//              pm_name, pm_email, pm_phone },
//   all_draws: [{ draw_num, trigger_event, amount, status }, ...]
// }
// ═══════════════════════════════════════════════════════════════════════════

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const usd = (n) => '$' + Number(n || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const drawStatusBadge = (status) => {
  const map = {
    pending:   { lbl: 'Upcoming',    bg: '#e2e8f0', fg: '#475569' },
    requested: { lbl: 'Requested',   bg: '#fde68a', fg: '#92400e' },
    partial:   { lbl: 'Partial',     bg: '#fde68a', fg: '#92400e' },
    paid:      { lbl: 'Paid',        bg: '#bbf7d0', fg: '#166534' },
    waived:    { lbl: 'Waived',      bg: '#e2e8f0', fg: '#475569' },
    locked:    { lbl: 'Locked',      bg: '#e2e8f0', fg: '#475569' },
  };
  const m = map[status] || map.pending;
  return `<span style="background:${m.bg};color:${m.fg};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;">${m.lbl}</span>`;
};

export function renderDrawRequestHTML(payload) {
  const { draw = {}, sov = {}, project = {}, all_draws = [] } = payload || {};
  const today = fmtDate(draw.requested_at || new Date().toISOString());

  const drawRowsHtml = all_draws.map(d => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-weight:${d.draw_num === draw.draw_num ? '700' : '400'};">${d.draw_num}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-weight:${d.draw_num === draw.draw_num ? '700' : '400'};">${esc(d.trigger_event || '')}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:${d.draw_num === draw.draw_num ? '700' : '400'};">${usd(d.amount)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${drawStatusBadge(d.status)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Progress Draw Request — Draw #${esc(draw.draw_num)}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.5; margin: 0; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a5c; padding-bottom: 14px; margin-bottom: 22px; }
  .logo-block { font-size: 24pt; font-weight: 700; color: #1e3a5c; letter-spacing: -0.5px; }
  .logo-sub { font-size: 9pt; color: #64748b; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 16pt; margin: 0; color: #1e3a5c; }
  .doc-title .doc-num { font-size: 10pt; color: #64748b; margin-top: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px; }
  .meta-block { background: #f8fafc; padding: 12px 14px; border-radius: 6px; border-left: 3px solid #1e3a5c; }
  .meta-label { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 4px; }
  .meta-value { font-size: 11pt; color: #0f172a; }
  .meta-value b { color: #0f172a; }
  .highlight-box { background: #fff8e7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin: 18px 0; }
  .highlight-box .amount-label { font-size: 10pt; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
  .highlight-box .amount-value { font-size: 28pt; color: #92400e; font-weight: 700; line-height: 1; margin: 4px 0; }
  .highlight-box .amount-desc { font-size: 10pt; color: #475569; }
  .section-title { font-size: 12pt; color: #1e3a5c; font-weight: 700; margin: 18px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; }
  table.draws { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.draws thead th { background: #1e3a5c; color: #fff; text-align: left; padding: 8px 6px; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.03em; }
  table.draws thead th.right { text-align: right; }
  table.draws thead th.center { text-align: center; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #1e3a5c; margin-top: 8px; font-weight: 700; font-size: 11pt; }
  .note-box { background: #f8fafc; border-left: 3px solid #f59e0b; padding: 12px 14px; margin: 16px 0; font-style: italic; font-size: 10pt; color: #475569; }
  .instructions { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 14px 16px; margin: 16px 0; font-size: 10pt; }
  .instructions h3 { margin: 0 0 6px; color: #0c4a6e; font-size: 11pt; }
  .instructions ol { margin: 0; padding-left: 20px; color: #075985; }
  .instructions li { margin: 3px 0; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
  .sig-block { border-top: 1px solid #0f172a; padding-top: 6px; font-size: 9pt; color: #475569; }
  .sig-block .sig-label { font-weight: 600; color: #0f172a; margin-bottom: 18px; font-size: 10pt; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #64748b; text-align: center; }
</style>
</head>
<body>

  <div class="header">
    <div>
      <div class="logo-block">JG RESTORATION</div>
      <div class="logo-sub">
        1720 N Silverspring Dr, Appleton, WI · 2230 Church St, Stevens Point, WI<br>
        (920) 428-4200 · jg-restoration.com
      </div>
    </div>
    <div class="doc-title">
      <h1>Progress Draw Request</h1>
      <div class="doc-num">Draw #${esc(draw.draw_num)} of ${esc(sov.draw_count || '—')}</div>
      <div class="doc-num">${today}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-block">
      <div class="meta-label">Customer</div>
      <div class="meta-value"><b>${esc(project.customer_name || '')}</b></div>
      <div class="meta-value" style="font-size:10pt;color:#475569;margin-top:2px;">${esc(project.property_address || '')}</div>
      ${project.customer_email ? `<div class="meta-value" style="font-size:9pt;color:#64748b;margin-top:2px;">${esc(project.customer_email)}</div>` : ''}
    </div>
    <div class="meta-block">
      <div class="meta-label">Project</div>
      <div class="meta-value"><b>${esc(project.albi_job_number || '—')}</b></div>
      ${project.pm_name ? `<div class="meta-value" style="font-size:10pt;color:#475569;margin-top:2px;">PM: ${esc(project.pm_name)}</div>` : ''}
      ${project.pm_email ? `<div class="meta-value" style="font-size:9pt;color:#64748b;margin-top:2px;">${esc(project.pm_email)}${project.pm_phone ? ' · ' + esc(project.pm_phone) : ''}</div>` : ''}
    </div>
  </div>

  <div class="highlight-box">
    <div class="amount-label">Draw Amount Requested</div>
    <div class="amount-value">${usd(draw.total_amount)}</div>
    <div class="amount-desc">
      <b>Draw #${esc(draw.draw_num)}</b>${draw.trigger_event ? ' · ' + esc(draw.trigger_event) : ''}
      ${draw.percent ? ` · ${(Number(draw.percent) * 100).toFixed(1)}% of contract` : ''}
    </div>
  </div>

  ${draw.note ? `<div class="note-box"><b>From your project manager:</b> ${esc(draw.note)}</div>` : ''}

  <div class="section-title">Contract Summary</div>
  <table style="width:100%;font-size:10pt;">
    <tr>
      <td style="padding:5px 0;color:#475569;">Total Contract Value</td>
      <td style="padding:5px 0;text-align:right;font-weight:600;">${usd(sov.contract_total)}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;color:#475569;">Paid to Date</td>
      <td style="padding:5px 0;text-align:right;font-weight:600;color:#16a34a;">${usd(sov.paid_to_date)}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;color:#475569;">This Draw Request</td>
      <td style="padding:5px 0;text-align:right;font-weight:600;color:#d97706;">${usd(draw.total_amount)}</td>
    </tr>
    <tr style="border-top:2px solid #1e3a5c;">
      <td style="padding:8px 0;font-weight:700;">Balance Remaining After This Draw</td>
      <td style="padding:8px 0;text-align:right;font-weight:700;font-size:11pt;">${usd(sov.balance_remaining)}</td>
    </tr>
  </table>

  <div class="section-title">Full Draw Schedule</div>
  <table class="draws">
    <thead>
      <tr>
        <th style="width:50px;">#</th>
        <th>Trigger Event</th>
        <th class="right" style="width:120px;">Amount</th>
        <th class="center" style="width:100px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${drawRowsHtml}
    </tbody>
  </table>

  <div class="instructions">
    <h3>Instructions for Bank / Lender</h3>
    <ol>
      <li>This Progress Draw Request authorizes disbursement of the amount shown above.</li>
      <li>The trigger milestone for this draw has been completed by JG Restoration.</li>
      <li>The borrower (homeowner) signs below to authorize this draw release.</li>
      <li>Funds are payable to <b>JJ Greil Enterprises LLC dba JG Restoration</b>.</li>
      <li>Return the signed form to the borrower so they can upload it back to JG Restoration via the project portal.</li>
    </ol>
  </div>

  <div class="signature-grid">
    <div class="sig-block">
      <div class="sig-label">Borrower / Homeowner</div>
      <div>Signature: __________________________________</div>
      <div style="margin-top:14px;">Print Name: ${esc(project.customer_name || '')}</div>
      <div style="margin-top:14px;">Date: __________________________</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Bank / Lender Authorized Signer</div>
      <div>Signature: __________________________________</div>
      <div style="margin-top:14px;">Print Name: __________________________</div>
      <div style="margin-top:14px;">Date: __________________________</div>
    </div>
  </div>

  <div class="footer">
    JJ Greil Enterprises LLC dba JG Restoration · Fire · Water · Mold · Reconstruction<br>
    Questions? Call (920) 428-4200 or email ${esc(project.pm_email || 'office@jg-restoration.com')}
  </div>

</body>
</html>`;
}
