# jg-workers

Three Cloudflare Workers that replace the broken Vercel `jg-proxy-v2`
endpoints for the JG Platform contract-packet pipeline.

## Workers

| Folder              | Worker name           | Trigger              | Purpose                                          |
| ------------------- | --------------------- | -------------------- | ------------------------------------------------ |
| `render-contract/`  | `jg-render-contract`  | HTTP POST            | Generates the contract PDF from the template     |
| `packet-merge/`     | `jg-packet-merge`     | HTTP POST            | Merges Contract + SOV + Xact into one packet PDF |
| `expire-packets/`   | `jg-expire-packets`   | Cron (daily 09 UTC)  | Marks overdue packets expired, unlocks their SOV |

Each folder is a fully self-contained Cloudflare Worker project — its own
`package.json`, `wrangler.toml`, and source. They're deployed independently
via Cloudflare's Git integration with the **Root directory** set to the
respective folder name.

## Deployment

In the Cloudflare dashboard, create three separate Workers from this repo:

1. **Workers & Pages → Create → Connect to Git** → select `jg-workers`
2. For each worker, set:
   - **Project name:** matches the folder (`jg-render-contract`, etc.)
   - **Root directory:** the folder (`render-contract`, `packet-merge`, `expire-packets`)
   - **Build command:** `npm install` (or leave default)
   - **Deploy command:** `npx wrangler deploy`
3. After first deploy, set secrets via dashboard → Worker → Settings → Variables:
   - `SUPABASE_URL` = `https://nuykvchgecpiuikoerze.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (service role key from Supabase)
   - `PACKET_CRON_SECRET` (expire-packets only) = (long random string)

## Schema dependency

`expire-packets` calls Supabase RPC `expire_overdue_contract_packets()`.
See `docs/expire_overdue_contract_packets.sql` for the canonical
implementation if the RPC doesn't already exist.

## What's NOT here

`parse-pdf` is intentionally not ported — it was dead fallback code in the
original Vercel proxy. See `rebuild.html` change log for details.
