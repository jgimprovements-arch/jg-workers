// enrich-rebuttals/src/index.js
// Cloudflare Worker — nightly enrichment of adjuster_rebuttals from Albi.
//
// For every rebuttal where final_outcome IS NULL, queries Albi for the
// matching project (by name). If the project is closed and has a paid
// amount, writes back:
//   - payment_received_amount
//   - payment_received_date     (uses Albi's updatedAt as proxy)
//   - days_to_payment           (rebuttal created_at → close date)
//   - final_outcome             (paid_full / paid_partial / denied)
//   - outcome_notes             (Albi project ID, billed %, etc.)
//
// Replaces the broken Vercel /api/enrich-rebuttals endpoint.
//
// ─── Triggers ─────────────────────────────────────────────────────────────
// 1) Cron — daily at 08:00 UTC (03:00 Central CDT / 02:00 CST), same as original
// 2) Manual POST — `Authorization: Bearer <CRON_SECRET>` for ad-hoc runs
//
// ─── Env vars (set as Worker secrets) ─────────────────────────────────────
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
// ALBI_KEY            — required; the worker refuses to run without it.
//                       Named ALBI_KEY (not ALBI_API_KEY) to match the
//                       existing Cloudflare secret deployed for this worker.
// CRON_SECRET         — for manual HTTP triggering
//
// ─── Notes on the Albi port (May 2026) ────────────────────────────────────
// The original Vercel code hit app.albiware.com with Bearer auth. Per the
// Cloudflare Albi proxy migration (jg-albi-proxy, 2026-05-22), Albi now
// lives at api.albiware.com/v5/Integrations/Projects and authenticates with
// the `ApiKey` header (NOT Bearer). This worker uses the new URL+auth
// directly with its own copy of ALBI_KEY rather than routing through
// jg-albi-proxy — keeping it independent so an Albi-side issue can't take
// down dispatch.

// ─── Supabase helpers (inlined for self-contained worker) ────────────────
function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function writeLog(env, log, status) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/enrichment_runs`, {
      method: 'POST',
      headers: { ...sbHeaders(env), Prefer: 'return=minimal' },
      body: JSON.stringify({
        status,
        steps: log.steps,
        errors: log.errors,
        started_at: log.started_at,
        finished_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('writeLog failed:', e.message);
  }
}

// ─── Albi: find project by exact name (case-insensitive) ─────────────────
async function findAlbiProject(env, projectName, log) {
  const target = (projectName || '').trim().toLowerCase();
  if (!target) return null;

  const maxPages = 30; // 1,500 projects worst case — Albi has ~3,000 total
  for (let p = 1; p <= maxPages; p++) {
    const url = `https://api.albiware.com/v5/Integrations/Projects?pageSize=50&page=${p}`;
    const r = await fetch(url, {
      headers: {
        ApiKey: env.ALBI_KEY,
        Accept: 'application/json',
      },
    });
    if (!r.ok) {
      log.errors.push({ step: 'albi_fetch_failed', page: p, status: r.status });
      return null;
    }
    const data = await r.json();
    const match = (data.data || []).find(
      prj => (prj.name || '').trim().toLowerCase() === target
    );
    if (match) return match;
    if (!data.pagination || p >= (data.pagination.totalPages || 0)) break;
  }
  return null;
}

// ─── Carrier name fuzzy-match ────────────────────────────────────────────
// "State Farm" matches "State Farm Insurance Company / Proximity"
function carrierMatches(rebuttalCarrier, albiCarrier) {
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const r = norm(rebuttalCarrier);
  const a = norm(albiCarrier);
  if (!r || !a) return true; // can't compare, don't block
  return a.includes(r) || r.includes(a);
}

// ─── Classify an Albi project into outcome schema ────────────────────────
function classifyAlbiProject(project, rebuttal) {
  const paid = Number(project.paidAmount || 0);
  const billed = Number(project.actualRevenue || 0);
  const billedPct = Number(project.projectBilledPercent || 0);
  const jgTotalNum = Number(String(rebuttal.jg_total || '').replace(/[^0-9.]/g, '')) || 0;

  // Albi doesn't expose a literal close date; updatedAt is the last
  // modification, typically the close action for closed projects.
  const closedDate = project.updatedAt ? new Date(project.updatedAt) : new Date();
  const rebuttalDate = new Date(rebuttal.created_at);
  const daysToPayment = Math.max(
    0,
    Math.round((closedDate - rebuttalDate) / (1000 * 60 * 60 * 24))
  );

  let outcome;
  if (paid <= 0.01) {
    outcome = 'denied';
  } else if (billed > 0 && paid >= billed * 0.98) {
    outcome = 'paid_full';
  } else if (paid > 0 && paid < billed) {
    outcome = 'paid_partial';
  } else if (paid > 0 && billed === 0) {
    outcome = 'paid_partial';
  } else {
    outcome = 'paid_partial';
  }

  const notes = [
    `Albi project ID ${project.id}`,
    `billed $${billed.toFixed(2)}`,
    `paid $${paid.toFixed(2)}`,
    `JG estimate was $${jgTotalNum.toFixed(2)}`,
    `billed % ${billedPct.toFixed(1)}`,
    project.insuranceCompany ? `carrier: ${project.insuranceCompany}` : null,
    project.insuranceClaimNumber ? `claim: ${project.insuranceClaimNumber}` : null,
  ].filter(Boolean).join('; ');

  return {
    payment_received_amount: `$${paid.toFixed(2)}`,
    payment_received_date: closedDate.toISOString().slice(0, 10),
    days_to_payment: daysToPayment,
    final_outcome: outcome,
    notes,
  };
}

