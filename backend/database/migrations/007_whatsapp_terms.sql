CREATE TABLE IF NOT EXISTS whatsapp_terms_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    responsavel_nome VARCHAR(255) NOT NULL,
    responsavel_cpf VARCHAR(20) NOT NULL,
    data_nascimento DATE,
    signature_base64 TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
