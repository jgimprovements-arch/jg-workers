-- expire_overdue_contract_packets.sql
-- ============================================================================
-- Canonical implementation of the RPC called nightly by jg-expire-packets.
-- Apply this in Supabase ONLY IF the function doesn't already exist — check
-- first with:
--   SELECT proname FROM pg_proc WHERE proname = 'expire_overdue_contract_packets';
--
-- Behavior:
--   1. Find packets where status='sent' AND expires_at < NOW().
--   2. Update each to status='expired' (audit: keep voided_at NULL — that
--      column is for explicit voids; expiry is a different transition).
--   3. Unlock the associated SOV (clear locked_at_packet_id) so the PM can
--      edit draws again and re-issue when ready.
--   4. Return the count of packets expired.
--
-- Transactional: all-or-nothing. If the SOV unlock fails for any reason,
-- the packet status update rolls back too.
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_overdue_contract_packets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count integer := 0;
BEGIN
  -- Update the expired packets and capture the count.
  WITH expired AS (
    UPDATE rebuild_contract_packets
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'sent'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id, project_id
  ),
  unlocked_sovs AS (
    UPDATE rebuild_sov sov
    SET locked_at_packet_id = NULL,
        confirmed_for_packet_at = NULL,
        confirmed_for_packet_by = NULL,
        updated_at = NOW()
    FROM expired e
    WHERE sov.project_id = e.project_id
      AND sov.locked_at_packet_id = e.id
    RETURNING sov.id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$;

-- Grant execute to the service role only (worker calls via service key).
REVOKE ALL ON FUNCTION expire_overdue_contract_packets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_overdue_contract_packets() TO service_role;

-- ── M&A diligence note ──────────────────────────────────────────────────────
-- This RPC is intentionally simple. The audit trail lives in two places:
--   1. enrichment_runs — one row per worker invocation (status, errors, time)
--   2. rebuild_contract_packets.updated_at — timestamps the transition
-- A more elaborate version could insert into a dedicated packet_audit table,
-- but the existing fields plus enrichment_runs are sufficient for current
-- reporting needs. Revisit if buyer diligence asks for finer-grained history.
