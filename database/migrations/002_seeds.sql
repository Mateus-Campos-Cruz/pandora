-- ============================================================
-- Seeds Iniciais — Dados de Exemplo
-- ATENÇÃO: Executar APÓS 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- USUÁRIOS INICIAIS
-- Senhas (bcrypt hash de 12 rounds):
--   admin@pandora.com    → senha: Admin@123
--   atendente@pandora.com → senha: Atend@123
--   cozinha@pandora.com  → senha: Cozi@123
-- ============================================================
INSERT INTO users (id, name, email, password_hash, role) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'Administrador',
    'admin@pandora.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfWBPZD3W.GK6.HaG',
    'admin'
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
-- MESAS (10 mesas iniciais)
-- ============================================================
INSERT INTO tables (identifier, capacity) VALUES
('Mesa 1',  4),
('Mesa 2',  4),
('Mesa 3',  6),
('Mesa 4',  6),
('Mesa 5',  2),
('Mesa 6',  2),
('Mesa 7',  8),
('Mesa 8',  4),
('Mesa 9',  4),
('Mesa 10', 10);

-- ============================================================
-- CARDÁPIO INICIAL
-- ============================================================

-- Pratos Principais
INSERT INTO menu_items (name, category, price, description) VALUES
('X-Burguer Clássico',    'prato_principal', 28.90, 'Hambúrguer artesanal, queijo, alface e tomate'),
('X-Bacon Duplo',         'prato_principal', 35.90, 'Hambúrguer duplo com bacon crocante e queijo cheddar'),
('Frango Grelhado',       'prato_principal', 26.50, 'Peito de frango grelhado com ervas finas'),
('Parmegiana de Frango',  'prato_principal', 32.00, 'Frango empanado com molho de tomate e queijo gratinado'),
('Filé Mignon Grelhado',  'prato_principal', 52.00, 'Filé mignon ao ponto com batatas rústicas'),
('Salada Caesar',         'prato_principal', 22.90, 'Alface romana, croutons, parmesão e molho caesar'),

-- Bebidas
('Coca-Cola Lata',        'bebida', 6.00,  'Refrigerante gelado 350ml'),
('Suco de Laranja',       'bebida', 9.00,  'Suco natural 300ml'),
('Água Mineral',          'bebida', 4.00,  'Água sem gás 500ml'),
('Cerveja Artesanal',     'bebida', 14.00, 'Cerveja artesanal 330ml'),
('Refrigerante 2L',       'bebida', 12.00, 'Coca-Cola, Guaraná ou Sprite'),
('Milkshake',             'bebida', 16.00, 'Chocolate, Morango ou Baunilha 400ml'),

-- Sobremesas
('Pudim de Leite',        'sobremesa', 11.00, 'Pudim cremoso com calda de caramelo'),
('Petit Gateau',          'sobremesa', 16.00, 'Bolinho quente de chocolate com sorvete'),
('Brownie com Sorvete',   'sobremesa', 14.00, 'Brownie caseiro com sorvete de creme'),

-- Adicionais
('Bacon Extra',           'adicional', 4.00,  'Porção de bacon crocante'),
('Queijo Extra',          'adicional', 3.00,  'Fatia adicional de queijo'),
('Batata Frita P',        'adicional', 8.00,  'Porção pequena de batatas fritas crocantes'),
('Batata Frita G',        'adicional', 14.00, 'Porção grande de batatas fritas crocantes'),
('Molho Especial',        'adicional', 2.50,  'Molho da casa');
