-- ============================================================
-- Migration 005 — Polling e Atualização Automática
-- ============================================================

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger para quando um pedido muda (status, etc)
CREATE OR REPLACE FUNCTION fn_marcar_pedido_atualizado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedidos_atualizado_em ON pedidos;
CREATE TRIGGER trg_pedidos_atualizado_em
    BEFORE UPDATE ON pedidos
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION fn_marcar_pedido_atualizado();

-- Trigger para quando um item é inserido, editado ou cancelado (afeta o pedido pai)
CREATE OR REPLACE FUNCTION fn_tocar_pedido_ao_mexer_item()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE pedidos SET atualizado_em = NOW() WHERE id = OLD.pedido_id;
        RETURN OLD;
    ELSE
        UPDATE pedidos SET atualizado_em = NOW() WHERE id = NEW.pedido_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedido_itens_atualiza_pedido ON pedido_itens;
CREATE TRIGGER trg_pedido_itens_atualiza_pedido
    AFTER INSERT OR UPDATE OR DELETE ON pedido_itens
    FOR EACH ROW
    EXECUTE FUNCTION fn_tocar_pedido_ao_mexer_item();
