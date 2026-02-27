# Edu Location Service

An interactive UI for exploring **US locations** that balance:

- **Public education quality** (high schools + nearby public universities)
- **Short-term rental viability** (owner-occupied–friendly STR rules)
- **Financial feasibility** (can 6 months of Airbnb cover interest + property tax?)
- **Lifestyle factors** (safety, amenities, airport access, community)

Backend is provided by **AI Builders Space API**, using its Tavily-backed search and OpenAI-compatible models.

## Setup

1. **Install dependencies**
   ```bash
   cd chat-gui
   npm install
   ```

2. **Configure AI Builders token**
   - Use the same token for development and deployment (see AI Builders Coach: `explain_authentication_model`, `get_deployment_guide`).
   - Copy `.env.local.example` to `.env.local`
   - Set `AI_BUILDER_TOKEN=your_token_here`
   - Do not hardcode the token; add `.env` to `.gitignore`.

3. **Run the app**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Backend (AI Builders)

- **API**: [AI Builders Space API](https://space.ai-builders.com/backend) — base URL from `get_base_url` MCP tool.
- **Auth**: Bearer token via `AI_BUILDER_TOKEN` (see `get_auth_token` / deployment guide).
- **Chat / models**: OpenAI-compatible `POST .../v1/chat/completions` with models like `grok-4-fast`, `deepseek`, etc.
- **Search**: Tavily-style `POST .../search` endpoint used for live web research (schools, STR rules, Airbnb metrics…).

## Features

- **Location explorer (root `/`)**: Select US states, run analysis, and see ranked metros with:
  - Overall score (0–100)
  - **Education**, **Financial**, **STR**, and **Lifestyle** sub-scores
  - Click-to-expand explanations for how each score was derived
- **Search + summarize API**: `/api/search-basic` – minimal Tavily search → LLM summary pipeline
