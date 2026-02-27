# Education + Airbnb Location Explorer

An interactive UI for exploring **US locations** that balance:

- **Public education quality** (high schools + nearby public universities)
- **Short-term rental viability** (owner-occupied–friendly STR rules)
- **Financial feasibility** (can 6 months of Airbnb cover interest + property tax?)
- **Lifestyle factors** (safety, amenities, airport access, community)

Backend is provided by **AI Builders Space API**, using its Tavily-backed search and Grok-4-Fast model.

## Setup

1. **Install dependencies**
   ```bash
   cd edu-loc-explorer
   npm install
   ```

2. **Configure AI Builders token**
   - Get your token from the AI Builders platform.
   - Copy `.env.local.example` to `.env.local` (or create `.env.local`).
   - Set `AI_BUILDER_TOKEN=your_token_here`
   - Do not commit `.env.local`; it is in `.gitignore`.

3. **Run the app**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Usage

### State selection

- **Buttons**: Click state names (California, Washington, Texas, etc.) to select or deselect.
- **Map**: Hover over the US map to see state names; click to toggle selection. Only the 10 pilot states are selectable; others show “Not included in this search.”
- **Unselect all**: Clears all selected states.
- **Run analysis**: Fetches ranked metros for the selected states.

### Score breakdown

Each metro is ranked using web search data (Tavily) and an AI model (Grok). The total score is a weighted combination of four sub-scores (0–100 each):

| Score | Weight | Description |
|-------|--------|-------------|
| **Education** | 45% | Public high school quality, AP/IB pipeline, college-going rates, proximity to strong public universities |
| **Financial** | 25% | Whether conservative STR income (~6 months/year) can cover interest and property tax |
| **STR viability** | 15% | Clarity and friendliness of short-term rental rules for owner-occupied or mixed-use |
| **Lifestyle** | 15% | Safety, amenities, airport access, community presence |

Expand the “How scores are calculated” section in the app for details.

### Workflow

1. Select one or more states (buttons or map).
2. Click **Run analysis**.
3. View ranked metros in the results table; expand rows for detailed notes.
4. Click **View ZIPs** on a metro to get ZIP suggestions.
5. Click **View listings** on a ZIP to see property links (Redfin, Zillow, Opendoor).

## Backend (AI Builders)

- **API**: [AI Builders Space API](https://space.ai-builders.com/backend/v1)
- **Auth**: Bearer token via `AI_BUILDER_TOKEN`
- **Search**: `POST /v1/search/` — Tavily-style web search
- **Models**: Grok-4-Fast (via OpenAI-compatible chat completions)

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/location-scores` | POST | Rank metros by education, financial, STR, and lifestyle scores |
| `/api/zip-suggestions` | POST | Get ZIP recommendations for a metro |
| `/api/zip-listings` | POST | Get property listings for a ZIP |
| `/api/search-basic` | POST | Tavily search + optional LLM summary |

## Deployment

Deployed to **AI Builders Space**: [https://edu-loc-explorer.ai-builders.space/](https://edu-loc-explorer.ai-builders.space/)

- **Repo**: [github.com/Peterren/edu-loc-explorer](https://github.com/Peterren/edu-loc-explorer)
- **Stack**: Next.js 15, Docker, Koyeb
- `AI_BUILDER_TOKEN` is injected automatically at runtime.
