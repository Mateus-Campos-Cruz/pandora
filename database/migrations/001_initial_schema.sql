-- ============================================================
-- Sistema de Gestão de Pedidos — Schema Inicial
-- Neon.tech PostgreSQL
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM Types
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'atendente', 'cozinha');
CREATE TYPE table_status AS ENUM ('livre', 'ocupada');
CREATE TYPE menu_category AS ENUM ('prato_principal', 'bebida', 'sobremesa', 'adicional');
CREATE TYPE order_type AS ENUM ('salao', 'delivery');
CREATE TYPE order_status AS ENUM ('recebido', 'em_preparo', 'pronto', 'entregue', 'encerrado');
CREATE TYPE item_action AS ENUM ('edit', 'cancel');

-- ============================================================
-- TABELA: users
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(150)  NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role        user_role     NOT NULL DEFAULT 'atendente',
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ   -- soft delete
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- ============================================================
-- TABELA: tables (mesas)
-- ============================================================
CREATE TABLE tables (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier  VARCHAR(50)   NOT NULL UNIQUE,   -- ex: "Mesa 1"
    status      table_status  NOT NULL DEFAULT 'livre',
    capacity    SMALLINT      NOT NULL DEFAULT 4,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ   -- soft delete
);

CREATE INDEX idx_tables_status ON tables(status) WHERE deleted_at IS NULL;

-- ============================================================
-- TABELA: menu_items (cardápio)
-- ============================================================
CREATE TABLE menu_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150)  NOT NULL,
    category    menu_category NOT NULL,
    price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ   -- soft delete
);

CREATE INDEX idx_menu_items_active ON menu_items(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- TABELA: orders (pedidos)
-- ============================================================
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type             order_type    NOT NULL,
    status           order_status  NOT NULL DEFAULT 'recebido',

    -- Salão
    table_id         UUID REFERENCES tables(id),

    -- Delivery
    customer_name    VARCHAR(100),
    customer_phone   VARCHAR(20),
    customer_address TEXT,

    -- Controle
    attendant_id     UUID NOT NULL REFERENCES users(id),
    opened_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    closed_at        TIMESTAMPTZ,
    notes            TEXT,

    -- Soft delete
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_salao_requires_table
        CHECK (type != 'salao' OR table_id IS NOT NULL),
    CONSTRAINT chk_delivery_requires_customer
        CHECK (type != 'delivery' OR (
            customer_name IS NOT NULL AND
            customer_phone IS NOT NULL AND
            customer_address IS NOT NULL
        ))
);

CREATE INDEX idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_table_id ON orders(table_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_type ON orders(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_opened_at ON orders(opened_at DESC) WHERE deleted_at IS NULL;

-- ============================================================
-- TABELA: order_items (itens do pedido)
-- ============================================================
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    menu_item_id    UUID NOT NULL REFERENCES menu_items(id),
    quantity        SMALLINT      NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10,2) NOT NULL,  -- snapshot do preço no momento do pedido
    observation     TEXT,
    is_cancelled    BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- TABELA: order_status_log (auditoria de transições)
-- ============================================================
CREATE TABLE order_status_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id),
    from_status         order_status,           -- NULL na criação
    to_status           order_status  NOT NULL,
    changed_by_user_id  UUID NOT NULL REFERENCES users(id),
    changed_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    notes               TEXT
);

CREATE INDEX idx_status_log_order_id ON order_status_log(order_id);

-- ============================================================
-- TABELA: item_edit_log (auditoria de edições de itens)
-- ============================================================
CREATE TABLE item_edit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id       UUID NOT NULL REFERENCES order_items(id),
    action              item_action   NOT NULL,
    justification       TEXT          NOT NULL,
    performed_by_user_id UUID NOT NULL REFERENCES users(id),
    performed_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    previous_quantity   SMALLINT,
    new_quantity        SMALLINT,
    previous_observation TEXT,
    new_observation     TEXT
);

CREATE INDEX idx_item_edit_log_order_item ON item_edit_log(order_item_id);

-- ============================================================
-- FUNÇÃO: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tables_updated_at
    BEFORE UPDATE ON tables
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- CONSTRAINTS: Impedir múltiplos pedidos ativos na mesma mesa
-- ============================================================
CREATE UNIQUE INDEX idx_one_active_order_per_table
    ON orders(table_id)
    WHERE deleted_at IS NULL
      AND status NOT IN ('entregue', 'encerrado')
      AND table_id IS NOT NULL;