// ─── Core enrichment routine ─────────────────────────────────────────────
async function runEnrichment(env) {
  const startedAt = new Date().toISOString();
  const log = { started_at: startedAt, steps: [], errors: [] };

  // Env check
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALBI_KEY'];
  const missing = required.filter(k => !env[k]);
  if (missing.length) {
    log.errors.push({ step: 'config', missing });
    return { ok: false, error: 'missing env vars', missing };
  }

  try {
    // Pull pending rebuttals (no final_outcome, created within last 365 days).
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const pendingRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/adjuster_rebuttals?select=id,project_name,carrier,claim_number,created_at,jg_total&final_outcome=is.null&created_at=gte.${cutoff}&order=created_at.asc`,
      { headers: sbHeaders(env) }
    );
    if (!pendingRes.ok) {
      const body = await pendingRes.text();
      throw new Error(`supabase pending fetch failed ${pendingRes.status}: ${body.slice(0, 200)}`);
    }
    const pending = await pendingRes.json();
    log.steps.push({ step: 'pending_count', value: pending.length });

    if (pending.length === 0) {
      log.steps.push({ step: 'done', reason: 'nothing to enrich' });
      await writeLog(env, log, 'success');
      return { ok: true, enriched: 0, pending: 0 };
    }

    let enrichedCount = 0;
    let stillOpenCount = 0;
    let noMatchCount = 0;
    let mismatchedCount = 0;

    for (const reb of pending) {
      try {
        const project = await findAlbiProject(env, reb.project_name, log);

        if (!project) {
          noMatchCount++;
          log.steps.push({ step: 'no_match', project: reb.project_name });
          continue;
        }

        // Carrier mismatch is a warning, not a blocker.
        if (reb.carrier && project.insuranceCompany &&
            !carrierMatches(reb.carrier, project.insuranceCompany)) {
          mismatchedCount++;
          log.errors.push({
            step: 'carrier_mismatch_warning',
            project: reb.project_name,
            rebuttal_carrier: reb.carrier,
            albi_carrier: project.insuranceCompany,
            note: 'enriching anyway — verify manually',
          });
        }

        // Skip if project is still open.
        if (!project.closedBoolean) {
          stillOpenCount++;
          log.steps.push({ step: 'still_open', project: reb.project_name, status: project.status });
          continue;
        }

        const outcome = classifyAlbiProject(project, reb);

        const updateRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/adjuster_rebuttals?id=eq.${reb.id}`,
          {
            method: 'PATCH',
            headers: { ...sbHeaders(env), Prefer: 'return=minimal' },
            body: JSON.stringify({
              payment_received_amount: outcome.payment_received_amount,
              payment_received_date:   outcome.payment_received_date,
              days_to_payment:         outcome.days_to_payment,
              final_outcome:           outcome.final_outcome,
              outcome_notes:           outcome.notes,
            }),
          }
        );

        if (updateRes.ok) {
          enrichedCount++;
          log.steps.push({
            step: 'enriched',
            project: reb.project_name,
            albi_id: project.id,
            outcome: outcome.final_outcome,
            paid: outcome.payment_received_amount,
            days: outcome.days_to_payment,
          });
        } else {
          const errBody = await updateRes.text();
          log.errors.push({
            step: 'supabase_update_failed',
            project: reb.project_name,
            status: updateRes.status,
            body: errBody.slice(0, 200),
          });
        }
      } catch (e) {
        log.errors.push({
          step: 'enrich_row_failed',
          project: reb.project_name,
          message: e.message,
        });
      }
    }

    log.steps.push({
      step: 'summary',
      pending: pending.length,
      enriched: enrichedCount,
      still_open: stillOpenCount,
      no_match: noMatchCount,
      carrier_mismatches: mismatchedCount,
    });
    await writeLog(env, log, 'success');
    return {
      ok: true,
      pending: pending.length,
      enriched: enrichedCount,
      still_open: stillOpenCount,
      no_match: noMatchCount,
      carrier_mismatches: mismatchedCount,
    };
  } catch (e) {
    log.errors.push({ step: 'fatal', message: e.message });
    await writeLog(env, log, 'failed');
    return { ok: false, error: e.message };
  }
}

export default {
  // Scheduled trigger — daily 08:00 UTC = 03:00 Central CDT / 02:00 CST.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runEnrichment(env));
  },

  // Manual HTTP trigger — bearer secret required.
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await runEnrichment(env);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
