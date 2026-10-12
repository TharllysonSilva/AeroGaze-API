CREATE TABLE solana_receipts (
  event_id uuid PRIMARY KEY REFERENCES sync_events(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  event_hash text NOT NULL,
  issuer text,
  signature text,
  raw_transaction text,
  blockhash text,
  last_valid_block_height bigint,
  status text NOT NULL DEFAULT 'pendente',
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
CREATE INDEX solana_receipts_pending_idx ON solana_receipts (status,next_attempt_at);
