INSERT INTO tenants (id, nome_clinica, cnpj, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Clínica Demo', '00000000000100', 'contato@demo.com')
ON CONFLICT (cnpj) DO NOTHING;
