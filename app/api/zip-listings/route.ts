import { NextRequest } from "next/server";
import OpenAI from "openai";
import { AI_BUILDERS_BASE_URL, DEFAULT_MODEL } from "@/app/lib/sharedConfig";
import type { ZipListingsResponse } from "@/app/lib/zipListings";

export async function POST(req: NextRequest) {
  const token = process.env.AI_BUILDER_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({
        error:
          "AI_BUILDER_TOKEN is not configured. Add it to .env.local (see deployment guide from AI Builders Coach).",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let zip = "";
  let state = "";
  let maxListings = 12;

  try {
    const body = await req.json();
    zip = typeof body?.zip === "string" ? body.zip.trim() : "";
    state = typeof body?.state === "string" ? body.state.trim() : "";
    if (!zip) {
      return new Response(
        JSON.stringify({ error: "zip is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (typeof body?.maxListings === "number" && body.maxListings > 0 && body.maxListings <= 30) {
      maxListings = body.maxListings;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Step 1: Tavily-backed search for active listings in this ZIP, preferring known portals.
    const keyword = `Current homes for sale in ZIP ${zip} ${state || ""} on Redfin, Zillow, Opendoor, or similar real estate portals.`;
    const searchRes = await fetch(`${AI_BUILDERS_BASE_URL}/search/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        keywords: [keyword],
        max_results: maxListings,
      }),
    });

    if (!searchRes.ok) {
      const text = await searchRes.text();
      let err: { error?: string } = { error: searchRes.statusText };
      try {
        if (text) err = JSON.parse(text);
      } catch {
        if (text) err.error = text;
      }
      const msg = [searchRes.status, err.error].filter(Boolean).join(" — ");
      throw new Error(msg || "Search request for ZIP listings failed");
    }

    const searchJson = (await searchRes.json()) as unknown;

    // Step 2: Ask the model to extract structured listing info with hyperlinks.
    const client = new OpenAI({
      apiKey: token,
      baseURL: AI_BUILDERS_BASE_URL,
    });

    const systemPrompt = `
You receive Tavily-style web search results (JSON) for homes for sale in a specific US ZIP code.

Your task:
- Identify up to 12 current or recent for-sale listings from major real-estate portals
  (prefer Redfin, Zillow, Opendoor, Realtor.com, etc. when present).
- For each listing, output:
  - url: direct URL to the listing page
  - title: brief human-readable label (e.g. "3bd 2ba home on Elm St")
  - price: a short price string (e.g. "$1.2M" or "$899,000") if available
  - source: domain (e.g. "redfin.com", "zillow.com")
  - summary: 1–2 short sentences about notable features (beds/baths/general feel).

Output ONLY this JSON shape:
{
  "zip": "94301",
  "listings": [
    {
      "url": "https://www.redfin.com/...",
      "title": "3bd 2ba home on Elm St",
      "price": "$3.2M",
      "source": "redfin.com",
      "summary": "Updated single-family home near downtown; large yard and modern kitchen."
    }
  ]
}

Rules:
- "listings" must be an array; it can be empty if no suitable URLs are found.
- Ensure "url" is a valid absolute URL.
- Do NOT include any markdown, comments, or extra text outside the JSON.
`.trim();

    const userPrompt = `
ZIP code: ${zip}
State: ${state || "(unknown)"}

Here is the raw Tavily-style JSON from the search endpoint:
${JSON.stringify(searchJson, null, 2)}

Using ONLY this data plus your general knowledge, output the JSON object described in the system prompt.
`.trim();

    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Model returned an empty or non-text response when generating ZIP listings.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    let parsed: ZipListingsResponse;
    try {
      parsed = JSON.parse(raw) as ZipListingsResponse;
      if (!parsed || !Array.isArray(parsed.listings)) {
        throw new Error("Parsed JSON is missing 'listings' array.");
      }
    } catch (err) {
      console.error("[zip-listings API] Failed to parse JSON from model:", {
        error: err instanceof Error ? err.message : String(err),
        raw,
      });
      return new Response(
        JSON.stringify({
          error:
            "Failed to parse JSON from model when generating ZIP listings. Check server logs for raw response.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const response: ZipListingsResponse = {
      zip: zip,
      listings: parsed.listings ?? [],
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const errObj = err as Record<string, unknown> | undefined;
    const status = typeof errObj?.status === "number" ? errObj.status : undefined;
    const code = typeof errObj?.code === "string" ? errObj.code : undefined;

    console.error("[zip-listings API] Error:", {
      message,
      status,
      code,
      fullError: err instanceof Error ? err.stack : String(err),
    });

    return new Response(
      JSON.stringify({
        error: message,
        ...(code && { code }),
        ...(status && { status }),
      }),
      {
        status:
          status && status >= 400 && status < 600
            ? status
            : 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

