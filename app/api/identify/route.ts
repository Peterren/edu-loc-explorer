import { NextRequest, NextResponse } from "next/server";

interface ProductInfo {
  brand: string;
  product: string;
  sku: string | null;
  homeRegion: string;
  homeFlag: string;
  homeCurrency: string;
  homePrice: number | null;
  homePriceLabel: string | null;
  officialUrl: string;
  confidence: string;
}

async function tavilySearch(keywords: string[], token: string): Promise<string> {
  const res = await fetch("https://space.ai-builders.com/backend/v1/search/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ keywords, max_results: 3 }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  const results = json.queries?.[0]?.response?.results ?? [];
  return results.map((r: { title?: string; url?: string; content?: string }) =>
    `TITLE: ${r.title}\nURL: ${r.url}\nCONTENT: ${(r.content ?? "").slice(0, 800)}`
  ).join("\n---\n");
}

function detectHomeRegion(url: string): { region: string; flag: string; currency: string } {
  if (/\/ja\/|\.jp\/|harrywinston\.com\/ja/i.test(url)) return { region: "Japan", flag: "\uD83C\uDDEF\uD83C\uDDF5", currency: "JPY" };
  if (/\/fr\/|\/fr_FR\//i.test(url)) return { region: "France", flag: "\uD83C\uDDEB\uD83C\uDDF7", currency: "EUR" };
  if (/\/zh_HK\/|\/hk\/|hongkong/i.test(url)) return { region: "Hong Kong", flag: "\uD83C\uDDED\uD83C\uDDF0", currency: "HKD" };
  return { region: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", currency: "USD" };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
    const token = process.env.AI_BUILDER_TOKEN!;
    const homeRegion = detectHomeRegion(url);

    // Extract SKU from URL (last path segment)
    const skuMatch = url.match(/[^/?#]+(?=[/?#]|$)/g);
    const sku = skuMatch ? skuMatch[skuMatch.length - 1] : null;

    // Search for the product page content
    const searchResults = await tavilySearch([url], token);

    const llmRes = await fetch("https://space.ai-builders.com/backend/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content: `You are a luxury goods expert. Extract product information from web search results for a product URL. Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Product URL: ${url}\nSKU hint: ${sku}\nHome region: ${homeRegion.region} (${homeRegion.currency})\n\nSearch results:\n${searchResults || "No results found"}\n\nExtract and return JSON:\n{"brand":"Harry Winston","product":"Ribbon Diamond Wedding Band","sku":"WBDPRDPAR","homePrice":7100,"homePriceLabel":"$7,100","confidence":"high"}\n\nIf price not found, set homePrice:null and homePriceLabel:null. Confidence: high if found on official site, medium if found elsewhere, unavailable if not found at all.`,
          },
        ],
      }),
    });

    const llmJson = await llmRes.json();
    const content = llmJson.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const result: ProductInfo = {
      brand: parsed.brand,
      product: parsed.product,
      sku: parsed.sku ?? sku,
      homeRegion: homeRegion.region,
      homeFlag: homeRegion.flag,
      homeCurrency: homeRegion.currency,
      homePrice: parsed.homePrice ?? null,
      homePriceLabel: parsed.homePriceLabel ?? null,
      officialUrl: url,
      confidence: parsed.confidence ?? "medium",
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
