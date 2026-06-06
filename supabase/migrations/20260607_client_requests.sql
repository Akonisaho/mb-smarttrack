-- ── Client self-registration requests ───────────────────────
CREATE TABLE IF NOT EXISTS client_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  email        text NOT NULL,
  phone        text,
  id_number    text,
  service_type text NOT NULL,
  description  text NOT NULL,
  urgency      text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','urgent')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','converted','rejected')),
  reviewed_by  uuid REFERENCES auth.users(id),
  reviewed_at  timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_requests_select" ON client_requests;
DROP POLICY IF EXISTS "client_requests_insert" ON client_requests;
DROP POLICY IF EXISTS "client_requests_update" ON client_requests;
CREATE POLICY "client_requests_select" ON client_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_requests_insert" ON client_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "client_requests_update" ON client_requests FOR UPDATE TO authenticated USING (true);

-- ── Portal service requests (from logged-in clients) ─────────
CREATE TABLE IF NOT EXISTS portal_service_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  description  text NOT NULL,
  urgency      text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','urgent')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','in_progress','resolved')),
  reviewed_by  uuid REFERENCES auth.users(id),
  matter_id    text REFERENCES matters(id) ON DELETE SET NULL,
  response     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_service_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_requests_select" ON portal_service_requests;
DROP POLICY IF EXISTS "portal_requests_insert" ON portal_service_requests;
DROP POLICY IF EXISTS "portal_requests_update" ON portal_service_requests;
CREATE POLICY "portal_requests_select" ON portal_service_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "portal_requests_insert" ON portal_service_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "portal_requests_update" ON portal_service_requests FOR UPDATE TO authenticated USING (true);
