# 📋 CHANGELOG — Pandora · Sistema de Gestão de Pedidos

Todas as melhorias, correções e novidades do sistema são registradas aqui.
O formato segue: `[DATA] — Tipo: Descrição`.

---

## [2026-07-16] — Sessão de Melhorias e Correções

### 🐛 Correções de Bug

- **[FIX] URL da API apontava para localhost em produção**
  - O arquivo `.env.production` do frontend havia sido alterado para `http://localhost:3001/api` durante testes locais e subiu para o GitHub Pages assim, impedindo qualquer conexão com o backend no Render.
  - Corrigido para `https://pandora-vtbz.onrender.com/api`.

- **[FIX] CORS bloqueando requisições do GitHub Pages**
  - A variável de ambiente `CORS_ORIGIN` no Render estava configurada como `http://localhost:5173`, bloqueando todas as requisições vindas de `mateus-campos-cruz.github.io`.
  - Solução: atualizar `CORS_ORIGIN` para `https://mateus-campos-cruz.github.io` no painel do Render.

- **[FIX] INSERT inválido no `audit_log` durante o polling**
  - O endpoint `GET /api/pedidos/atualizacoes` tentava fazer um `INSERT` na tabela `audit_log` omitindo as colunas `tabela_afetada` e `registro_id`, que são `NOT NULL`. Isso causaria erro 500 em toda chamada de polling.
  - Corrigido: o INSERT foi removido, pois polling é uma leitura e não deve gerar registro de auditoria.
  - Arquivo: `backend/src/controllers/orders.controller.js`

- **[FIX] TypeError ao avançar status do pedido sem body**
  - A rota `PATCH /api/orders/:id/status` falhava com TypeError quando chamada sem corpo (`body`) na requisição.
  - Corrigido com destructuring seguro: `const { status, notes } = req.body || {}`.
  - Arquivo: `backend/src/controllers/orders.controller.js`

### ✨ Novas Funcionalidades

- **[FEAT] Atualização em tempo real — Polling automático**
  - Implementado hook `usePolling` que consulta o endpoint `/pedidos/atualizacoes` a cada 10 segundos.
  - A página de Pedidos e a Cozinha atualizam automaticamente sem precisar de refresh manual.
  - Indicador visual de conexão (ponto verde "Ao vivo" / vermelho "Sem conexão") nas páginas de Pedidos e Cozinha.
  - Alerta sonoro (beep) quando um pedido muda para o status `pronto`.
  - Campo `atualizado_em` adicionado à tabela `pedidos` com trigger automático no banco (migration `005`).
  - Arquivos: `frontend/src/hooks/usePolling.js`, `frontend/src/pages/Orders/index.jsx`, `frontend/src/pages/Kitchen/index.jsx`, `backend/src/controllers/orders.controller.js`, `database/migrations/005_add_atualizado_em.sql`

- **[FEAT] Cozinha exibe apenas itens de preparo (sem bebidas)**
  - A fila da cozinha filtra e exibe somente categorias que precisam de preparo: `prato_principal`, `sobremesa` e `adicional`.
  - Bebidas (`bebida`) são excluídas tanto no SQL do backend quanto no frontend.
  - O campo `categoria` foi adicionado ao payload do polling para permitir o filtro no frontend.
  - Arquivos: `backend/src/controllers/kitchen.controller.js`, `backend/src/controllers/orders.controller.js`, `frontend/src/pages/Kitchen/index.jsx`

- **[FEAT] Bloqueio de início de preparo sem itens no pedido**
  - A transição de status `recebido → em_preparo` valida se o pedido possui pelo menos 1 item ativo (não cancelado).
  - Retorna erro `400`: *"Não é possível iniciar o preparo: o pedido não possui nenhum item."*
  - Arquivo: `backend/src/controllers/orders.controller.js`

- **[FEAT] Proteção contra duplo clique em todos os botões de ação**
  - Todos os botões que disparam chamadas de API são desabilitados enquanto a requisição está em andamento.
  - Páginas cobertas: Login, Novo Pedido, Detalhe do Pedido, Cozinha, Cardápio e Usuários.
  - Botões exibem texto de carregamento (ex: `Salvando...`, `Atualizando...`, `...`) durante a espera.
  - Arquivos: `frontend/src/pages/Menu/index.jsx`, `frontend/src/pages/Users/index.jsx`

### 🎨 Melhorias Visuais

- **[STYLE] Tema de cores marrom/dourado**
  - Paleta de cores atualizada para tons de marrom e dourado, dando identidade visual ao sistema.

- **[STYLE] Itens de pedido com fundo amarelo e fonte preta**
  - Estilo aplicado nos cards de itens da Cozinha e no detalhe do pedido para melhor contraste e legibilidade.

- **[STYLE] Badge "PRONTO PARA ENTREGAR"**
  - Na página de Pedidos, pedidos com status `pronto` exibem um badge pulsante de destaque para alertar o atendente.

---

## [2026-07-13] — Funcionalidades e Correções

- **[FEAT] Suporte a preço e descrição no cardápio**
  - Campos `preco` e `descricao` adicionados à tabela `cardapio_itens` via migration `004`.
  - O cardápio agora exibe e permite editar preço e descrição dos itens.
  - Arquivo: `database/migrations/004_add_price_to_schema.sql`

- **[FIX] Queries do banco adaptadas ao schema em Português**
  - Queries e mapeamentos de perfil de usuário corrigidos para usar os nomes do schema refatorado (`usuarios`, `perfil`, `administrador`, etc.).

- **[FIX] Deploy configurado para GitHub Pages**
  - `vite.config.js` configurado com `base: '/pandora/'`.
  - Script `deploy` adicionado ao `package.json` usando `gh-pages`.

---

## [2026-06-26] — Commit Inicial

- **[FEAT] Sistema Pandora — versão inicial**
  - Backend Node.js/Express com autenticação JWT (login, middleware de autenticação e autorização por perfil).
  - Rotas para: pedidos, mesas, cardápio, cozinha, usuários e histórico.
  - Frontend React com páginas de: Login, Dashboard, Pedidos, Detalhe do Pedido, Novo Pedido, Cozinha, Cardápio, Mesas e Usuários.
  - Banco de dados PostgreSQL (Neon.tech) com schema completo, triggers e seeds iniciais com 3 usuários e 20 itens de cardápio.
  - Deploy: frontend no GitHub Pages (`mateus-campos-cruz.github.io/pandora`), backend no Render (`pandora-vtbz.onrender.com`).

---

> 📝 **Como manter este arquivo:**
> A cada nova melhoria, correção ou funcionalidade implementada, adicione uma entrada na seção da data correspondente (ou crie uma nova seção) seguindo o padrão:
>
> ```
> - **[TIPO] Título da melhoria**
>   - Descrição do problema ou da funcionalidade.
>   - O que foi feito para resolver/implementar.
>   - Arquivo(s): `caminho/do/arquivo.js`
> ```
>
> Tipos: `[FEAT]` = nova funcionalidade · `[FIX]` = correção de bug · `[STYLE]` = melhoria visual · `[PERF]` = performance · `[REFACTOR]` = refatoração
