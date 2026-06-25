-- ============================================================
-- Migration 003 — Reestruturação Completa do Schema
-- Sistema de Gestão de Pedidos — Restaurante (Mesa + Delivery)
-- Neon.tech PostgreSQL
-- ATENÇÃO: Esta migration recria o banco do zero conforme a
--          especificação oficial do sistema Pandora.
-- ============================================================

-- ============================================================
-- DROP: Remove estrutura anterior (ordem inversa de dependência)
-- ============================================================
DROP TABLE IF EXISTS item_edit_log           CASCADE;
DROP TABLE IF EXISTS order_status_log        CASCADE;
DROP TABLE IF EXISTS order_items             CASCADE;
DROP TABLE IF EXISTS orders                  CASCADE;
DROP TABLE IF EXISTS menu_items              CASCADE;
DROP TABLE IF EXISTS tables                  CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;

DROP TABLE IF EXISTS audit_log               CASCADE;
DROP TABLE IF EXISTS pedido_status_historico CASCADE;
DROP TABLE IF EXISTS pedido_itens            CASCADE;
DROP TABLE IF EXISTS pedidos                 CASCADE;
DROP TABLE IF EXISTS cardapio_itens          CASCADE;
DROP TABLE IF EXISTS mesas                   CASCADE;
DROP TABLE IF EXISTS clientes                CASCADE;
DROP TABLE IF EXISTS usuarios                CASCADE;

-- DROP TYPES antigos
DROP TYPE IF EXISTS user_role     CASCADE;
DROP TYPE IF EXISTS table_status  CASCADE;
DROP TYPE IF EXISTS menu_category CASCADE;
DROP TYPE IF EXISTS order_type    CASCADE;
DROP TYPE IF EXISTS order_status  CASCADE;
DROP TYPE IF EXISTS item_action   CASCADE;

-- DROP TYPES novos (caso já existam por re-execução)
DROP TYPE IF EXISTS perfil_usuario CASCADE;
DROP TYPE IF EXISTS status_mesa    CASCADE;
DROP TYPE IF EXISTS categoria_item CASCADE;
DROP TYPE IF EXISTS tipo_pedido    CASCADE;
DROP TYPE IF EXISTS status_pedido  CASCADE;

-- ============================================================
-- Extensões
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM Types
-- ============================================================
CREATE TYPE perfil_usuario AS ENUM ('administrador', 'atendente', 'cozinha');
CREATE TYPE status_mesa    AS ENUM ('livre', 'ocupada');
CREATE TYPE categoria_item AS ENUM ('prato_principal', 'bebida', 'sobremesa', 'adicional');
CREATE TYPE tipo_pedido    AS ENUM ('salao', 'delivery');
CREATE TYPE status_pedido  AS ENUM ('recebido', 'em_preparo', 'pronto', 'entregue', 'encerrado');

