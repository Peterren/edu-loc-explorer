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

async function tavilySearch(keyword: string, token: string): Promise<string> {
  const res = await fetch("https://space.ai-builders.com/backend/v1/search/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ keywords: [keyword], max_results: 4 }),
  });
  if (!res.ok) return "";
  const json = await res.json();
  const results = json.queries?.[0]?.response?.results ?? [];
  return results.map((r: { title?: string; url?: string; content?: string }) =>
    `TITLE: ${r.title}\nURL: ${r.url}\nCONTENT: ${(r.content ?? "").slice(0, 800)}`
  ).join("\n---\n");
}

function detectHomeRegion(url: string) {
  if (/\/ja\/|\/ja_JP\//i.test(url)) return { region: "Japan", flag: "\uD83C\uDDEF\uD83C\uDDF5", currency: "JPY" };
  if (/\/fr\/|\/fr_FR\//i.test(url)) return { region: "France", flag: "\uD83C\uDDEB\uD83C\uDDF7", currency: "EUR" };
  if (/\/zh_HK\/|\/hk\//i.test(url)) return { region: "Hong Kong", flag: "\uD83C\uDDED\uD83C\uDDF0", currency: "HKD" };
  return { region: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", currency: "USD" };
}

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();
    if (!input) return NextResponse.json({ error: "input is required" }, { status: 400 });
    const token = process.env.AI_BUILDER_TOKEN!;

    const isUrl = input.startsWith("http");
    const homeRegion = isUrl ? detectHomeRegion(input) : { region: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", currency: "USD" };

    // Search using the URL or SKU directly
    const searchResults = await tavilySearch(input, token);

    const llmRes = await fetch("https://space.ai-builders.com/backend/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          { role: "system", content: "You are a luxury goods expert. Extract product info from search results. Return ONLY valid JSON, no markdown." },
          { role: "user", content: `Input: ${input}\nType: ${isUrl ? "URL" : "SKU"}\nHome region: ${homeRegion.region}\n\nSearch results:\n${searchResults || "No results"}\n\nReturn: {"brand":"Harry Winston","product":"Ribbon Diamond Wedding Band","sku":"WBDPRDPAR","homePrice":7100,"homePriceLabel":"$7,100","officialUrl":"https://www.harrywinston.com/en/products/...","confidence":"high"}` },
        ],
      }),
    });

    const content = (await llmRes.json()).choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());

    return NextResponse.json({
      brand: parsed.brand,
      product: parsed.product,
      sku: parsed.sku ?? (isUrl ? input.match(/[^/?#]+(?=[/?#]|$)/g)?.pop() : input),
      homeRegion: homeRegion.region,
      homeFlag: homeRegion.flag,
      homeCurrency: homeRegion.currency,
      homePrice: parsed.homePrice ?? null,
      homePriceLabel: parsed.homePriceLabel ?? null,
      officialUrl: parsed.officialUrl ?? (isUrl ? input : null),
      confidence: parsed.confidence ?? "medium",
    } as ProductInfo);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
