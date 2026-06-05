-- ============================================================
-- Phase 2 Features Migration
-- Run in Supabase → SQL Editor
-- ============================================================

-- ── 1. Add columns to matters ────────────────────────────────
ALTER TABLE matters
  ADD COLUMN IF NOT EXISTS prescription_date  date,
  ADD COLUMN IF NOT EXISTS next_action_date   date,
  ADD COLUMN IF NOT EXISTS budget_units       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closure_notes      text,
  ADD COLUMN IF NOT EXISTS closed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS conflict_checked   boolean DEFAULT false;

-- Status column (open/pending_closure/closed) — only add if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='matters' AND column_name='status'
  ) THEN
    ALTER TABLE matters ADD COLUMN status text DEFAULT 'open';
  END IF;
END $$;

-- ── 2. undertakings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS undertakings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id    text NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction    text NOT NULL DEFAULT 'given' CHECK (direction IN ('given','received')),
  description  text NOT NULL,
  given_to     text,
  due_date     date,
  fulfilled_at timestamptz,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','overdue')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS undertakings_matter_id_idx ON undertakings(matter_id);
CREATE INDEX IF NOT EXISTS undertakings_status_idx    ON undertakings(status);

ALTER TABLE undertakings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "undertakings_select" ON undertakings;
DROP POLICY IF EXISTS "undertakings_insert" ON undertakings;
DROP POLICY IF EXISTS "undertakings_update" ON undertakings;
DROP POLICY IF EXISTS "undertakings_delete" ON undertakings;
CREATE POLICY "undertakings_select" ON undertakings FOR SELECT TO authenticated USING (true);
CREATE POLICY "undertakings_insert" ON undertakings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "undertakings_update" ON undertakings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "undertakings_delete" ON undertakings FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ── 3. client_communications ─────────────────────────────────
CREATE TABLE IF NOT EXISTS client_communications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES clients(id) ON DELETE CASCADE,
  matter_id    text REFERENCES matters(id) ON DELETE SET NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comm_type    text NOT NULL DEFAULT 'note' CHECK (comm_type IN ('call','email','meeting','letter','note','whatsapp')),
  direction    text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  subject      text,
  body         text NOT NULL,
  comm_date    date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_comms_client_id_idx ON client_communications(client_id);
CREATE INDEX IF NOT EXISTS client_comms_matter_id_idx ON client_communications(matter_id);

ALTER TABLE client_communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_comms_select" ON client_communications;
DROP POLICY IF EXISTS "client_comms_insert" ON client_communications;
DROP POLICY IF EXISTS "client_comms_delete" ON client_communications;
CREATE POLICY "client_comms_select" ON client_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_comms_insert" ON client_communications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_comms_delete" ON client_communications FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ── 4. audit_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text,
  details      jsonb,
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx     ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);


-- ── 5. interest_charges ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS interest_charges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       numeric NOT NULL CHECK (amount > 0),
  rate_percent numeric NOT NULL DEFAULT 10.5,
  days_overdue integer NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  added_to_invoice boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS interest_charges_invoice_id_idx ON interest_charges(invoice_id);

ALTER TABLE interest_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interest_charges_select" ON interest_charges;
DROP POLICY IF EXISTS "interest_charges_insert" ON interest_charges;
CREATE POLICY "interest_charges_select" ON interest_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY "interest_charges_insert" ON interest_charges FOR INSERT TO authenticated WITH CHECK (true);


-- ── Done ─────────────────────────────────────────────────────
-- matters: prescription_date, next_action_date, budget_units,
--          closure_notes, closed_at, closed_by, conflict_checked, status
-- New tables: undertakings, client_communications, audit_log, interest_charges
