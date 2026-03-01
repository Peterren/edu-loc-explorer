import { NextRequest, NextResponse } from "next/server";
import type { PriceResult, RegionPrice } from "../../lib/types";

async function tavilySearch(query: string, token: string): Promise<string> {
  try {
    const res = await fetch("https://space.ai-builders.com/backend/v1/search/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ keywords: [query], max_results: 5 }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    // Response structure: { queries: [{ keyword, response: { results: [...] } }] }
    const results = json.queries?.[0]?.response?.results ?? [];
    if (!Array.isArray(results) || results.length === 0) return "";
    return results.map((r: { title?: string; url?: string; content?: string }) =>
      `${r.title ?? ""} | ${r.url ?? ""} | ${(r.content ?? "").slice(0, 600)}`
    ).join("\n---\n");
  } catch {
    return "";
  }
}

function formatCurrency(amount: number, currency: string): string {
  const n = Math.round(amount);
  if (currency === "USD") return `$${n.toLocaleString("en-US")}`;
  if (currency === "EUR") return `\u20AC${n.toLocaleString("en-US")}`;
  if (currency === "HKD") return `HK$${n.toLocaleString("en-US")}`;
  if (currency === "JPY") return `\u00A5${n.toLocaleString("en-US")}`;
  return `${n}`;
}

export async function POST(req: NextRequest) {
  try {
    const { confirmedQuery, brand, productUrl } = await req.json();
    const token = process.env.AI_BUILDER_TOKEN!;
    const skuMatch = productUrl ? productUrl.match(/[^/]+$/) : null;
    const sku = skuMatch ? skuMatch[0] : null;
    const brandName = brand || confirmedQuery.split(" ")[0];

    // FX rates
    let hkdRate = 7.85, jpyRate = 150, eurRate = 0.92;
    try {
      const fxRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const fxJson = await fxRes.json();
      hkdRate = fxJson.rates?.HKD ?? hkdRate;
      jpyRate = fxJson.rates?.JPY ?? jpyRate;
      eurRate = fxJson.rates?.EUR ?? eurRate;
    } catch {}

    const q = sku ? `${confirmedQuery} ${sku}` : confirmedQuery;

    // Parallel searches
    const [usResults, hkResults, jpResults, frResults] = await Promise.all([
      tavilySearch(`${q} price USD`, token),
      tavilySearch(`${q} price Hong Kong HKD`, token),
      tavilySearch(`${q} price Japan JPY`, token),
      tavilySearch(`${q} price France EUR`, token),
    ]);

    const llmRes = await fetch("https://space.ai-builders.com/backend/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content: `You are a luxury goods pricing expert. Extract retail prices from web search results.
Rules:
- Return ONLY valid JSON, no markdown, no code blocks
- For Japan prices found tax-inclusive (10% tax): set taxInclusive:true
- For France prices found tax-inclusive (20% VAT): set taxInclusive:true
- If no price found, set rawPrice:null and confidence:"unavailable"
- Many luxury brands do not publish prices online. Also check: press articles, resale/secondhand sites (TheRealReal, 1stDibs), editorial reviews
- Set confidence:"medium" if price is from unofficial/secondhand source
- Always provide the officialUrl for the brand's regional website`,
          },
          {
            role: "user",
            content: `Product: ${q}\nBrand: ${brandName}\n\nUS results:\n${usResults || "No results"}\n\nHong Kong results:\n${hkResults || "No results"}\n\nJapan results:\n${jpResults || "No results"}\n\nFrance results:\n${frResults || "No results"}\n\nReturn JSON:\n{"product":"full product name","brand":"brand name","regions":[{"region":"US","flag":"\uD83C\uDDFA\uD83C\uDDF8","currency":"USD","rawPrice":7100,"taxInclusive":false,"officialUrl":"https://www.harrywinston.com/en/","confidence":"high","notes":null},{"region":"Hong Kong","flag":"\uD83C\uDDED\uD83C\uDDF0","currency":"HKD","rawPrice":null,"taxInclusive":false,"officialUrl":"https://www.harrywinston.com/zh_HK/","confidence":"unavailable","notes":null},{"region":"Japan","flag":"\uD83C\uDDEF\uD83C\uDDF5","currency":"JPY","rawPrice":968000,"taxInclusive":true,"officialUrl":"https://www.harrywinston.com/ja/","confidence":"high","notes":null},{"region":"France","flag":"\uD83C\uDDEB\uD83C\uDDF7","currency":"EUR","rawPrice":7140,"taxInclusive":true,"officialUrl":"https://www.harrywinston.com/fr/","confidence":"high","notes":null}]}`,
          },
        ],
      }),
    });

    const llmJson = await llmRes.json();
    const content = llmJson.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const taxNotes: Record<string, string> = {
      US: "MSRP \u2014 state sales tax not included",
      "Hong Kong": "No VAT or GST in Hong Kong",
      Japan: "Pre-tax price (ex 10% consumption tax)",
      France: "Pre-tax price (ex 20% VAT)",
    };

    const regions: RegionPrice[] = parsed.regions.map((r: {
      region: string; flag: string; currency: string; rawPrice: number | null;
      taxInclusive: boolean; officialUrl: string; confidence: string; notes: string | null;
    }) => {
      let priceNumeric: number | null = null;
      let priceUSD: number | null = null;

      if (r.rawPrice) {
        if (r.region === "US") {
          priceNumeric = r.rawPrice;
          priceUSD = r.rawPrice;
        } else if (r.region === "Hong Kong") {
          priceNumeric = r.rawPrice;
          priceUSD = r.rawPrice / hkdRate;
        } else if (r.region === "Japan") {
          priceNumeric = r.taxInclusive ? Math.round(r.rawPrice / 1.1) : r.rawPrice;
          priceUSD = priceNumeric / jpyRate;
        } else if (r.region === "France") {
          priceNumeric = r.taxInclusive ? Math.round(r.rawPrice / 1.2) : r.rawPrice;
          priceUSD = priceNumeric / eurRate;
        }
      }

      const exchangeRate =
        r.region === "US" ? "Base currency"
        : r.region === "Hong Kong" ? `1 USD = ${hkdRate.toFixed(2)} HKD`
        : r.region === "Japan" ? `1 USD = ${jpyRate.toFixed(1)} JPY`
        : `1 EUR = ${(1 / eurRate).toFixed(4)} USD`;

      return {
        region: r.region,
        flag: r.flag,
        currency: r.currency,
        localPrice: priceNumeric ? formatCurrency(priceNumeric, r.currency) : null,
        priceNumeric,
        priceUSD: priceUSD ? Math.round(priceUSD) : null,
        priceUSDFormatted: priceUSD ? `$${Math.round(priceUSD).toLocaleString()}` : null,
        exchangeRate,
        taxNote: taxNotes[r.region] ?? "",
        officialUrl: r.officialUrl,
        confidence: (!r.rawPrice ? "unavailable" : r.confidence) as RegionPrice["confidence"],
        notes: r.notes,
        isBest: false,
      };
    });

    const withPrice = regions.filter(r => r.priceUSD && r.confidence !== "unavailable");
    let bestRegion: string | null = null;
    if (withPrice.length > 0) {
      const best = withPrice.reduce((a, b) => (a.priceUSD! < b.priceUSD! ? a : b));
      best.isBest = true;
      bestRegion = best.region;
    }

    return NextResponse.json({
      product: parsed.product,
      brand: parsed.brand,
      confirmedQuery,
      regions,
      searchedAt: new Date().toISOString(),
      disclaimer: "Prices sourced from web search and may not reflect current retail prices. Always verify on the official brand website before purchasing.",
      bestRegion,
    } as PriceResult);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
