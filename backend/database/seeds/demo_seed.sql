INSERT INTO tenants (id, nome_clinica, cnpj, email)
VALUES ('00000000-0000-0000-0000-000000000001','OdontoHub Clínica Demo','99888777000166','contato@odontohub.com')
ON CONFLICT (id) DO UPDATE
SET nome_clinica = EXCLUDED.nome_clinica,
    cnpj = EXCLUDED.cnpj,
    email = EXCLUDED.email;

INSERT INTO users (id, tenant_id, nome, email, senha_hash, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Pedro Sousa',
  'pedro@odontohub.com',
  '',
  'admin'
)
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

INSERT INTO dentists (id, tenant_id, nome, especialidade, cor_agenda)
VALUES
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Dra. Ana Costa','Ortodontia','#3b82f6'),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Dr. Bruno Lima','Implantodontia','#14b8a6')
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome,
    especialidade = EXCLUDED.especialidade,
    cor_agenda = EXCLUDED.cor_agenda;

INSERT INTO patients (id, tenant_id, nome, cpf, telefone, email, data_nascimento)
VALUES
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Maria Oliveira','12345678901','5511999991111','maria@exemplo.com','1992-05-10'),
  ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','João Pereira','12345678902','5511999992222','joao@exemplo.com','1988-09-21')
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    email = EXCLUDED.email,
    data_nascimento = EXCLUDED.data_nascimento;

INSERT INTO appointments (id, tenant_id, patient_id, dentist_id, room_id, start_time, end_time, status)
VALUES
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',NULL,date_trunc('day', now()) + interval '10 hour', date_trunc('day', now()) + interval '10 hour 30 minute','confirmed'),
  ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',NULL,date_trunc('day', now()) + interval '14 hour', date_trunc('day', now()) + interval '14 hour 30 minute','scheduled'),
  ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',NULL,date_trunc('day', now()) + interval '16 hour', date_trunc('day', now()) + interval '16 hour 30 minute','arrived')
ON CONFLICT (id) DO UPDATE
SET patient_id = EXCLUDED.patient_id,
    dentist_id = EXCLUDED.dentist_id,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    status = EXCLUDED.status;

INSERT INTO finance_transactions (id, tenant_id, patient_id, appointment_id, valor, forma_pagamento, status)
VALUES
  ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',NULL,250.00,'boleto','pending')
ON CONFLICT (id) DO UPDATE
SET valor = EXCLUDED.valor,
    forma_pagamento = EXCLUDED.forma_pagamento,
    status = EXCLUDED.status;
