-- ============================================================
-- Migration 006 — Módulo de Pagamento e Fechamento de Caixa
-- ============================================================

-- 1. Criação do tipo ENUM para forma de pagamento
CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'debito', 'credito');

-- 2. Tabela de Pagamentos
CREATE TABLE pagamentos (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id       UUID            NOT NULL REFERENCES pedidos(id),
    forma_pagamento forma_pagamento NOT NULL,
    valor_total     DECIMAL(10,2)   NOT NULL CHECK (valor_total >= 0),
    valor_recebido  DECIMAL(10,2)   NOT NULL CHECK (valor_recebido >= 0),
    troco           DECIMAL(10,2)   NOT NULL DEFAULT 0 CHECK (troco >= 0),
    registrado_por  UUID            NOT NULL REFERENCES usuarios(id),
    registrado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagamentos_pedido_id ON pagamentos(pedido_id);
CREATE INDEX idx_pagamentos_registrado_em ON pagamentos(registrado_em DESC);

COMMENT ON TABLE  pagamentos                 IS 'Tabela de registro de pagamentos dos pedidos. Imutável após inserção (RNF-M2-01).';
COMMENT ON COLUMN pagamentos.valor_total     IS 'Valor total calculado do pedido no momento do pagamento (RNF-M2-04).';
COMMENT ON COLUMN pagamentos.valor_recebido  IS 'Valor entregue pelo cliente.';
COMMENT ON COLUMN pagamentos.troco           IS 'Valor a ser devolvido ao cliente, gerado automaticamente para pagamentos em dinheiro.';

-- 3. Tabela de Fechamento de Caixa
CREATE TABLE fechamento_caixa (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    data_referencia DATE          NOT NULL UNIQUE,
    total_dinheiro  DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_pix       DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_debito    DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_credito   DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_geral     DECIMAL(10,2) NOT NULL DEFAULT 0,
    fechado_por     UUID          NOT NULL REFERENCES usuarios(id),
    fechado_em      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fechamento_data ON fechamento_caixa(data_referencia);

COMMENT ON TABLE fechamento_caixa IS 'Registro consolidado de caixa por dia.';

-- 4. Trigger de Auditoria para Pagamentos (RF-M2-07)
CREATE OR REPLACE FUNCTION fn_audit_pagamento_criado()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (usuario_id, acao, tabela_afetada, registro_id, detalhe)
    VALUES (
        NEW.registrado_por,
        'pagamento_registrado',
        'pagamentos',
        NEW.id,
        'Forma: ' || NEW.forma_pagamento::TEXT || ' | Total: R$' || NEW.valor_total
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pagamentos_audit
    AFTER INSERT ON pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_pagamento_criado();

-- 5. Imutabilidade dos registros de pagamento (RF-M2-06, RNF-M2-01)
CREATE OR REPLACE FUNCTION fn_impedir_alteracao_pagamento()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Registros de pagamento não podem ser alterados ou excluídos.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pagamentos_imutabilidade
    BEFORE UPDATE OR DELETE ON pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION fn_impedir_alteracao_pagamento();
