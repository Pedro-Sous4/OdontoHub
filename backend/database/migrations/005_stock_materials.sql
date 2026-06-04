CREATE TABLE IF NOT EXISTS stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nome VARCHAR(255) NOT NULL,
  quantidade DECIMAL(10,2) NOT NULL DEFAULT 0,
  nivel_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,
  unidade VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for tenant_id
CREATE INDEX IF NOT EXISTS idx_stock_tenant ON stock(tenant_id);
