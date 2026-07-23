# 🍽️ Pandora — Sistema de Gestão de Pedidos

Sistema de gestão de pedidos para restaurante com atendimento em **Salão (Mesa)** e **Delivery**, com controle de acesso baseado em perfis (RBAC).

## 📦 Estrutura do Projeto

```
pandora/
├── backend/          → API REST Node.js/Express (→ Render)
├── frontend/         → SPA React 18 + Vite       (→ Vercel)
└── database/         → Migrations SQL PostgreSQL  (→ Neon.tech)
```

---

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 18+
- Banco PostgreSQL (local ou Neon.tech)

### 1. Banco de Dados (Neon.tech)
```sql
-- Execute na ordem:
\i database/migrations/001_initial_schema.sql
\i database/migrations/002_seeds.sql
```

### 2. Backend
```bash
cd backend
# Crie o arquivo .env com as variáveis necessárias (veja a seção Deploy)
npm install
npm run dev          # http://localhost:3001
```

### 3. Frontend
```bash
cd frontend
# Crie o arquivo .env com: VITE_API_URL=http://localhost:3001/api
npm install
npm run dev          # http://localhost:5173
```

---

## 👤 Usuários Iniciais (Seeds)

| Email | Senha | Perfil |
|---|---|---|
| `admin@pandora.com` | `Admin@123` | Administrador |
| `atendente@pandora.com` | `Atend@123` | Atendente |
| `cozinha@pandora.com` | `Cozi@123` | Cozinha |

> ⚠️ **Altere as senhas imediatamente após o primeiro login em produção!**

---

## 🔐 Controle de Acesso (RBAC)

| Funcionalidade | Admin | Atendente | Cozinha |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ❌ |
| Mesas | ✅ | ✅ | ❌ |
| Pedidos (criar/editar) | ✅ | ✅ | ❌ |
| Atualizar status | ✅ | ✅* | ✅** |
| Fila da Cozinha | ✅ | ❌ | ✅ |
| Cardápio (admin) | ✅ | ❌ | ❌ |
| Histórico | ✅ | ✅ | ❌ |
| Usuários | ✅ | ❌ | ❌ |

*Atendente: Pronto→Entregue→Encerrado | **Cozinha: Recebido→Em Preparo→Pronto

---

## 🔄 Fluxo de Status do Pedido

```
Recebido ──► Em Preparo ──► Pronto ──► Entregue ──► Encerrado
  [cozinha]    [cozinha]    [atend]    [atend]
```

---

## 🧪 Testes

```bash
cd backend

# Todos os testes
npm test

# Apenas unitários (JWT/RBAC)
npm run test:unit

# Apenas integração (fluxo de pedido + fila)
npm run test:integration
```

### Cobertura dos Testes
- **T01** — Fluxo completo de salão (27 steps mockados)
- **T02** — Segurança JWT: geração, expiração, 401, 403
- **T03** — Sincronização atendente→cozinha

---

## 🌐 Deploy

### Backend → Render
1. Crie um Web Service no Render
2. Build Command: `npm install`
3. Start Command: `node server.js`
4. Adicione as variáveis de ambiente:
   - `NODE_ENV=production`
   - `PORT=3001`
   - `DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`
   - `JWT_SECRET=<chave_secreta_longa>`
   - `JWT_EXPIRES_IN=8h`
   - `CORS_ORIGIN=<url_do_vercel>`

### Frontend → Vercel
1. Conecte o repositório ao Vercel
2. Root Directory: `frontend/`
3. Framework: Vite
4. Adicione `VITE_API_URL` apontando para a URL do Render

### Banco → Neon.tech
1. Crie um projeto PostgreSQL no Neon.tech
2. Execute as migrations no SQL Editor
3. Copie a connection string para `DATABASE_URL` no backend

---

## 📡 API Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login |
| GET | `/api/tables` | Listar mesas |
| GET | `/api/menu` | Listar cardápio |
| GET | `/api/orders` | Pedidos ativos |
| POST | `/api/orders` | Abrir pedido |
| POST | `/api/orders/:id/items` | Adicionar item |
| PATCH | `/api/orders/:id/items/:itemId` | Editar/cancelar item |
| PATCH | `/api/orders/:id/status` | Avançar status |
| GET | `/api/kitchen/queue` | Fila da cozinha |
| GET | `/api/history` | Histórico |
| GET/POST/PATCH/DELETE | `/api/users` | Usuários (Admin) |
| GET/POST/PATCH/DELETE | `/api/menu` | Cardápio (Admin) |

---

## 🏗️ Arquitetura Técnica

- **Soft Delete**: Nenhum dado é excluído permanentemente (`deleted_at`)
- **Auditoria**: Toda transição de status e edição de item é registrada com timestamp e responsável
- **Transações**: Operações críticas (abertura/encerramento de pedido) usam transações PostgreSQL
- **Segurança**: JWT (8h), bcrypt (12 rounds), Helmet, CORS configurado
- **Timeout de Inatividade**: Sessão encerra após 30min sem interação
