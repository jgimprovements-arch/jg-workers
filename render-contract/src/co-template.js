// AUTO-GENERATED — Change Order Amendment Template
// Matches the contract template branding (navy/orange, same fonts/layout).
// Rendered by the render-contract Cloudflare Worker with CO-specific fields.
// Sig anchors use the same data-sig-role system as the contract template.

export const CO_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JG Restoration — Change Order Amendment</title>
<style>
@page {
  size: Letter;
  margin: 0.75in 0.7in 0.95in 0.7in;
  @bottom-left {
    content: "JG RESTORATION  |  Change Order Amendment";
    font-family: 'Helvetica Neue', 'Arial', sans-serif;
    font-size: 7.5pt;
    color: #6B7280;
    letter-spacing: 0.05em;
    padding-bottom: 4pt;
  }
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-family: 'Helvetica Neue', 'Arial', sans-serif;
    font-size: 7.5pt;
    color: #6B7280;
    padding-bottom: 4pt;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy: #1B2B5C;
  --navy-deep: #0F1A3E;
  --navy-light: #2C4078;
  --orange: #E8743C;
  --orange-soft: #F4A574;
  --slate: #4B5563;
  --slate-light: #6B7280;
  --green: #16A34A;
  --line: #D1D5DB;
}

body {
  font-family: 'Helvetica Neue', 'Arial', sans-serif;
  font-size: 10pt;
  line-height: 1.55;
  color: var(--navy);
}

/* ─── Header Banner ─── */
.co-header {
  background: linear-gradient(135deg, var(--navy-deep) 0%, var(--navy) 55%, var(--navy-light) 100%);
  color: white;
  padding: 28pt 32pt;
  margin: -0.75in -0.7in 24pt -0.7in;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.co-header h1 {
  font-family: 'Georgia', serif;
  font-size: 22pt;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 6pt;
}
.co-header .co-subtitle {
  font-size: 10pt;
  color: var(--orange-soft);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.co-header .co-ref {
  font-size: 9pt;
  color: rgba(255,255,255,0.7);
  margin-top: 8pt;
}

/* ─── Section Headers ─── */
.section-header {
  font-family: 'Helvetica Neue', sans-serif;
  font-size: 10pt;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--navy);
  margin-top: 22pt;
  margin-bottom: 4pt;
  padding-bottom: 4pt;
  border-bottom: 2px solid var(--orange);
}

/* ─── Summary Table ─── */
.summary-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12pt 0 16pt 0;
}
.summary-table th {
  background: var(--navy);
  color: white;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 8pt 12pt;
  text-align: left;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.summary-table th.r { text-align: right; }
.summary-table td {
  padding: 7pt 12pt;
  font-size: 9.5pt;
  border-bottom: 1px solid var(--line);
}
.summary-table td.r { text-align: right; }
.summary-table tr.total-row td {
  font-weight: 700;
  font-size: 10pt;
  border-top: 2px solid var(--navy);
  border-bottom: none;
}

/* ─── Line Items Table ─── */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8pt 0 16pt 0;
  font-size: 8.5pt;
}
.items-table th {
  background: rgba(27,43,92,0.06);
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--slate);
  padding: 6pt 8pt;
  text-align: left;
  border-bottom: 1px solid var(--line);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.items-table th.r { text-align: right; }
.items-table td {
  padding: 5pt 8pt;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  color: var(--slate);
}
.items-table td.r { text-align: right; }
.items-table .new-badge {
  display: inline-block;
  background: var(--green);
  color: white;
  font-size: 6.5pt;
  font-weight: 700;
  padding: 1pt 5pt;
  border-radius: 3pt;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-left: 4pt;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ─── Legal Text ─── */
.legal-text {
  font-size: 9pt;
  line-height: 1.6;
  color: var(--slate);
  margin: 12pt 0;
}

/* ─── Signature Section ─── */
.signature-section {
  margin-top: 30pt;
  page-break-inside: avoid;
}
.signature-prelude {
  background: var(--navy);
  color: white;
  padding: 14pt 18pt;
  font-size: 9.5pt;
  line-height: 1.55;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  margin-bottom: 20pt;
  border-radius: 2px;
}
.signature-prelude strong {
  color: var(--orange-soft);
  letter-spacing: 0.02em;
}
.sig-block {
  margin-top: 20pt;
  page-break-inside: avoid;
}
.sig-block-label {
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--orange);
  margin-bottom: 10pt;
}
.sig-block-name {
  font-family: 'Georgia', serif;
  font-size: 11pt;
  color: var(--navy);
  font-weight: 700;
  margin-bottom: 14pt;
}
.sig-row {
  display: flex;
  gap: 24pt;
  margin-bottom: 12pt;
}
.sig-field { flex: 1; }
.sig-field.narrow { flex: 0.5; }
.sig-field-line {
  border-bottom: 1px solid var(--navy);
  height: 22pt;
}
.sig-field-label {
  font-size: 7.5pt;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--slate-light);
  margin-top: 3pt;
}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════════
     HEADER
     ═══════════════════════════════════════════════════════════════════════ -->
<div class="co-header">
  <div class="co-subtitle">Change Order Amendment</div>
  <h1 id="co_title">Change Order #1</h1>
  <div class="co-ref">
    <span id="co_project_ref">Project Reference</span>
    &nbsp;&bull;&nbsp;
    <span id="co_date">Date</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════
     PARTIES & PROJECT REFERENCE
     ═══════════════════════════════════════════════════════════════════════ -->
