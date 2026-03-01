import { NextRequest, NextResponse } from "next/server";
import type { PriceResult, RegionPrice } from "../../lib/types";

const ALL_REGIONS = [
  { region: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", currency: "USD", searchSuffix: "price USD", officialBase: "" },
  { region: "Hong Kong", flag: "\uD83C\uDDED\uD83C\uDDF0", currency: "HKD", searchSuffix: "price Hong Kong HKD", officialBase: "" },
  { region: "Japan", flag: "\uD83C\uDDEF\uD83C\uDDF5", currency: "JPY", searchSuffix: "price Japan JPY yen", officialBase: "" },
  { region: "France", flag: "\uD83C\uDDEB\uD83C\uDDF7", currency: "EUR", searchSuffix: "price France EUR", officialBase: "" },
];

const TAX_NOTES: Record<string, string> = {
  US: "MSRP \u2014 state sales tax not included",
  "Hong Kong": "No VAT or GST in Hong Kong",
  Japan: "Pre-tax price (ex 10% consumption tax)",
  France: "Pre-tax price (ex 20% VAT)",
};

async function tavilySearch(keyword: string, token: string): Promise<string> {
  try {
    const res = await fetch("https://space.ai-builders.com/backend/v1/search/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ keywords: [keyword], max_results: 5 }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const results = json.queries?.[0]?.response?.results ?? [];
    return results.map((r: { title?: string; url?: string; content?: string }) =>
      `${r.title} | ${r.url} | ${(r.content ?? "").slice(0, 600)}`
    ).join("\n---\n");
  } catch { return ""; }
}

function fmt(n: number, currency: string): string {
  const v = Math.round(n);
  if (currency === "USD") return `$${v.toLocaleString("en-US")}`;
  if (currency === "EUR") return `\u20AC${v.toLocaleString("en-US")}`;
  if (currency === "HKD") return `HK$${v.toLocaleString("en-US")}`;
  if (currency === "JPY") return `\u00A5${v.toLocaleString("en-US")}`;
  return `${v}`;
}

export async function POST(req: NextRequest) {
  try {
    const { confirmedQuery, brand, productUrl, homeRegion, homePrice, homeCurrency } = await req.json();
    const token = process.env.AI_BUILDER_TOKEN!;
    const skuMatch = productUrl?.match(/[^/?#]+(?=[/?#]|$)/g);
    const sku = skuMatch ? skuMatch[skuMatch.length - 1] : null;
    const q = sku ? `${confirmedQuery} ${sku}` : confirmedQuery;

    // FX rates
    let hkdRate = 7.85, jpyRate = 150, eurRate = 0.92;
    try {
      const fx = await (await fetch("https://api.exchangerate-api.com/v4/latest/USD")).json();
      hkdRate = fx.rates?.HKD ?? hkdRate;
      jpyRate = fx.rates?.JPY ?? jpyRate;
      eurRate = fx.rates?.EUR ?? eurRate;
    } catch {}

    // Search only the non-home regions
    const targetRegions = ALL_REGIONS.filter(r => r.region !== homeRegion);
    const searchResults = await Promise.all(
      targetRegions.map(r => tavilySearch(`${q} ${r.searchSuffix}`, token))
    );

    // Build context for LLM including the known home price
    const searchContext = targetRegions.map((r, i) =>
      `${r.region} results:\n${searchResults[i] || "No results"}`
    ).join("\n\n");

    const homePriceNote = homePrice
      ? `Known home price: ${homeRegion} = ${fmt(homePrice, homeCurrency)} (from official site)`
      : `Home region price not found.`;

    const llmRes = await fetch("https://space.ai-builders.com/backend/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content: `You are a luxury goods pricing expert. Extract retail prices from web search results. Return ONLY valid JSON, no markdown.
- For Japan: prices are usually shown tax-inclusive (10%), set taxInclusive:true
- For France: prices are usually shown tax-inclusive (20% VAT), set taxInclusive:true
- If no price found set rawPrice:null and confidence:"unavailable"
- Look for prices in press articles, resale sites (TheRealReal, 1stDibs), official brand sites
- confidence: "high" = official brand site, "medium" = editorial/resale, "unavailable" = not found`,
          },
          {
            role: "user",
            content: `Product: ${q}\nBrand: ${brand}\n${homePriceNote}\n\nSearch results for other regions:\n${searchContext}\n\nReturn JSON for ALL 4 regions (${ALL_REGIONS.map(r => r.region).join(", ")}):\n{"product":"${confirmedQuery}","brand":"${brand}","regions":[{"region":"US","flag":"\uD83C\uDDFA\uD83C\uDDF8","currency":"USD","rawPrice":7100,"taxInclusive":false,"officialUrl":"https://www.harrywinston.com/en/","confidence":"high","notes":null},{"region":"Hong Kong","flag":"\uD83C\uDDED\uD83C\uDDF0","currency":"HKD","rawPrice":null,"taxInclusive":false,"officialUrl":"https://www.harrywinston.com/zh_HK/","confidence":"unavailable","notes":null},{"region":"Japan","flag":"\uD83C\uDDEF\uD83C\uDDF5","currency":"JPY","rawPrice":880000,"taxInclusive":true,"officialUrl":"https://www.harrywinston.com/ja/","confidence":"high","notes":null},{"region":"France","flag":"\uD83C\uDDEB\uD83C\uDDF7","currency":"EUR","rawPrice":6900,"taxInclusive":true,"officialUrl":"https://www.harrywinston.com/fr/","confidence":"medium","notes":null}]}`,
          },
        ],
      }),
    });

    const llmContent = (await llmRes.json()).choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(llmContent.replace(/```json|```/g, "").trim());

    // If home region price is known, override it
    const regions: RegionPrice[] = parsed.regions.map((r: {
      region: string; flag: string; currency: string; rawPrice: number | null;
      taxInclusive: boolean; officialUrl: string; confidence: string; notes: string | null;
    }) => {
      let rawPrice = r.rawPrice;
      let confidence = r.confidence;

      // Inject known home price
      if (r.region === homeRegion && homePrice) {
        rawPrice = homePrice;
        confidence = "high";
      }

      let priceNumeric: number | null = null;
      let priceUSD: number | null = null;

      if (rawPrice) {
        if (r.region === "US") { priceNumeric = rawPrice; priceUSD = rawPrice; }
        else if (r.region === "Hong Kong") { priceNumeric = rawPrice; priceUSD = rawPrice / hkdRate; }
        else if (r.region === "Japan") {
          priceNumeric = r.taxInclusive ? Math.round(rawPrice / 1.1) : rawPrice;
          priceUSD = priceNumeric / jpyRate;
        }
        else if (r.region === "France") {
          priceNumeric = r.taxInclusive ? Math.round(rawPrice / 1.2) : rawPrice;
          priceUSD = priceNumeric / eurRate;
        }
      }

      const exchangeRate =
        r.region === "US" ? "Base currency"
        : r.region === "Hong Kong" ? `1 USD = ${hkdRate.toFixed(2)} HKD`
        : r.region === "Japan" ? `1 USD = ${jpyRate.toFixed(1)} JPY`
        : `1 EUR = ${(1 / eurRate).toFixed(4)} USD`;

      return {
        region: r.region, flag: r.flag, currency: r.currency,
        localPrice: priceNumeric ? fmt(priceNumeric, r.currency) : null,
        priceNumeric,
        priceUSD: priceUSD ? Math.round(priceUSD) : null,
        priceUSDFormatted: priceUSD ? `$${Math.round(priceUSD).toLocaleString()}` : null,
        exchangeRate,
        taxNote: TAX_NOTES[r.region] ?? "",
        officialUrl: r.officialUrl,
        confidence: (!rawPrice ? "unavailable" : confidence) as RegionPrice["confidence"],
        notes: r.notes,
        isBest: false,
      };
    });

    // Best price
    const withPrice = regions.filter(r => r.priceUSD && r.confidence !== "unavailable");
    let bestRegion: string | null = null;
    if (withPrice.length > 0) {
      const best = withPrice.reduce((a, b) => a.priceUSD! < b.priceUSD! ? a : b);
      best.isBest = true;
      bestRegion = best.region;
    }

    return NextResponse.json({
      product: parsed.product, brand: parsed.brand,
      confirmedQuery, regions,
      searchedAt: new Date().toISOString(),
      disclaimer: "Prices sourced from web search and may not reflect current retail prices. Always verify on the official brand website before purchasing.",
      bestRegion,
    } as PriceResult);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
