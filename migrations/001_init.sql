-- AeroGaze AI | Migração 001: esquema inicial
-- Princípios do documento de arquitetura: eventos append-only, isolamento por organização,
-- idempotência por UUID gerado no dispositivo, outbox para entrega confiável.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ------------------------------------------------------------------ organização e acesso
CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE farms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX farms_org_idx ON farms (organization_id);

-- Papéis mínimos do documento: operador, veterinário, gerente, auditor, administrador
CREATE TYPE user_role AS ENUM ('operador', 'veterinario', 'gerente', 'auditor', 'administrador');

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  -- NULL = enxerga todas as fazendas da organização (diretoria/administrador)
  farm_id         uuid REFERENCES farms(id),
  email           text NOT NULL UNIQUE,
  name            text NOT NULL,
  password_hash   text NOT NULL,
  role            user_role NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Identidade do dispositivo; revogar = bloquear envios do aparelho
CREATE TABLE devices (
  id              text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  name            text,
  registered_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz
);

-- ------------------------------------------------------------------ geografia
CREATE TABLE plots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id    uuid NOT NULL REFERENCES farms(id),
  name       text NOT NULL,
  kind       text NOT NULL DEFAULT 'talhao',   -- talhao | piquete
  boundary   geometry(Polygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plots_boundary_gix ON plots USING GIST (boundary);
CREATE INDEX plots_farm_idx ON plots (farm_id);

-- ------------------------------------------------------------------ eventos (imutáveis)
CREATE TABLE sync_events (
  id              uuid PRIMARY KEY,                 -- UUID gerado no aparelho = chave de idempotência
  organization_id uuid NOT NULL REFERENCES organizations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  plot_id         uuid REFERENCES plots(id),
  device_id       text NOT NULL REFERENCES devices(id),
  type            text NOT NULL,
  schema_version  integer NOT NULL,
  occurred_at     timestamptz NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  payload         jsonb NOT NULL,
  location        geography(Point, 4326),
  accuracy_m      real
);
CREATE INDEX sync_events_scope_idx ON sync_events (organization_id, farm_id, occurred_at DESC);
CREATE INDEX sync_events_type_idx ON sync_events (type, occurred_at DESC);
CREATE INDEX sync_events_asset_idx ON sync_events ((payload->>'assetId'), occurred_at DESC)
  WHERE payload ? 'assetId';

-- Append-only: nenhuma atualização ou exclusão. Correções entram como novos eventos compensatórios.
CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'tabela % é append-only (correção = novo evento compensatório)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_events_append_only
  BEFORE UPDATE OR DELETE ON sync_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ------------------------------------------------------------------ decisão operacional
CREATE TABLE alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  plot_id         uuid REFERENCES plots(id),
  source_event_id uuid REFERENCES sync_events(id),
  rule            text NOT NULL,
  severity        text NOT NULL,                 -- baixa | media | alta | critica
  title           text NOT NULL,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key      text,
  status          text NOT NULL DEFAULT 'aberto', -- aberto | reconhecido | resolvido
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- Não repetir alerta aberto para o mesmo motivo
CREATE UNIQUE INDEX alerts_open_dedupe_uidx ON alerts (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status = 'aberto';
CREATE INDEX alerts_scope_idx ON alerts (organization_id, farm_id, created_at DESC);

CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  plot_id         uuid REFERENCES plots(id),
  alert_id        uuid REFERENCES alerts(id),
  source_event_id uuid REFERENCES sync_events(id),
  title           text NOT NULL,
  description     text,
  priority        text NOT NULL DEFAULT 'media', -- baixa | media | alta | critica
  status          text NOT NULL DEFAULT 'pendente', -- pendente | em_progresso | concluida
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_scope_idx ON tasks (organization_id, farm_id, created_at DESC);

-- ------------------------------------------------------------------ outbox e prova
CREATE TABLE outbox (
  id           bigserial PRIMARY KEY,
  topic        text NOT NULL,                    -- ex.: event.accepted
  aggregate_id uuid NOT NULL,
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX outbox_pending_idx ON outbox (id) WHERE processed_at IS NULL;

CREATE TABLE proof_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  merkle_root     text NOT NULL,                 -- 0x + 64 hex
  leaf_count      integer NOT NULL,
  schema_version  integer NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'pendente', -- pendente | ancorado | falhou (esgotou tentativas)
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  anchor_mode     text,
  chain_id        text,
  tx_ref          text,
  block_number    bigint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  anchored_at     timestamptz
);
CREATE INDEX proof_batches_status_idx ON proof_batches (status, next_attempt_at);

CREATE TABLE proof_batch_items (
  batch_id uuid NOT NULL REFERENCES proof_batches(id),
  position integer NOT NULL,                     -- posição da folha na árvore
  event_id uuid NOT NULL REFERENCES sync_events(id),
  leaf     text NOT NULL,                        -- hash da folha (0x + 64 hex)
  PRIMARY KEY (batch_id, position),
  UNIQUE (event_id)                              -- um evento entra em um único lote
);

-- ------------------------------------------------------------------ auditoria
CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  at              timestamptz NOT NULL DEFAULT now(),
  organization_id uuid,
  user_id         uuid,
  device_id       text,
  action          text NOT NULL,
  entity          text,
  entity_id       text,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
