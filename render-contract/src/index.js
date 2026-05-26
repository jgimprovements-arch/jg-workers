// render-contract/src/index.js
// Cloudflare Worker — generates a JG Restoration contract PDF from the
// attorney-reviewed HTML template by injecting customer data, project
// details, financial summary, and draw schedule via headless Chrome
// (Cloudflare Browser Rendering).
//
// Replaces the broken Vercel /api/render-contract endpoint.
//
// All shared utilities are inlined to keep this folder self-contained for
// Cloudflare's monorepo deployment pattern (Git → root_dir = render-contract).

import puppeteer from '@cloudflare/puppeteer';
import { CONTRACT_TEMPLATE_HTML } from './template.js';

// ─── CORS (inlined) ──────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://jgimprovements-arch.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function preflight(request) {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

// ─── Supabase REST helper (inlined) ──────────────────────────────────────
async function uploadPdfToStorage(env, path, bytes) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const uploadUrl = `${env.SUPABASE_URL}/storage/v1/object/rebuild-documents/${path}`;
  const r = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Storage upload failed (${r.status}): ${txt}`);
  }
  return `${env.SUPABASE_URL}/storage/v1/object/public/rebuild-documents/${path}`;
}

// ─── Field IDs the template exposes ──────────────────────────────────────
// Must match JG_Contract_Template.html exactly. If the template adds/removes
// fields, update this list.
const FIELD_IDS = [
  'cover_owner_name', 'cover_project_site', 'cover_contract_date', 'cover_project_ref',
  'owner_name', 'owner_address', 'owner_phone', 'owner_email',
  'contract_price', 'sales_rep_name',
  'project_site_addr_1', 'project_site_addr_2',
  'commencement_date', 'completion_date',
  'cancellation_contract_date', 'guaranty_contract_date', 'guaranty_project_site',
  'other_incorporated_docs',
  'sov_project_ref', 'sov_contract_price', 'sov_source_estimate', 'sov_version_date',
  'sov_subtotal', 'sov_tax', 'sov_overhead', 'sov_profit', 'sov_exclusions',
];

// ─── JG (Contractor) signature ──────────────────────────────────────────
// Pre-baked PNG data URL of Josh Greil's signature, rendered once from
// sign.html's jgDrawSignature() (Alex Brush font, baseline-aligned) and
// captured via canvas.toDataURL('image/png').
//
// Pre-baking the contractor sig as a PNG (instead of injecting Alex Brush
// font + text into the Worker's headless Chrome) gives us pixel-identical
// output across every contract — no font-rendering variance between
// environments. For M&A diligence: every signed contract you've ever
// generated has the same JG signature pixels. Defensible.
//
// To regenerate (e.g., new authorized signer): open sign.html in any
// browser, run in the console:
//   const c = document.createElement('canvas'); c.width=400; c.height=120;
//   const ctx = c.getContext('2d'); ctx.fillStyle='#000';
//   const { jsPDF } = window.jspdf; const tmp = new jsPDF();
//   jgDrawSignature(tmp, 0, 0, 48);   // jsPDF path — see sign.html
//   // OR direct canvas: ctx.font = "48px 'Alex Brush'"; ctx.fillText('Josh Greil', 10, 80);
//   console.log(c.toDataURL('image/png'));
// Paste the data:image/png;base64,... output below.
const JG_SIG_DATA_URL = 'data:image/png;base64,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';

export default {
  async fetch(request, env, ctx) {
    const pre = preflight(request);
    if (pre) return pre;

    if (request.method !== 'POST') {
      return jsonResponse(request, { ok: false, error: 'POST only' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse(request, { ok: false, error: 'Invalid JSON body' }, 400);
    }

    const { packet_id, project_id, fields, draws, xact_items, signatures } = body || {};
    if (!packet_id || !project_id) {
      return jsonResponse(request, { ok: false, error: 'packet_id and project_id required' }, 400);
    }
    if (!fields || typeof fields !== 'object') {
      return jsonResponse(request, { ok: false, error: 'fields object required' }, 400);
    }
    if (!Array.isArray(draws)) {
      return jsonResponse(request, { ok: false, error: 'draws array required' }, 400);
    }
    // xact_items is optional — if absent or empty, the SOV phase table is
    // hidden rather than rendered with empty rows.
    const xactItems = Array.isArray(xact_items) ? xact_items : [];

    // signatures is optional. If absent → pre-sign render (unsigned contract,
    // sent to customer). If present → post-sign render (fully executed
    // contract, JG + customer sigs embedded as page content).
    //
    // Shape: {
    //   customer_name:        string,    // printed name to stamp under sig
    //   customer_sig_data_url: string,    // 'data:image/png;base64,...'
    //   customer_joint_name:  string?,   // optional joint signer printed name
    //   customer_joint_sig_data_url: string?,  // optional joint sig PNG
    //   guarantor_name:       string?,   // optional Exhibit G guarantor name
    //   guarantor_sig_data_url: string?, // optional Exhibit G guarantor sig PNG
    //   signed_at:            string,    // ISO timestamp, stamped under sig
    // }
    //
    // Roles handled by the DOM walker:
    //   contractor       → JG_SIG_DATA_URL (always stamped, baked into Worker)
    //   customer         → signatures.customer_sig_data_url
    //   customer-joint   → signatures.customer_joint_sig_data_url (skipped if absent)
    //   customer-guarantor → signatures.guarantor_sig_data_url (skipped if absent)
    //   leave-blank      → never stamped (cancellation/optional forms)
    const sigs = (signatures && typeof signatures === 'object') ? signatures : null;
    if (sigs && !sigs.customer_sig_data_url) {
      return jsonResponse(request, { ok: false, error: 'signatures.customer_sig_data_url required when signatures provided' }, 400);
    }
    if (sigs && !JG_SIG_DATA_URL) {
      // Fail fast — won't deploy if the contractor sig wasn't baked in.
      return jsonResponse(request, { ok: false, error: 'JG_SIG_DATA_URL not configured in Worker' }, 500);
    }
    if (!env.BROWSER) {
      return jsonResponse(request, { ok: false, error: 'BROWSER binding not configured' }, 500);
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(request, { ok: false, error: 'Supabase env vars missing' }, 500);
    }

    let browser;
    try {
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      // Load template HTML directly — fonts are all system fonts
      // (Georgia, Helvetica Neue, Times, Arial), no external network calls.
      await page.setContent(CONTRACT_TEMPLATE_HTML, { waitUntil: 'load' });

      // Inject fields + draws table + Xact line items in page context.
      await page.evaluate(({ fields, draws, fieldIds, xactItems, sigs, jgSig }) => {
        // 1) Field text injection.
        for (const id of fieldIds) {
          const el = document.getElementById(id);
          if (!el) continue;
          const value = fields[id];
          el.textContent = (value === null || value === undefined) ? '' : String(value);
        }

        // 2) Draw schedule table.
        const tbody = document.getElementById('draw_table_body');
        if (tbody && Array.isArray(draws)) {
          tbody.innerHTML = '';
          for (const d of draws) {
            const tr = document.createElement('tr');
            const cells = [
              d.num     !== undefined ? String(d.num)     : '',
              d.pct     !== undefined ? String(d.pct)     : '',
              d.amount  !== undefined ? String(d.amount)  : '',
              d.trigger !== undefined ? String(d.trigger) : '',
            ];
            for (const c of cells) {
              const td = document.createElement('td');
              td.textContent = c;
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
        }

        // 3) SOV phase table — group xact items by trade_category, render
        //    a phase header row then a line per item with running totals.
        const phaseBody = document.getElementById('sov_phase_table_body');
        if (phaseBody) {
          if (!xactItems.length) {
            // No Xact items — collapse the section by hiding its surrounding
            // structure. We hide the closest <table> ancestor to also drop
            // the "Schedule of Values by Trade" header treatment.
            const parentTable = phaseBody.closest('table');
            if (parentTable) parentTable.style.display = 'none';
          } else {
            // Group by trade_category, preserving insertion order of trades.
            const groups = new Map();
            for (const it of xactItems) {
              const key = (it.trade_category || 'general').toString();
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push(it);
            }

            // Format helpers (page-context safe — no module imports).
            const usd = (n) => {
              const v = Number(n) || 0;
              return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            };
            const titleCase = (s) => s
              .replace(/_/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());

            phaseBody.innerHTML = '';
            let phaseNum = 1;
            for (const [trade, items] of groups) {
              // Phase header row (4-col colspan, formatted like the template's
              // original PHASE 1/2/3 rows).
              const headerTr = document.createElement('tr');
              const headerTd = document.createElement('td');
              headerTd.colSpan = 4;
              headerTd.className = 'sov-phase-row';
              const tradeTotal = items.reduce((s, it) => s + (Number(it.line_total) || 0), 0);
              headerTd.textContent =
                `PHASE ${phaseNum} — ${titleCase(trade).toUpperCase()}  (${usd(tradeTotal)})`;
              headerTr.appendChild(headerTd);
              phaseBody.appendChild(headerTr);

              // Item rows.
              for (const it of items) {
                const tr = document.createElement('tr');
                const num = document.createElement('td');
                num.textContent = '';                 // line number column — left blank for now
                const div = document.createElement('td');
                div.textContent = titleCase(trade);
                const desc = document.createElement('td');
                // Include room/section when present for clarity.
                const ctx = [it.room, it.section].filter(Boolean).join(' / ');
                desc.textContent = ctx
                  ? `${it.description} — ${ctx}`
                  : (it.description || '');
                const val = document.createElement('td');
                val.className = 'num';
                val.style.textAlign = 'right';
                val.textContent = usd(it.line_total || 0);
                tr.appendChild(num);
                tr.appendChild(div);
                tr.appendChild(desc);
                tr.appendChild(val);
                phaseBody.appendChild(tr);
              }
              phaseNum += 1;
            }
          }
        }

        // 4) Signature stamping (DOM-injected for pixel-identical output
        //    across renders). When sigs is null this block is a no-op — the
        //    unsigned pre-send render leaves every sig-field-line blank.
        //
        //    Strategy: replace each tagged sig-field's internal markup with
        //    an <img> of the sig PNG sitting just above the existing
        //    underline+label. Image is sized to span the underline width
        //    (~180px target, scales down for narrow fields). Below the image
        //    we add the printed name + signed date for legal completeness.
        //
        //    For 'leave-blank' role: skip entirely (cancellation forms).
        //    For 'customer-joint'/'customer-guarantor': skip if no data URL.
        if (sigs) {
          const stampSig = (el, sigDataUrl, printedName, signedAt) => {
            // Find the underline div and label inside the tagged sig-field.
            const line = el.querySelector('.sig-field-line');
            const label = el.querySelector('.sig-field-label');
            if (!line || !label) return;

            // Insert <img> above the underline. Inline styles only — avoids
            // depending on additional CSS in the template. marginBottom uses
            // a larger negative value so the sig sits ON the line (visually
            // consistent with stampDate, which puts text right on the line)
            // rather than floating above with a gap.
            const img = document.createElement('img');
            img.src = sigDataUrl;
            img.style.display = 'block';
            img.style.maxHeight = '32pt';
            img.style.maxWidth = '100%';
            img.style.objectFit = 'contain';
            img.style.objectPosition = 'left bottom';
            img.style.marginBottom = '-24pt';  // pull sig down onto the line
            line.parentNode.insertBefore(img, line);

            // Replace the label with printed name + date (smaller, on two lines).
            // This gives diligence reviewers the printed name without needing
            // to inspect canvas pixels.
            if (printedName || signedAt) {
              label.innerHTML = '';
              if (printedName) {
                const nameSpan = document.createElement('span');
                nameSpan.textContent = printedName;
                nameSpan.style.fontWeight = '600';
                label.appendChild(nameSpan);
              }
              if (signedAt) {
                if (printedName) label.appendChild(document.createElement('br'));
                const dateSpan = document.createElement('span');
                dateSpan.textContent = `Signed ${signedAt}`;
                dateSpan.style.fontSize = '7pt';
                dateSpan.style.opacity = '0.7';
                label.appendChild(dateSpan);
              }
            }
          };

          const stampDate = (el, signedAt) => {
            // Insert the signed date as text sitting on the underline. Used
            // for [data-sig-role="date"] anchors which sit next to a signature
            // anchor in every sig-row. signed_at is the same human-readable
            // date used in stampSig (e.g., "May 26, 2026"), so all date fields
            // across the contract show one consistent date.
            const line = el.querySelector('.sig-field-line');
            if (!line || !signedAt) return;
            const dateText = document.createElement('div');
            dateText.textContent = signedAt;
            dateText.style.fontFamily = "'Helvetica Neue', sans-serif";
            dateText.style.fontSize = '10pt';
            dateText.style.fontWeight = '600';
            dateText.style.color = '#0d2d5e';  // navy, matches contract palette
            dateText.style.paddingBottom = '2pt';
            dateText.style.textAlign = 'left';
            line.parentNode.insertBefore(dateText, line);
          };

          const anchors = document.querySelectorAll('[data-sig-role]');
          for (const el of anchors) {
            const role = el.getAttribute('data-sig-role');
            switch (role) {
              case 'contractor':
                stampSig(el, jgSig, 'Joshua J. Greil', sigs.signed_at);
                break;
              case 'customer':
                stampSig(el, sigs.customer_sig_data_url, sigs.customer_name, sigs.signed_at);
                break;
              case 'customer-joint':
                if (sigs.customer_joint_sig_data_url) {
                  stampSig(el, sigs.customer_joint_sig_data_url, sigs.customer_joint_name, sigs.signed_at);
                }
                break;
              case 'customer-guarantor':
                if (sigs.guarantor_sig_data_url) {
                  stampSig(el, sigs.guarantor_sig_data_url, sigs.guarantor_name, sigs.signed_at);
                }
                break;
              case 'date':
                stampDate(el, sigs.signed_at);
                break;
              case 'leave-blank':
                // Intentional no-op. Cancellation/optional forms stay blank.
                break;
              default:
                // Unknown role — log for diligence, do nothing.
                console.warn('Unknown data-sig-role:', role);
            }
          }
        }
      }, { fields, draws, fieldIds: FIELD_IDS, xactItems, sigs, jgSig: JG_SIG_DATA_URL });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,    // cover-page gradient requires this
        preferCSSPageSize: true,  // honor template's @page rules
      });

      // Deterministic storage path. Pre-sign and post-sign renders go to
      // distinct paths so we preserve both for diligence:
      //   contract-{packet_id}.pdf         — unsigned, what we sent
      //   contract-{packet_id}-signed.pdf  — fully executed (JG + customer)
      // Re-issues use new packet_id → new path, never overwrites a sent/
      // locked packet's contract. x-upsert: false in uploadPdfToStorage()
      // would 409 on collision; the suffix prevents that case entirely.
      const suffix = sigs ? '-signed' : '';
      const storagePath = `projects/${project_id}/contracts/contract-${packet_id}${suffix}.pdf`;
      const contract_pdf_url = await uploadPdfToStorage(env, storagePath, pdfBuffer);

      return jsonResponse(request, {
        ok: true,
        contract_pdf_url,
        signed: !!sigs,
        byte_size: pdfBuffer.byteLength,
      });
    } catch (err) {
      console.error('render-contract error:', err.stack || err.message || err);
      return jsonResponse(request, { ok: false, error: err.message || String(err) }, 500);
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) { /* ignore */ }
      }
    }
  },
};
