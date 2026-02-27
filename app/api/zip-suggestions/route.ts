import { NextRequest } from "next/server";
import OpenAI from "openai";
import { AI_BUILDERS_BASE_URL, DEFAULT_MODEL } from "@/app/lib/sharedConfig";
import type { ZipSuggestionsResponse } from "@/app/lib/zipSuggestions";
import type { StateCode } from "@/app/lib/locationScores";

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

  let state: StateCode | undefined;
  let label = "";
  let locationId = "";
  let maxZips = 8;

  try {
    const body = await req.json();
    state = body?.state;
    label = typeof body?.label === "string" ? body.label.trim() : "";
    locationId = typeof body?.locationId === "string" ? body.locationId.trim() : "";
    if (!state || !label) {
      return new Response(
        JSON.stringify({ error: "state and label are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (typeof body?.maxZips === "number" && body.maxZips > 0 && body.maxZips <= 20) {
      maxZips = body.maxZips;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Step 1: Tavily-backed search for ZIPs in the chosen metro/region.
    const searchRes = await fetch(`${AI_BUILDERS_BASE_URL}/search/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        keywords: [
          `Best ZIP codes for families with strong public high schools and good owner-occupied-friendly short term rental potential in ${label}, ${state}`,
        ],
        max_results: maxZips,
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
      throw new Error(msg || "Search request for ZIP suggestions failed");
    }

    const searchJson = (await searchRes.json()) as unknown;

    // Step 2: Ask a regular model to extract and score a small set of ZIP codes.
    const client = new OpenAI({
      apiKey: token,
      baseURL: AI_BUILDERS_BASE_URL,
    });

    const systemPrompt = `
You receive Tavily-style web search results (JSON) about neighborhoods and real estate
for a metro/region in the United States.

Your task:
- Extract 3–10 promising ZIP codes in that metro/region that are good candidates for:
  - Strong public high schools
  - Reasonable access to good public universities (state or regional)
  - Owner-occupied-friendly short term rental potential (where legal)

For each suggested ZIP, assign:
- score (0–100 overall desirability)
- educationNotes (1–2 short sentences)
- strNotes (1–2 short sentences about STR viability, if info exists; otherwise omit or say "limited info")
- overallNotes (1–2 short sentences, may reference lifestyle/price).

You MUST return ONLY a JSON object with this exact shape:
{
  "locationId": "string",
  "state": "CA",
  "label": "San Francisco Bay Area, CA",
  "zips": [
    {
      "zip": "94303",
      "city": "Palo Alto",
      "state": "CA",
      "score": 92,
      "educationNotes": "Highly rated public high schools with strong college-going rates.",
      "strNotes": "Some STR restrictions; check city ordinances for owner-occupied rules.",
      "overallNotes": "Affluent, high-demand area close to major employers and Stanford."
    }
  ]
}

Rules:
- "zips" must be an array with at least 3 entries (if data allows) and at most 10.
- "zip" must be a 5-digit US ZIP code as a string.
- "score" must be a number between 0 and 100.
- Do NOT include any markdown, comments, or extra text outside the JSON.
`.trim();

    const userPrompt = `
State code: ${state}
Location label: ${label}
Location id (caller-provided): ${locationId || "(none)"}

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
            "Model returned an empty or non-text response when generating ZIP suggestions.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    let parsed: ZipSuggestionsResponse;
    try {
      parsed = JSON.parse(raw) as ZipSuggestionsResponse;
      if (!parsed || !Array.isArray(parsed.zips)) {
        throw new Error("Parsed JSON is missing 'zips' array.");
      }
    } catch (err) {
      console.error("[zip-suggestions API] Failed to parse JSON from model:", {
        error: err instanceof Error ? err.message : String(err),
        raw,
      });
      return new Response(
        JSON.stringify({
          error:
            "Failed to parse JSON from model when generating ZIP suggestions. Check server logs for raw response.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Normalize state and label from caller, in case the model changed them.
    const response: ZipSuggestionsResponse = {
      locationId: locationId || parsed.locationId,
      state,
      label,
      zips: parsed.zips.map((z) => ({
        ...z,
        state: state!,
      })),
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

    console.error("[zip-suggestions API] Error:", {
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

