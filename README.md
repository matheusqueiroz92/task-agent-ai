# Task Agent AI

Backend de chatbot inteligente com **RAG** (Retrieval-Augmented Generation) para o portfólio [matheusqueiroz.dev.br](https://matheusqueiroz.dev.br). Permite que visitantes façam perguntas sobre Matheus Queiroz, projetos, tecnologias, serviços, experiência e currículo — com respostas fundamentadas em documentos curados, não em conhecimento genérico do modelo.

A aplicação também expõe um endpoint de demonstração de agente com ferramentas matemáticas (`/api/math`), útil como referência de integração com LangChain.

---

## Índice

- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Stack tecnológica](#stack-tecnológica)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados (pgvector)](#banco-de-dados-pgvector)
- [Base de conhecimento](#base-de-conhecimento)
- [Indexação RAG](#indexação-rag)
- [API REST](#api-rest)
- [Integração com o frontend](#integração-com-o-frontend)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Desenvolvimento](#desenvolvimento)
- [Produção](#produção)
- [Solução de problemas](#solução-de-problemas)

---

## Funcionalidades

### Chatbot RAG (`POST /api/rag`)

- Agente LangChain com modelo OpenAI (`gpt-4o-mini` por padrão) e temperatura `0`.
- Tool `buscar_documentos` que consulta o vector store **antes** de cada resposta, garantindo respostas *grounded* nos documentos.
- Busca semântica com **pgvector** (PostgreSQL) e embeddings `text-embedding-3-small` (1536 dimensões).
- Estratégias de busca avançadas:
  - **MMR** (Maximal Marginal Relevance) para diversidade de resultados.
  - **Limiar de similaridade** (`0.75`) para filtrar trechos pouco relevantes.
  - **Deduplicação por fonte** (máximo de 2 trechos por arquivo).
  - **Filtro por projeto** via `project_slug` quando a pergunta é sobre um projeto específico.
- Respostas em português, com fallback de contato quando a informação não está nos documentos.
- **Rate limiting** configurável no endpoint RAG.
- **CORS** restrito ao domínio do portfólio (com suporte a `localhost` em desenvolvimento).

### Agente matemático (`POST /api/math`)

- Agente de demonstração com tools `somar` e `subtrair`.
- Resolve operações simples de adição e subtração via LangChain.

### Health check (`GET /health`)

- Retorna `{ "status": "ok" }` para monitoramento e load balancers.

### Pipeline de indexação (CLI)

- Carrega PDFs, TXT e MD de `data/pdfs/` e `data/projects/`.
- Divide documentos em trechos com splitters distintos para perfil/FAQ e projetos.
- Indexa no pgvector com metadados (`category`, `project_slug`, `project_name`, `source`).
- Recria o índice a cada execução (truncate + reindexação completa).
- Cria índice **HNSW** para buscas vetoriais mais rápidas.

---

## Arquitetura

```
┌─────────────────┐     POST /api/rag      ┌──────────────────┐
│  Frontend       │ ───────────────────────► │  Fastify API     │
│  (portfólio)    │ ◄─────────────────────── │  rag.routes.ts   │
└─────────────────┘     { resposta }         └────────┬─────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │  rag.service.ts  │
                                            │  Agente LangChain│
                                            └────────┬─────────┘
                                                      │ tool call
                                                      ▼
                                            ┌──────────────────┐
                                            │  rag.tools.ts    │
                                            │ buscar_documentos│
                                            └────────┬─────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │  search.ts       │
                                            │  MMR + threshold │
                                            └────────┬─────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │  PGVectorStore   │
                                            │  (PostgreSQL)    │
                                            └──────────────────┘

Indexação (offline):
  data/pdfs/ + data/projects/
        → load-documents → split-documents → vectorstore.addDocuments()
```

**Decisão de design:** a indexação roda via CLI (`npm run rag:index`), não a cada requisição. Isso reduz custo de embeddings, latência na API e mantém o vector store estável entre deploys.

---

## Stack tecnológica

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js, TypeScript |
| HTTP | Fastify 5 |
| IA / Agentes | LangChain, OpenAI API |
| Embeddings | `text-embedding-3-small` |
| Vector store | `@langchain/pgvector` + PostgreSQL |
| PDF | `pdf-parse` |
| Validação | Zod |
| Segurança | `@fastify/cors`, `@fastify/rate-limit` |

---

## Pré-requisitos

- **Node.js** 18+ (recomendado 20+)
- **PostgreSQL** com extensão **pgvector** habilitada  
  Provedores compatíveis: [Neon](https://neon.tech), [Supabase](https://supabase.com), ou Postgres self-hosted com `CREATE EXTENSION vector;`
- **Chave da OpenAI API** com acesso a chat completions e embeddings

---

## Instalação

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd task-agent-ai

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 4. Valide os documentos locais (opcional)
npm run rag:validate

# 5. Indexe a base de conhecimento no pgvector
npm run rag:index

# 6. Inicie o servidor
npm run dev
```

O servidor sobe em `http://0.0.0.0:3344` por padrão. Na inicialização, se o vector store estiver vazio, um aviso será exibido no console pedindo para executar `npm run rag:index`.

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores:

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `OPENAI_API_KEY` | Sim | — | Chave da API OpenAI |
| `OPENAI_MODEL` | Não | `gpt-4o-mini` | Modelo de chat usado pelos agentes |
| `DATABASE_URL` | Sim | — | Connection string PostgreSQL (`?sslmode=require` em cloud) |
| `DATABASE_SSL` | Não | `true` | Habilita SSL na conexão (`true` / `false`) |
| `RAG_COLLECTION` | Não | `portfolio-matheus` | Nome da coleção no pgvector |
| `RAG_TABLE_NAME` | Não | `rag_documents` | Tabela de vetores (apenas `a-z`, `0-9`, `_`) |
| `PORT` | Não | `3344` | Porta HTTP do servidor |
| `HOST` | Não | `0.0.0.0` | Host de bind |
| `NODE_ENV` | Não | `development` | `development` ou `production` |
| `CORS_ORIGINS` | Não | domínios do portfólio | Origens permitidas, separadas por vírgula |
| `RATE_LIMIT_MAX` | Não | `20` | Máximo de requisições por janela no `/api/rag` |
| `RATE_LIMIT_TIME_WINDOW` | Não | `1 minute` | Janela do rate limit (formato `@fastify/rate-limit`) |

Em **desenvolvimento**, além das origens configuradas em `CORS_ORIGINS`, requisições de `http://localhost:*` são aceitas automaticamente.

---

## Banco de dados (pgvector)

### Habilitar a extensão

Em um banco PostgreSQL novo, execute:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Neon e Supabase já oferecem pgvector na maioria dos planos.

### Tabelas

Na primeira indexação (`npm run rag:index`), o LangChain cria automaticamente:

- `rag_documents` — vetores, conteúdo e metadados (nome configurável via `RAG_TABLE_NAME`)
- `langchain_collections` — registro de coleções

Um índice **HNSW** é criado após a indexação para acelerar buscas por similaridade de cosseno.

### Connection string

Exemplo para Neon/Supabase:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
DATABASE_SSL=true
```

---

## Base de conhecimento

Os documentos ficam em duas pastas:

```
data/
├── pdfs/          # Perfil, FAQ, serviços, currículo (PDF/TXT/MD)
└── projects/      # Descrição detalhada de cada projeto
```

### Formatos suportados

- `.pdf` — páginas extraídas individualmente (ex.: currículo)
- `.txt` / `.md` — texto plano ou markdown

### Categorias inferidas (`data/pdfs/`)

O nome do arquivo define a categoria automaticamente:

| Padrão no nome | Categoria |
|----------------|-----------|
| `curriculo*` | `curriculo` |
| `info-faq*` | `faq` |
| `info-servicos*`, `info-projects*` | `servico` |
| `projeto-*` | `projeto` |
| `info-matheus*`, `info-experiencia*`, etc. | `perfil` |
| Outros | `geral` |

### Arquivos de projeto (`data/projects/`)

Arquivos como `projeto-task-agent-ai.txt` suportam **frontmatter** antes do corpo markdown:

```text
slug: task-agent-ai
categoria: projeto
project_name: Task Agent AI

## O que é
Descrição do projeto...
```

Campos reconhecidos no frontmatter:

- `slug` → `project_slug` nos metadados
- `categoria` / `category` → categoria do documento
- `project_name` → nome legível do projeto

Se `slug` não for informado, é derivado do nome do arquivo (`projeto-oticas-queiroz.txt` → `oticas-queiroz`).

### Projetos com busca filtrada

Slugs disponíveis para filtro na tool `buscar_documentos`:

| Slug | Projeto |
|------|---------|
| `oticas-queiroz` | Sistema Óticas Queiroz |
| `m-agendy` | M.Agendy |
| `m-finnanceai` | M.FinnanceAI |
| `task-agent-ai` | Este chatbot |

### Currículo em PDF

Adicione `curriculo-matheus-queiroz.pdf` em `data/pdfs/`. O comando `npm run rag:validate` avisa se nenhum documento de categoria `curriculo` for encontrado.

---

## Indexação RAG

### Validar documentos (sem indexar)

```bash
npm run rag:validate
```

Lista quantos trechos serão gerados por arquivo, categorias e slugs detectados.

### Indexar no pgvector

```bash
npm run rag:index
```

Fluxo executado:

1. Carrega todos os arquivos de `data/pdfs/` e `data/projects/`
2. Divide em chunks:
   - Documentos gerais: `RecursiveCharacterTextSplitter` (500 chars, overlap 50)
   - Projetos: `MarkdownTextSplitter` (900 chars, overlap 100)
3. Limpa a tabela de vetores (`TRUNCATE`)
4. Gera embeddings e insere no pgvector
5. Cria índice HNSW

**Importante:** execute `rag:index` sempre que adicionar, remover ou alterar arquivos em `data/`. Em produção, inclua esse passo no pipeline de deploy ou rode manualmente após atualizar a base.

---

## API REST

Base URL padrão: `http://localhost:3344`

### `GET /health`

Verifica se o servidor está no ar.

**Resposta (200):**

```json
{ "status": "ok" }
```

---

### `POST /api/rag`

Pergunta ao chatbot sobre Matheus Queiroz, projetos, serviços, etc.

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "input": "Quais tecnologias o Matheus usa em projetos fullstack?"
}
```

**Resposta de sucesso (200):**

```json
{
  "resposta": "Com base nos documentos, Matheus trabalha com..."
}
```

**Erros:**

| Status | Condição |
|--------|----------|
| `400` | Campo `input` vazio ou ausente |
| `429` | Rate limit excedido |
| `502` | Falha ao consultar documentos ou OpenAI |

**Exemplo com cURL:**

```bash
curl -X POST http://localhost:3344/api/rag \
  -H "Content-Type: application/json" \
  -d "{\"input\": \"Me fale sobre o projeto M.Agendy\"}"
```

---

### `POST /api/math`

Agente de demonstração para operações matemáticas simples.

**Body:**

```json
{
  "input": "Quanto é 15 + 27?"
}
```

**Resposta de sucesso (200):**

```json
{
  "resposta": "42"
}
```

**Erros:** `400` (input vazio), `502` (falha no agente).

---

## Integração com o frontend

O chatbot do portfólio consome `POST /api/rag`. Exemplo em JavaScript:

```javascript
async function perguntarAoChatbot(pergunta) {
  const response = await fetch("https://sua-api.exemplo.com/api/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: pergunta }),
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status}`);
  }

  const data = await response.json();
  return data.resposta;
}
```

### CORS

Configure `CORS_ORIGINS` com os domínios do site que farão requisições:

```env
CORS_ORIGINS=https://matheusqueiroz.dev.br,https://www.matheusqueiroz.dev.br
```

Métodos permitidos: `GET`, `POST`, `OPTIONS`.

### Rate limiting

O endpoint `/api/rag` está protegido por rate limit (padrão: 20 requisições por minuto por IP). Ajuste conforme o tráfego esperado:

```env
RATE_LIMIT_MAX=30
RATE_LIMIT_TIME_WINDOW=1 minute
```

### Boas práticas

- Exiba um indicador de carregamento — respostas podem levar alguns segundos (busca + LLM).
- Trate `429` com mensagem amigável pedindo para aguardar.
- Não exponha `OPENAI_API_KEY` no frontend; toda comunicação com a OpenAI ocorre no backend.

---

## Scripts disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| Desenvolvimento | `npm run dev` | Servidor com hot-reload (`tsx watch`) |
| Build | `npm run build` | Compila TypeScript para `dist/` |
| Produção | `npm start` | Executa `dist/server.js` |
| Lint | `npm run lint` | ESLint no código-fonte |
| Lint fix | `npm run lint:fix` | Corrige problemas automáticos |
| Typecheck | `npm run typecheck` | Verificação de tipos sem emitir arquivos |
| Validar docs | `npm run rag:validate` | Lista documentos carregados da pasta `data/` |
| Indexar RAG | `npm run rag:index` | Reindexa toda a base no pgvector |

---

## Estrutura do projeto

```
task-agent-ai/
├── data/
│   ├── pdfs/                 # Documentos de perfil, FAQ, serviços
│   └── projects/             # Um arquivo por projeto do portfólio
├── src/
│   ├── app.ts                # Factory Fastify (CORS, rotas)
│   ├── server.ts             # Bootstrap e listen
│   ├── config/
│   │   └── env.ts            # Validação de env com Zod
│   ├── routes/
│   │   ├── rag.routes.ts     # POST /api/rag + rate limit
│   │   └── math.routes.ts    # POST /api/math, GET /health
│   ├── services/
│   │   ├── rag.service.ts    # Agente RAG + system prompt
│   │   └── math.service.ts   # Agente matemático
│   ├── tools/
│   │   ├── rag.tools.ts      # Tool buscar_documentos
│   │   └── math.tools.ts     # Tools somar / subtrair
│   └── rag/
│       ├── load-documents.ts # Leitura PDF/TXT/MD + metadados
│       ├── split-documents.ts# Chunking por tipo de documento
│       ├── vectorstore.ts    # PGVectorStore, pool, HNSW
│       ├── search.ts         # MMR, threshold, filtro por projeto
│       ├── index-documents.ts# CLI de indexação
│       └── validate-documents.ts
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Desenvolvimento

```bash
# Terminal 1 — servidor
npm run dev

# Terminal 2 — após alterar documentos
npm run rag:index
```

### Parâmetros de busca (`src/rag/search.ts`)

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `generalK` | 8 | Trechos retornados na busca geral |
| `fetchK` | 20 | Candidatos antes do MMR |
| `lambda` | 0.7 | Balanceamento relevância vs. diversidade (MMR) |
| `similarityThreshold` | 0.75 | Score mínimo na busca por projeto |
| `projectK` | 6 | Trechos na busca filtrada por projeto |
| `maxChunksPerSource` | 2 | Máximo de trechos por arquivo fonte |

### Adicionar um novo projeto

1. Crie `data/projects/projeto-meu-projeto.txt` com frontmatter (`slug`, `project_name`).
2. Adicione o slug em `PROJECT_SLUGS` em `src/tools/rag.tools.ts`.
3. Atualize o system prompt em `src/services/rag.service.ts` se necessário.
4. Execute `npm run rag:index`.

---

## Produção

```bash
npm run build
NODE_ENV=production npm start
```

Recomendações:

- Use `NODE_ENV=production` (logs JSON via Pino, sem `pino-pretty`).
- Configure `CORS_ORIGINS` apenas com domínios reais do portfólio.
- Mantenha `DATABASE_SSL=true` em bancos gerenciados.
- Rode `npm run rag:index` no deploy quando a base de conhecimento mudar.
- Coloque um reverse proxy (Nginx, Caddy, Cloudflare) com HTTPS na frente da API.
- Monitore `GET /health` para uptime.

---

## Solução de problemas

### Aviso: nenhum documento indexado no pgvector

O vector store está vazio. Verifique `DATABASE_URL` e execute:

```bash
npm run rag:index
```

### Erro de conexão com PostgreSQL

- Confirme que a extensão `vector` está habilitada.
- Em Neon/Supabase, use `?sslmode=require` na URL e `DATABASE_SSL=true`.
- Teste a connection string com um cliente SQL.

### Respostas genéricas ou imprecisas

- Confirme que `rag:index` foi executado após a última alteração em `data/`.
- Verifique se o conteúdo relevante existe nos arquivos de `data/pdfs/` ou `data/projects/`.
- Para perguntas sobre um projeto específico, o agente deve passar `project_slug` na tool — isso depende do modelo seguir o system prompt.

### `429 Too Many Requests`

Rate limit atingido. Aguarde a janela configurada em `RATE_LIMIT_TIME_WINDOW` ou aumente `RATE_LIMIT_MAX`.

### Erro CORS no navegador

- Adicione a origem do frontend em `CORS_ORIGINS`.
- Em desenvolvimento local, origens `http://localhost:*` são liberadas automaticamente.

### `OPENAI_API_KEY é obrigatória`

A variável não está definida ou o `.env` não foi carregado. Confirme o arquivo `.env` na raiz do projeto.

---

## Licença

ISC

---

## Autor

**Matheus Queiroz** — [matheusqueiroz.dev.br](https://matheusqueiroz.dev.br) · [GitHub](https://github.com/matheusqueiroz92)

Desenvolvido na **AZ Work Center**.
