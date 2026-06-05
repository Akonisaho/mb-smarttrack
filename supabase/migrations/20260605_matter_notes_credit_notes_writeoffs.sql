-- ============================================================
-- Migration: matter_notes, credit_notes, invoice write-offs
-- Run this in Supabase → SQL Editor
-- ============================================================


-- ── 1. matter_notes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matter_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   text        NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note        text        NOT NULL,
  note_type   text        NOT NULL DEFAULT 'general'
                          CHECK (note_type IN ('general','call','email','meeting','instruction','court')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matter_notes_matter_id_idx ON matter_notes(matter_id);
CREATE INDEX IF NOT EXISTS matter_notes_user_id_idx   ON matter_notes(user_id);

ALTER TABLE matter_notes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all notes (attorneys see matter notes firm-wide)
CREATE POLICY "matter_notes_select" ON matter_notes
  FOR SELECT TO authenticated USING (true);

-- Users can insert their own notes
CREATE POLICY "matter_notes_insert" ON matter_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "matter_notes_delete" ON matter_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ── 2. credit_notes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id          text        PRIMARY KEY,   -- e.g. CN-123456-2025
  invoice_id  text        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client      text,
  matter_id   text,
  amount      numeric     NOT NULL CHECK (amount > 0),
  reason      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_notes_invoice_id_idx ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS credit_notes_user_id_idx    ON credit_notes(user_id);

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_notes_select" ON credit_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "credit_notes_insert" ON credit_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "credit_notes_delete" ON credit_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ── 3. Add write-off columns to invoices ─────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS written_off       boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS write_off_reason  text,
  ADD COLUMN IF NOT EXISTS written_off_at    timestamptz,
  ADD COLUMN IF NOT EXISTS written_off_by    uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS invoices_written_off_idx ON invoices(written_off)
  WHERE written_off = true;


-- ── 4. Add client_id to invoices (for email lookup) ──────────
-- Only add if it doesn't exist — some setups may already have it
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices(client_id);


-- ── Done ─────────────────────────────────────────────────────
-- Tables created:  matter_notes, credit_notes
-- Columns added:   invoices.written_off, write_off_reason,
--                  written_off_at, written_off_by, client_id
