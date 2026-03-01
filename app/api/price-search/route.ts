import { NextRequest, NextResponse } from "next/server";
import type { PriceResult, RegionPrice } from "../../lib/types";

async function tavilySearch(query: string, token: string) {
  const res = await fetch("https://space.ai-builders.com/backend/v1/search/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, max_results: 5 }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results ?? []).map((r: { title: string; url: string; content: string }) =>
    `${r.title} | ${r.url} | ${r.content?.slice(0, 300)}`
  ).join("\n");
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "USD") return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (currency === "EUR") return `\u20AC${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (currency === "HKD") return `HK$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (currency === "JPY") return `\u00A5${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `${amount}`;
}

export async function POST(req: NextRequest) {
  try {
    const { confirmedQuery, brand } = await req.json();
    const token = process.env.AI_BUILDER_TOKEN!;

    // FX rates
    const fxRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const fxJson = await fxRes.json();
    const rates: Record<string, number> = fxJson.rates ?? {};
    const hkdRate = rates.HKD ?? 7.85;
    const jpyRate = rates.JPY ?? 150;
    const eurRate = rates.EUR ?? 0.92;

    // Parallel searches
    const [usResults, hkResults, jpResults, frResults] = await Promise.all([
      tavilySearch(`${confirmedQuery} price USD official retail`, token),
      tavilySearch(`${confirmedQuery} Hong Kong price HKD official`, token),
      tavilySearch(`${confirmedQuery} Japan price JPY official`, token),
      tavilySearch(`${confirmedQuery} France prix EUR officiel`, token),
    ]);

    const llmRes = await fetch("https://space.ai-builders.com/backend/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content: `You are a luxury goods pricing expert. Extract prices from search results. Return ONLY valid JSON, no markdown. For each region return the price AS FOUND on the website (may be tax-inclusive). Set taxInclusive:true if the price includes tax. If no price found set rawPrice:null and confidence:"unavailable".`,
          },
          {
            role: "user",
            content: `Product: ${confirmedQuery}\nBrand: ${brand}\n\nUS search results:\n${usResults}\n\nHong Kong search results:\n${hkResults}\n\nJapan search results:\n${jpResults}\n\nFrance search results:\n${frResults}\n\nReturn JSON: {"product":"full product name","brand":"brand name","regions":[{"region":"US","flag":"\uD83C\uDDFA\uD83C\uDDF8","currency":"USD","rawPrice":5200,"taxInclusive":false,"officialUrl":"https://www.chanel.com/us/","confidence":"high","notes":null},{"region":"Hong Kong","flag":"\uD83C\uDDED\uD83C\uDDF0","currency":"HKD","rawPrice":41000,"taxInclusive":false,"officialUrl":"https://www.chanel.com/hk/","confidence":"high","notes":null},{"region":"Japan","flag":"\uD83C\uDDEF\uD83C\uDDF5","currency":"JPY","rawPrice":968000,"taxInclusive":true,"officialUrl":"https://www.chanel.com/ja_JP/","confidence":"high","notes":null},{"region":"France","flag":"\uD83C\uDDEB\uD83C\uDDF7","currency":"EUR","rawPrice":7140,"taxInclusive":true,"officialUrl":"https://www.chanel.com/fr_FR/","confidence":"high","notes":null}]}`,
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
        confidence: (r.rawPrice ? r.confidence : "unavailable") as RegionPrice["confidence"],
        notes: r.notes,
        isBest: false,
      };
    });

    // Find best price
    const withPrice = regions.filter(r => r.priceUSD && r.confidence !== "unavailable");
    let bestRegion: string | null = null;
    if (withPrice.length > 0) {
      const best = withPrice.reduce((a, b) => (a.priceUSD! < b.priceUSD! ? a : b));
      best.isBest = true;
      bestRegion = best.region;
    }

    const result: PriceResult = {
      product: parsed.product,
      brand: parsed.brand,
      confirmedQuery,
      regions,
      searchedAt: new Date().toISOString(),
      disclaimer: "Prices sourced from web search and may not reflect current retail prices. Always verify on the official brand website before purchasing.",
      bestRegion,
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
