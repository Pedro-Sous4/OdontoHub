-- Adiciona a coluna para controlar o silenciamento automático da IA por paciente
ALTER TABLE patients ADD COLUMN IF NOT EXISTS assistant_disabled_until TIMESTAMP WITH TIME ZONE;
