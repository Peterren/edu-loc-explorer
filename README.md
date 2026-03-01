# Luxury Price Compare

Compare official pre-tax retail prices for luxury goods across US, Hong Kong, Japan, and France.

## Features
- Guided SKU clarification (color, material, hardware, size) powered by Grok
- Pre-tax prices: US MSRP, HK shelf price, Japan ex-10% tax, France ex-20% VAT
- USD equivalent with daily exchange rates
- Best price region highlighted with gold badge
- Shareable links via ?q= URL parameter
- Mobile-optimized dark luxury UI

## How it works
1. Type a product (e.g. "Chanel Classic Flap Mini")
2. Answer clarifying questions to identify the exact SKU
3. App searches 4 regions via Tavily real-time web search
4. See pre-tax prices side by side with USD conversions

## Stack
- Next.js 15 (App Router)
- Tailwind CSS
- AI Builders Space API (Tavily search + Grok LLM)
- exchangerate-api.com for daily FX rates

## Setup
1. `npm install`
2. `cp .env.local.example .env.local` and set `AI_BUILDER_TOKEN`
3. `npm run dev` -> http://localhost:3000

## Deployment
https://edu-loc-explorer.ai-builders.space/
