# VoiceCart Shopify Assistant

VoiceCart is a Shopify app that brings an AI sales assistant to your storefront. The Remix-based admin app helps merchants generate a product catalog, build vector embeddings, and configure languages, while the theme extension exposes a voice-first shopping experience that can search, recommend, and manage the cart on behalf of customers. The project is designed to run alongside an external machine-learning service for embeddings and the OpenAI Chat Completions API.

## Features

- **Admin dashboard for data prep** – Trigger long-running jobs that download the product catalog from Shopify, save it as Parquet, and send it to the ML service for embedding generation or deletion. Track task progress directly in the UI. 【F:app/routes/app._index.jsx†L1-L204】
- **Shop description prompt generation** – Collect store metadata, build a rich store prompt with OpenAI, and persist it for contextual chat experiences. 【F:app/routes/api.generate-prompt.jsx†L1-L71】
- **Multilingual storefront assistant** – Serve an interactive voice/chat widget that understands multiple locales, retrieves products from the embedding service, and can add/remove items from the customer cart. 【F:extensions/my-app-block/blocks/app-window.liquid†L1-L210】【F:app/routes/assistant.jsx†L1-L204】
- **Conversation memory with Prisma** – Persist chats, threads, prompts, tasks, and language preferences in PostgreSQL via Prisma. 【F:prisma/schema.prisma†L1-L58】【F:app/db.server.js†L1-L74】
- **Extensible AI intent system** – Route customer queries through configurable GPT intent handlers for greetings, product discovery, cart management, and checkout flows. 【F:app/utils/connectors/gptHandlers.js†L1-L240】

## Architecture

```
.
├── app/                    # Remix application source
│   ├── routes/             # Admin UI, API endpoints, assistant handler
│   ├── utils/              # Shopify fetchers, GPT connectors, embeddings clients
│   ├── db.server.js        # Prisma helpers for tasks, prompts, languages, chats
│   └── shopify.server.js   # Shopify App Bridge & auth configuration
├── extensions/my-app-block # Theme app extension with voice assistant widget
├── prisma/schema.prisma    # PostgreSQL models for sessions, chats, tasks, etc.
├── public/                 # Static assets served by Remix
├── docker-compose.yml      # Production-style container runner for the app
└── package.json            # Scripts and dependencies
```

The Remix app uses [`@shopify/shopify-app-remix`](https://www.npmjs.com/package/@shopify/shopify-app-remix) for OAuth and session handling, Prisma for persistence, and Polaris/App Bridge for embedded admin UI. The storefront extension is a Theme App Extension that injects a custom chat/voice interface and communicates with the Remix backend through authenticated fetchers.

## Prerequisites

- Node.js **18.20+** or **20.10+** (see `engines` in `package.json`).
- Shopify Partner account with a development store.
- PostgreSQL database for Prisma models (`DATABASE_URL`).
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) v3+ for local development.
- OpenAI API key for chat completions (`OPENAI_API_KEY`).
- ML service exposing `/create_embeddings`, `/delete_embeddings`, and `/query_embedding` endpoints (defaults to `http://ml-api:5556`). 【F:app/utils/createEmbedding.server.js†L61-L116】【F:app/utils/deleteEmbedding.server.js†L1-L34】【F:app/utils/connectors/embedingConnector.js†L1-L29】

## Environment variables

Create a `.env` file (or use Shopify CLI environment management) with the following variables:

```
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=https://your-app-tunnel.ngrok.app
SCOPES=read_products,write_products,read_customers
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
OPENAI_API_KEY=sk-...
ML_SERVER_URL=http://ml-api:5556
SHOP_CUSTOM_DOMAIN= # optional custom domain for OAuth callbacks
```

The Remix and Vite configs also respect `HOST`, `PORT`, and `FRONTEND_PORT` for advanced setups. 【F:vite.config.js†L9-L41】【F:remix.config.js†L1-L31】

## Installation

```bash
# Clone and install dependencies
npm install

# Generate Prisma client and apply schema
npm run setup   # runs `prisma generate` and `prisma migrate deploy`

# Start the Shopify dev server (opens a tunnel, synchronizes env vars)
npm run dev
```

