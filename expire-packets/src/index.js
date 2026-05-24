// expire-packets/src/index.js
// Cloudflare Worker — runs daily to mark overdue contract packets as
// 'expired' and unlock their SOVs. Calls the Supabase RPC
// `expire_overdue_contract_packets()` which does the actual work atomically.
//
// Logs one row per run to `enrichment_runs` for audit / diligence trail.

// ─── Supabase helpers (inlined) ──────────────────────────────────────────
async function callRpc(env, fnName, payload = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`RPC ${fnName} failed (${r.status}): ${txt}`);
  }
  return r.status === 204 ? null : await r.json();
}

async function insertRow(env, table, row) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Insert into ${table} failed (${r.status}): ${txt}`);
  }
}

// ─── Core expiration logic ───────────────────────────────────────────────
async function runExpiration(env) {
  const started_at = new Date().toISOString();
  const steps = [];
  const errors = [];
  let status = 'success';
  let expired_count = 0;

  try {
    steps.push({ step: 'rpc:expire_overdue_contract_packets', started: new Date().toISOString() });
    const result = await callRpc(env, 'expire_overdue_contract_packets', {});
    if (typeof result === 'number') {
      expired_count = result;
    } else if (Array.isArray(result)) {
      expired_count = result.length;
    } else if (result && typeof result === 'object') {
      expired_count = Number(result.expired_count || result.count || 0);
    }
    steps[steps.length - 1].finished = new Date().toISOString();
    steps[steps.length - 1].expired_count = expired_count;
  } catch (e) {
    status = 'failed';
    errors.push({ step: 'rpc:expire_overdue_contract_packets', error: e.message || String(e) });
    console.error('expire-packets RPC failed:', e.stack || e.message);
  }

  // Audit log to enrichment_runs (same pattern as enrich-rebuttals).
  const finished_at = new Date().toISOString();
  try {
    await insertRow(env, 'enrichment_runs', {
      status,
      steps,
      errors,
      started_at,
      finished_at,
    });
  } catch (e) {
    console.error('expire-packets writeLog failed:', e.message);
  }

  return { ok: status !== 'failed', expired_count, status, started_at, finished_at, errors };
}

export default {
  // Scheduled trigger — daily 09 UTC (04 Central Standard / 05 Central Daylight).
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runExpiration(env));
  },

  // Manual HTTP trigger — requires bearer secret.
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }
    const auth = request.headers.get('Authorization') || '';
    if (!env.PACKET_CRON_SECRET || auth !== `Bearer ${env.PACKET_CRON_SECRET}`) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing Supabase env vars' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await runExpiration(env);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
