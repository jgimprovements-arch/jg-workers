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
  // Exhibit A — Scope of Work wrapper. Phase table removed; we now reference
  // the attached Xactimate by name. Overhead/Profit fields removed too since
  // they were always 0 for stripped-down Xact exports anyway.
  'sov_project_ref', 'sov_contract_price', 'sov_source_estimate',
  'sov_source_estimate_ref',  // mirror of sov_source_estimate, used in callout
  'sov_version_date',
  'sov_subtotal', 'sov_tax', 'sov_exclusions',
];

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

    const { packet_id, project_id, fields, draws } = body || {};
    if (!packet_id || !project_id) {
      return jsonResponse(request, { ok: false, error: 'packet_id and project_id required' }, 400);
    }
    if (!fields || typeof fields !== 'object') {
      return jsonResponse(request, { ok: false, error: 'fields object required' }, 400);
    }
    if (!Array.isArray(draws)) {
      return jsonResponse(request, { ok: false, error: 'draws array required' }, 400);
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

      // Inject fields + draws table in page context.
      // NOTE: SOV phase table was removed from the template — Exhibit A now
      // references the attached Xactimate by name instead of duplicating
      // its line items. The xact_items payload field is no longer used.
      await page.evaluate(({ fields, draws, fieldIds }) => {
        // 1) Field text injection.
        for (const id of fieldIds) {
          const el = document.getElementById(id);
          if (!el) continue;
          const value = fields[id];
          el.textContent = (value === null || value === undefined) ? '' : String(value);
        }

        // 2) Draw schedule table — still in main contract body.
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
      }, { fields, draws, fieldIds: FIELD_IDS });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,    // cover-page gradient requires this
        preferCSSPageSize: true,  // honor template's @page rules
      });

      // Deterministic storage path — re-issues use new packet_id → new path,
      // never overwrites a sent/locked packet's contract.
      const storagePath = `projects/${project_id}/contracts/contract-${packet_id}.pdf`;
      const contract_pdf_url = await uploadPdfToStorage(env, storagePath, pdfBuffer);

      return jsonResponse(request, {
        ok: true,
        contract_pdf_url,
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