During `npm run dev`, press **P** in the CLI to open the embedded app in your development store. Shopify CLI will manage the OAuth handshake and sync environment variables.

## Admin workflow

1. **Set a default language** – Use the language dropdown in the admin page to persist a global locale for conversations. 【F:app/routes/app._index.jsx†L9-L120】【F:app/routes/api.set-global-language.jsx†L1-L29】
2. **Generate product catalog** – Kick off the `product-catalog` task to fetch all products via GraphQL, store them as Parquet, and mark the task complete when finished. 【F:app/utils/shopifyProductFetch.server.js†L13-L96】
3. **Create embeddings** – After a catalog exists, start the `create-embeddings` task to read the Parquet file and upload it to your ML API. Task metadata (success, failure, extra details) is stored in Prisma. 【F:app/utils/createEmbedding.server.js†L11-L121】【F:app/db.server.js†L25-L54】
4. **Delete embeddings** – Use the `delete-embeddings` button to remove vectors from the ML service. 【F:app/utils/deleteEmbedding.server.js†L1-L32】
5. **Build a store prompt** – Run “Create Prompt” to collect shop tags/description, call OpenAI for a narrative summary, and store the result in the `Prompt` table. Retrieve saved prompts anytime with `/api/get-saved-prompt`. 【F:app/routes/api.generate-prompt.jsx†L1-L71】【F:app/routes/api.get-saved-prompt.jsx†L1-L29】

Task execution is debounced through the `/api/start-task` endpoint, which prevents duplicate runs and records progress in the `Task` table. Poll `/api/status-task?taskId=…` to monitor job completion. 【F:app/routes/api.start-task.jsx†L1-L72】【F:app/routes/api.status-task.jsx†L1-L18】

## Storefront assistant

- The Theme App Extension renders the Eva assistant widget, including language selection, chat history, voice mode, and product carousels. 【F:extensions/my-app-block/blocks/app-window.liquid†L1-L210】
- Front-end scripts (in `extensions/my-app-block/assets/`) handle UI state, speech recognition, and interactions with backend fetchers.
- Customer messages are sent to `/assistant?action=getAssistantResponse`, which orchestrates intent extraction, conversation history, and GPT responses. Results may include structured `products` or `action` payloads for the front end to handle cart operations. 【F:app/routes/assistant.jsx†L1-L204】【F:app/utils/connectors/gptHandlers.js†L1-L360】
- Chat transcripts and context are persisted in Prisma (`Chats`, `Threads`, `Prompt`, `Languages`). 【F:prisma/schema.prisma†L25-L58】

To surface the assistant on your storefront after deploying the theme extension, add the **My App Block** to the desired template in the Online Store editor.

## ML service contract

The ML API is expected to provide three endpoints:

- `POST /create_embeddings` – Accepts a Parquet payload (binary body) and stores vectors for a shop. 【F:app/utils/createEmbedding.server.js†L61-L108】
- `DELETE /delete_embeddings` – Removes embeddings for the provided shop (identified via `X-Shop-Name`). 【F:app/utils/deleteEmbedding.server.js†L1-L32】
- `POST /query_embedding` – Returns a ranked product list matching the query tokens. 【F:app/utils/connectors/embedingConnector.js†L1-L29】

Adjust `ML_SERVER_URL` or the hardcoded fallback (`http://ml-api:5556`) if your service runs elsewhere.

## Docker deployment

A production-oriented container is included. It expects a shared Docker network so the Remix app can reach the ML API container.

```bash
# Create the shared network once
docker network create shopify_ml_net

# Build and start the app (requires env variables from above)
docker compose up --build
```

The service listens on port `3000` and communicates with `ml-api` over the shared network. 【F:docker-compose.yml†L1-L20】

## Useful scripts

- `npm run dev` – Start the Shopify CLI development server.
- `npm run build` – Create a production Remix build.
- `npm run start` – Serve the compiled app with `remix-serve`.
- `npm run lint` – Lint the codebase with ESLint.
- `npm run setup` – Generate the Prisma client and apply migrations.

## Contributing

Issues and pull requests are welcome. Please describe the feature or bug clearly, add relevant documentation updates, and ensure linting passes before submitting.

## License

This project is intended for open-source release. Add your preferred license text or SPDX identifier here before publishing.
