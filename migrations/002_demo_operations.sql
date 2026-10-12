-- Cenário de hackathon: dados explicitamente simulados, isolados por fazenda.
CREATE TABLE demo_scenarios (
  farm_id uuid PRIMARY KEY REFERENCES farms(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo_actions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  user_id uuid NOT NULL REFERENCES users(id),
  command text NOT NULL,
  target text,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demo_actions_scope_idx ON demo_actions (farm_id, created_at DESC);
CREATE TRIGGER demo_actions_append_only BEFORE UPDATE OR DELETE ON demo_actions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
