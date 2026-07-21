-- ============================================================================
-- NORUM Engenharia — Schema PostgreSQL (produção)
-- Recomendado rodar em PostgreSQL gerenciado (Supabase, Neon ou AWS RDS)
-- com backups automáticos e point-in-time recovery ativados.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Tipos enumerados: garantem que valores inválidos NUNCA entrem no banco.
-- ---------------------------------------------------------------------------
CREATE TYPE tipo_item   AS ENUM ('extintor', 'caixa_gordura', 'caixa_dagua', 'outro');
CREATE TYPE status_nota  AS ENUM ('nao_emitida', 'emitida_nao_paga', 'paga');

-- ---------------------------------------------------------------------------
-- Condomínios
-- ---------------------------------------------------------------------------
CREATE TABLE condominios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    endereco      TEXT,
    sindico       TEXT,
    telefone      TEXT,
    administradora TEXT,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Itens monitorados (extintores, caixas de gordura, caixas d'água…)
-- periodicidade_meses define de quanto em quanto tempo revisar.
-- validade é calculada, mas armazenada para consulta rápida e histórico.
-- ---------------------------------------------------------------------------
CREATE TABLE itens_monitorados (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id      UUID REFERENCES condominios(id) ON DELETE RESTRICT,
    cliente_avulso     TEXT,
    tipo               tipo_item NOT NULL,
    local              TEXT NOT NULL,
    periodicidade_meses SMALLINT NOT NULL DEFAULT 12 CHECK (periodicidade_meses > 0),
    ultima_manutencao  DATE NOT NULL DEFAULT CURRENT_DATE,
    validade           DATE NOT NULL,
    observacoes        TEXT,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (validade >= ultima_manutencao),
    -- pertence a um condomínio OU é avulso (com nome), nunca ambos vazios
    CHECK (condominio_id IS NOT NULL OR cliente_avulso IS NOT NULL)
);
CREATE INDEX idx_itens_validade   ON itens_monitorados (validade);
CREATE INDEX idx_itens_condominio ON itens_monitorados (condominio_id);

-- ---------------------------------------------------------------------------
-- Serviços / agenda de manutenção + controle de nota fiscal e pagamento
-- Regras de consistência garantidas por CHECK (não dá para marcar "paga"
-- sem data de pagamento, nem "emitida" sem número de nota).
-- ---------------------------------------------------------------------------
CREATE TABLE servicos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id   UUID REFERENCES condominios(id) ON DELETE RESTRICT,
    cliente_avulso  TEXT,
    item_id         UUID REFERENCES itens_monitorados(id) ON DELETE SET NULL,
    titulo          TEXT NOT NULL,
    data_agendada   DATE NOT NULL,
    valor           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
    status_nota     status_nota NOT NULL DEFAULT 'nao_emitida',
    nf_numero       TEXT,
    nf_emitida_em   DATE,
    pago_em         DATE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cliente_definido CHECK (condominio_id IS NOT NULL OR cliente_avulso IS NOT NULL),
    CONSTRAINT nf_coerente CHECK (
        (status_nota = 'nao_emitida' AND pago_em IS NULL) OR
        (status_nota = 'emitida_nao_paga' AND nf_numero IS NOT NULL AND pago_em IS NULL) OR
        (status_nota = 'paga' AND nf_numero IS NOT NULL AND pago_em IS NOT NULL)
    )
);
CREATE INDEX idx_servicos_status     ON servicos (status_nota);
CREATE INDEX idx_servicos_data       ON servicos (data_agendada);
CREATE INDEX idx_servicos_condominio ON servicos (condominio_id);

-- ---------------------------------------------------------------------------
-- Trigger: mantém atualizado_em sempre correto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_cond  BEFORE UPDATE ON condominios        FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER t_itens BEFORE UPDATE ON itens_monitorados  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER t_serv  BEFORE UPDATE ON servicos           FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ---------------------------------------------------------------------------
-- View pronta: itens em alerta (vencidos ou vencendo em até 30 dias)
-- ---------------------------------------------------------------------------
CREATE VIEW vw_itens_alerta AS
SELECT i.*, c.nome AS condominio, (i.validade - CURRENT_DATE) AS dias_restantes
FROM itens_monitorados i
JOIN condominios c ON c.id = i.condominio_id
WHERE i.validade <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY i.validade;

-- ---------------------------------------------------------------------------
-- View pronta: contas a receber (notas emitidas e não pagas)
-- ---------------------------------------------------------------------------
CREATE VIEW vw_a_receber AS
SELECT s.*, c.nome AS condominio
FROM servicos s
JOIN condominios c ON c.id = s.condominio_id
WHERE s.status_nota = 'emitida_nao_paga'
ORDER BY s.data_agendada;

-- ===========================================================================
-- SEGURANÇA (RLS) — necessário para o app conseguir ler/gravar.
-- Aqui: qualquer usuário AUTENTICADO tem acesso total. Como só você cria os
-- usuários (em Authentication > Users), isso é adequado para uso interno.
-- ===========================================================================
ALTER TABLE condominios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_monitorados  ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_autenticado" ON condominios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acesso_autenticado" ON itens_monitorados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acesso_autenticado" ON servicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