<h2 class="section-header">Amendment to Contract</h2>
<div class="legal-text">
  This Change Order Amendment ("<strong>CO</strong>") is entered into as an amendment to the
  Residential Home Improvement Contract ("<strong>Original Contract</strong>") dated
  <strong id="co_original_contract_date">___</strong> between
  <strong>J.J. Greil Enterprises, LLC d/b/a JG Restoration</strong> ("Contractor") and
  <strong id="co_owner_name">___</strong> ("Owner") for the project located at
  <strong id="co_project_address">___</strong>.
</div>
<div class="legal-text">
  The parties agree to modify the scope of work and contract price as described below.
  All other terms and conditions of the Original Contract remain in full force and effect.
</div>

<!-- ═══════════════════════════════════════════════════════════════════════
     FINANCIAL SUMMARY
     ═══════════════════════════════════════════════════════════════════════ -->
<h2 class="section-header">Financial Summary</h2>
<table class="summary-table">
  <thead>
    <tr>
      <th>Description</th>
      <th class="r">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Original Contract Price</td>
      <td class="r" id="co_original_total">$0.00</td>
    </tr>
    <tr>
      <td>This Change Order (<span id="co_delta_label">CO #1</span>)</td>
      <td class="r" style="color:var(--green);font-weight:700;" id="co_delta_amount">+$0.00</td>
    </tr>
    <tr class="total-row">
      <td>New Contract Price</td>
      <td class="r" id="co_new_total">$0.00</td>
    </tr>
  </tbody>
</table>

<!-- ═══════════════════════════════════════════════════════════════════════
     SCOPE OF CHANGES
     ═══════════════════════════════════════════════════════════════════════ -->
<h2 class="section-header">Scope of Changes</h2>
<div class="legal-text">
  The following items are added to or modified from the Original Contract scope of work,
  as detailed in the attached Xactimate supplement estimate:
</div>
<table class="items-table">
  <thead>
    <tr>
      <th>Description</th>
      <th>Trade</th>
      <th class="r">Original</th>
      <th class="r">New</th>
      <th class="r">Delta</th>
    </tr>
  </thead>
  <tbody id="co_line_items_body">
    <!-- Populated by worker -->
  </tbody>
</table>

<!-- ═══════════════════════════════════════════════════════════════════════
     TERMS
     ═══════════════════════════════════════════════════════════════════════ -->
<h2 class="section-header">Terms</h2>
<div class="legal-text">
  1. <strong>Scope.</strong> The scope of work under the Original Contract is hereby amended
  to include the items described above. The attached Xactimate supplement estimate is
  incorporated by reference as part of this Change Order.<br><br>

  2. <strong>Price.</strong> The contract price is adjusted as shown in the Financial Summary
  above. Payment for this Change Order shall be due in accordance with the payment schedule
  established in the Original Contract and Schedule of Values, as amended.<br><br>

  3. <strong>Schedule.</strong> The completion date under the Original Contract
  <span id="co_schedule_impact">may be extended as reasonably necessary to accommodate the
  additional scope of work described herein</span>.<br><br>

  4. <strong>All Other Terms.</strong> Except as expressly modified by this Change Order,
  all terms, conditions, warranties, and obligations of the Original Contract remain
  unchanged and in full force and effect.
</div>

<!-- ═══════════════════════════════════════════════════════════════════════
     SIGNATURES
     ═══════════════════════════════════════════════════════════════════════ -->
<div class="signature-section">
  <div class="signature-prelude">
    <strong>By signing below,</strong> both parties acknowledge and agree to the changes
    described in this Change Order Amendment, including the adjusted scope of work and
    revised contract price.
  </div>

  <!-- Contractor -->
  <div class="sig-block">
    <div class="sig-block-label">Contractor</div>
    <div class="sig-block-name">J.J. Greil Enterprises, LLC <em>d/b/a</em> JG Restoration</div>
    <div class="sig-row">
      <div class="sig-field" style="flex:2;" data-sig-role="contractor">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">By &mdash; Authorized Signature</div>
      </div>
      <div class="sig-field narrow" data-sig-role="date">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">Date</div>
      </div>
    </div>
  </div>

  <!-- Owner -->
  <div class="sig-block">
    <div class="sig-block-label">Owner</div>
    <div class="sig-row">
      <div class="sig-field" style="flex:2;" data-sig-role="customer">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">Signature</div>
      </div>
      <div class="sig-field">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">Printed Name</div>
      </div>
      <div class="sig-field narrow" data-sig-role="date">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">Date</div>
      </div>
    </div>
  </div>

  <!-- Owner (if joint) -->
  <div class="sig-block">
    <div class="sig-block-label">Owner (if joint)</div>
    <div class="sig-row">
      <div class="sig-field" style="flex:2;" data-sig-role="customer-joint">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">Signature</div>
      </div>
      <div class="sig-field">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">Printed Name</div>
      </div>
      <div class="sig-field narrow" data-sig-role="date">
        <div class="sig-field-line"></div>
        <div class="sig-field-label">Date</div>
      </div>
    </div>
  </div>
</div>

</body>
</html>`;
