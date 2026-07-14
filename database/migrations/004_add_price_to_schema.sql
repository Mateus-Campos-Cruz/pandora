-- ============================================================
-- Migration 004 — Correção: Adicionando preços e descrições
-- ============================================================

-- Adiciona colunas ao cardápio
ALTER TABLE cardapio_itens ADD COLUMN IF NOT EXISTS preco NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE cardapio_itens ADD COLUMN IF NOT EXISTS descricao TEXT;

-- Adiciona coluna ao pedido_itens para guardar snapshot do preço
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- Atualizar preços dos itens de seed (opcional, para testes fazer sentido)
UPDATE cardapio_itens SET preco = 28.90 WHERE nome = 'X-Burguer Clássico';
UPDATE cardapio_itens SET preco = 35.50 WHERE nome = 'X-Bacon Duplo';
UPDATE cardapio_itens SET preco = 30.00 WHERE nome = 'Frango Grelhado';
UPDATE cardapio_itens SET preco = 45.00 WHERE nome = 'Parmegiana de Frango';
UPDATE cardapio_itens SET preco = 55.00 WHERE nome = 'Filé Mignon Grelhado';
UPDATE cardapio_itens SET preco = 22.00 WHERE nome = 'Salada Caesar';
UPDATE cardapio_itens SET preco = 6.00  WHERE nome = 'Coca-Cola Lata';
UPDATE cardapio_itens SET preco = 12.00 WHERE nome = 'Cerveja Artesanal';