-- ============================================================
-- TABELA: usuarios
-- Armazena todos os usuários do sistema com seus perfis de acesso.
-- ============================================================
CREATE TABLE usuarios (
    id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       VARCHAR(120)   NOT NULL,
    email      VARCHAR(150)   NOT NULL UNIQUE,
    senha_hash TEXT           NOT NULL,
    perfil     perfil_usuario NOT NULL DEFAULT 'atendente',
    ativo      BOOLEAN        NOT NULL DEFAULT TRUE,
    criado_em  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email  ON usuarios(email);
CREATE INDEX idx_usuarios_perfil ON usuarios(perfil) WHERE ativo = TRUE;

COMMENT ON TABLE  usuarios             IS 'Usuários do sistema com perfis de acesso (administrador, atendente, cozinha).';
COMMENT ON COLUMN usuarios.senha_hash  IS 'Senha armazenada com hash bcrypt. Nunca em texto puro.';
COMMENT ON COLUMN usuarios.perfil      IS 'Perfil de acesso: administrador, atendente ou cozinha.';
COMMENT ON COLUMN usuarios.ativo       IS 'FALSE desativa o usuário sem excluí-lo do banco.';

-- ============================================================
-- TABELA: clientes
-- Dados dos clientes. Delivery → vínculo obrigatório. Salão → opcional.
-- ============================================================
CREATE TABLE clientes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(120) NOT NULL,
    telefone        VARCHAR(20)  NOT NULL UNIQUE,
    endereco_padrao TEXT,
    ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_telefone ON clientes(telefone);
CREATE INDEX idx_clientes_ativo    ON clientes(ativo) WHERE ativo = TRUE;

COMMENT ON TABLE  clientes                 IS 'Clientes cadastrados. Obrigatório para delivery; opcional para salão.';
COMMENT ON COLUMN clientes.telefone        IS 'Telefone único por cliente, usado como identificador de contato.';
COMMENT ON COLUMN clientes.endereco_padrao IS 'Endereço principal de entrega. Pode ser sobrescrito no pedido de delivery.';

-- ============================================================
-- TABELA: mesas
-- Mesas do salão com status de disponibilidade.
-- ============================================================
CREATE TABLE mesas (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero    VARCHAR(50) NOT NULL UNIQUE,
    status    status_mesa NOT NULL DEFAULT 'livre',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mesas_status ON mesas(status);

COMMENT ON TABLE  mesas        IS 'Mesas do salão. Status controlado pela aplicação ao abrir/encerrar pedidos.';
COMMENT ON COLUMN mesas.numero IS 'Identificador visível da mesa. Ex: Mesa 1, Mesa 2. Único.';
COMMENT ON COLUMN mesas.status IS 'livre = disponível para novo pedido; ocupada = pedido ativo em curso.';

-- ============================================================
-- TABELA: cardapio_itens
-- Itens disponíveis no cardápio para seleção nos pedidos.
-- ============================================================
CREATE TABLE cardapio_itens (
    id        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      VARCHAR(150)   NOT NULL,
    categoria categoria_item NOT NULL,
    ativo     BOOLEAN        NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cardapio_itens_ativo     ON cardapio_itens(ativo) WHERE ativo = TRUE;
CREATE INDEX idx_cardapio_itens_categoria ON cardapio_itens(categoria);

COMMENT ON TABLE  cardapio_itens       IS 'Itens do cardápio disponíveis para adição nos pedidos.';
COMMENT ON COLUMN cardapio_itens.ativo IS 'FALSE oculta o item do cardápio sem excluí-lo, preservando histórico de pedidos.';

-- ============================================================
-- TABELA: pedidos
-- Tabela central. Armazena todos os pedidos (salão e delivery).
-- ============================================================
CREATE TABLE pedidos (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo             tipo_pedido   NOT NULL,
    status           status_pedido NOT NULL DEFAULT 'recebido',

    -- Salão: obrigatório para tipo='salao'; NULL para delivery
    mesa_id          UUID REFERENCES mesas(id),

    -- Cliente: obrigatório para delivery; opcional para salão
    cliente_id       UUID REFERENCES clientes(id),

    -- Atendente que abriu o pedido (sempre obrigatório)
    atendente_id     UUID          NOT NULL REFERENCES usuarios(id),

    -- Endereço de entrega: obrigatório para delivery; NULL para salão
    endereco_entrega TEXT,

    -- Controle temporal
    aberto_em        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    encerrado_em     TIMESTAMPTZ,

    -- Regras de integridade por tipo de pedido
    CONSTRAINT chk_salao_requer_mesa
        CHECK (tipo != 'salao' OR mesa_id IS NOT NULL),

    CONSTRAINT chk_salao_sem_endereco
        CHECK (tipo != 'salao' OR endereco_entrega IS NULL),

    CONSTRAINT chk_delivery_requer_cliente
        CHECK (tipo != 'delivery' OR cliente_id IS NOT NULL),

    CONSTRAINT chk_delivery_requer_endereco
        CHECK (tipo != 'delivery' OR endereco_entrega IS NOT NULL),

    CONSTRAINT chk_delivery_sem_mesa
        CHECK (tipo != 'delivery' OR mesa_id IS NULL)
);

CREATE INDEX idx_pedidos_status     ON pedidos(status);
CREATE INDEX idx_pedidos_tipo       ON pedidos(tipo);
CREATE INDEX idx_pedidos_mesa_id    ON pedidos(mesa_id)    WHERE mesa_id    IS NOT NULL;
CREATE INDEX idx_pedidos_cliente_id ON pedidos(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX idx_pedidos_atendente  ON pedidos(atendente_id);
CREATE INDEX idx_pedidos_aberto_em  ON pedidos(aberto_em DESC);

-- Apenas um pedido ativo por mesa (segunda barreira além da aplicação)
CREATE UNIQUE INDEX idx_pedidos_uma_mesa_ativa
    ON pedidos(mesa_id)
    WHERE mesa_id IS NOT NULL
      AND status NOT IN ('entregue', 'encerrado');

COMMENT ON TABLE  pedidos                  IS 'Tabela central. Armazena todos os pedidos de salão e delivery.';
COMMENT ON COLUMN pedidos.mesa_id          IS 'Obrigatório para salão; NULL para delivery.';
COMMENT ON COLUMN pedidos.cliente_id       IS 'Obrigatório para delivery; opcional para salão.';
COMMENT ON COLUMN pedidos.endereco_entrega IS 'Endereço do pedido de delivery. Pode diferir do endereço padrão do cliente.';
COMMENT ON COLUMN pedidos.encerrado_em     IS 'Preenchido automaticamente pelo trigger ao encerrar o pedido.';

-- ============================================================
-- TABELA: pedido_itens
-- Cada item adicionado a um pedido, com quantidade e observação.
-- ============================================================
CREATE TABLE pedido_itens (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id        UUID        NOT NULL REFERENCES pedidos(id),
    cardapio_item_id UUID        NOT NULL REFERENCES cardapio_itens(id),
    quantidade       SMALLINT    NOT NULL CHECK (quantidade > 0),
    observacao       TEXT,

    -- Cancelamento: item nunca é excluído, apenas marcado
    cancelado        BOOLEAN     NOT NULL DEFAULT FALSE,
    cancelado_motivo TEXT,
    cancelado_por    UUID        REFERENCES usuarios(id),
    cancelado_em     TIMESTAMPTZ,

    adicionado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Campos de cancelamento devem ser preenchidos juntos ou em branco
    CONSTRAINT chk_cancelamento_consistente
        CHECK (
            (cancelado = FALSE
                AND cancelado_motivo IS NULL
                AND cancelado_por    IS NULL
                AND cancelado_em     IS NULL)
            OR
            (cancelado = TRUE
                AND cancelado_motivo IS NOT NULL
                AND cancelado_por    IS NOT NULL
                AND cancelado_em     IS NOT NULL)
        )
);

CREATE INDEX idx_pedido_itens_pedido   ON pedido_itens(pedido_id);
CREATE INDEX idx_pedido_itens_cardapio ON pedido_itens(cardapio_item_id);
CREATE INDEX idx_pedido_itens_cancel   ON pedido_itens(pedido_id) WHERE cancelado = TRUE;

COMMENT ON TABLE  pedido_itens           IS 'Itens de cada pedido. Itens cancelados são marcados; nunca excluídos.';
COMMENT ON COLUMN pedido_itens.cancelado IS 'TRUE indica item cancelado. Permanece no banco para rastreabilidade completa.';
COMMENT ON COLUMN pedido_itens.observacao IS 'Observação livre do cliente. Ex: sem cebola, bem passado.';

-- ============================================================
-- TABELA: pedido_status_historico
-- Registra cada mudança de status de um pedido.
-- ============================================================
CREATE TABLE pedido_status_historico (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id       UUID          NOT NULL REFERENCES pedidos(id),
    status_anterior status_pedido,
    status_novo     status_pedido NOT NULL,
    alterado_por    UUID          NOT NULL REFERENCES usuarios(id),
    alterado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_psh_pedido_id   ON pedido_status_historico(pedido_id);
CREATE INDEX idx_psh_alterado_em ON pedido_status_historico(alterado_em DESC);

COMMENT ON TABLE  pedido_status_historico               IS 'Histórico completo de mudanças de status de cada pedido. Imutável.';
COMMENT ON COLUMN pedido_status_historico.status_anterior IS 'NULL quando é o registro de criação do pedido.';

-- ============================================================
-- TABELA: audit_log
-- Registra todas as ações relevantes para fins de auditoria (RNF05).
-- ============================================================
CREATE TABLE audit_log (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id     UUID        REFERENCES usuarios(id),
    acao           VARCHAR(80) NOT NULL,
    tabela_afetada VARCHAR(80) NOT NULL,
    registro_id    UUID        NOT NULL,
    detalhe        TEXT,
    realizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_usuario      ON audit_log(usuario_id);
CREATE INDEX idx_audit_acao         ON audit_log(acao);
CREATE INDEX idx_audit_tabela       ON audit_log(tabela_afetada);
CREATE INDEX idx_audit_registro     ON audit_log(registro_id);
CREATE INDEX idx_audit_realizado_em ON audit_log(realizado_em DESC);

COMMENT ON TABLE  audit_log              IS 'Log de auditoria de todas as ações relevantes do sistema (RNF05).';
COMMENT ON COLUMN audit_log.acao         IS 'Ex: pedido_criado, item_cancelado, status_atualizado, usuario_desativado.';
COMMENT ON COLUMN audit_log.tabela_afetada IS 'Nome da tabela que sofreu alteração. Ex: pedidos, pedido_itens.';
COMMENT ON COLUMN audit_log.registro_id  IS 'ID do registro afetado na tabela correspondente.';

-- ============================================================
-- TRIGGER: marcar encerrado_em automaticamente ao encerrar pedido
-- ============================================================
CREATE OR REPLACE FUNCTION fn_marcar_encerrado_em()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'encerrado' AND OLD.status != 'encerrado' THEN
        NEW.encerrado_em = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedidos_encerrado_em
    BEFORE UPDATE ON pedidos
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_marcar_encerrado_em();

-- ============================================================
-- TRIGGER: sincronizar status da mesa ao encerrar pedido
-- ============================================================
CREATE OR REPLACE FUNCTION fn_sincronizar_mesa()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo = 'salao' AND NEW.mesa_id IS NOT NULL THEN
        IF NEW.status = 'encerrado' AND OLD.status != 'encerrado' THEN
            UPDATE mesas SET status = 'livre'   WHERE id = NEW.mesa_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedidos_sincronizar_mesa
    AFTER UPDATE ON pedidos
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_sincronizar_mesa();

-- ============================================================
-- TRIGGER: registrar mudança de status no audit_log (fallback)
-- A aplicação deve registrar, mas o trigger garante integridade.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_audit_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO audit_log (usuario_id, acao, tabela_afetada, registro_id, detalhe)
        VALUES (
            NEW.atendente_id,
            'status_atualizado',
            'pedidos',
            NEW.id,
            'status: ' || OLD.status::TEXT || ' -> ' || NEW.status::TEXT
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedidos_audit_status
    AFTER UPDATE ON pedidos
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_audit_status_change();

-- ============================================================
-- Seeds: Usuários iniciais
-- Senhas (bcrypt 12 rounds):
--   admin@pandora.com     → Admin@123
--   atendente@pandora.com → Atend@123
--   cozinha@pandora.com   → Cozi@123
-- ============================================================
INSERT INTO usuarios (id, nome, email, senha_hash, perfil) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'admin@pandora.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfWBPZD3W.GK6.HaG',
    'administrador'
),
(
    '00000000-0000-0000-0000-000000000002',
    'Atendente Padrão',
    'atendente@pandora.com',
    '$2b$12$eImiTXuWVxfM37uY4JANjOe5WhB7b4W6g5c1LdOkQ2zFYDl4J2fGe',
    'atendente'
),
(
    '00000000-0000-0000-0000-000000000003',
    'Cozinha',
    'cozinha@pandora.com',
    '$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p5ROL6CtP.2z8yCMFuYZuq',
    'cozinha'
);

-- ============================================================
-- Seeds: Mesas iniciais (10 mesas)
-- ============================================================
INSERT INTO mesas (numero) VALUES
('Mesa 1'),
('Mesa 2'),
('Mesa 3'),
('Mesa 4'),
('Mesa 5'),
('Mesa 6'),
('Mesa 7'),
('Mesa 8'),
('Mesa 9'),
('Mesa 10');

-- ============================================================
-- Seeds: Cardápio inicial (20 itens)
-- ============================================================
INSERT INTO cardapio_itens (nome, categoria) VALUES
-- Pratos Principais
('X-Burguer Clássico',   'prato_principal'),
('X-Bacon Duplo',        'prato_principal'),
('Frango Grelhado',      'prato_principal'),
('Parmegiana de Frango', 'prato_principal'),
('Filé Mignon Grelhado', 'prato_principal'),
('Salada Caesar',        'prato_principal'),
-- Bebidas
('Coca-Cola Lata',       'bebida'),
('Suco de Laranja',      'bebida'),
('Água Mineral',         'bebida'),
('Cerveja Artesanal',    'bebida'),
('Refrigerante 2L',      'bebida'),
('Milkshake',            'bebida'),
-- Sobremesas
('Pudim de Leite',       'sobremesa'),
('Petit Gateau',         'sobremesa'),
('Brownie com Sorvete',  'sobremesa'),
-- Adicionais
('Bacon Extra',          'adicional'),
('Queijo Extra',         'adicional'),
('Batata Frita P',       'adicional'),
('Batata Frita G',       'adicional'),
('Molho Especial',       'adicional');
