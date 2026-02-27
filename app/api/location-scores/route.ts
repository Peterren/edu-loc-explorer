import { NextRequest } from "next/server";
import OpenAI from "openai";
import type { LocationScoresResponse, StateCode } from "@/app/lib/locationScores";
import { AI_BUILDERS_BASE_URL, DEFAULT_MODEL } from "@/app/lib/sharedConfig";

const DEFAULT_STATES: StateCode[] = [
  "CA",
  "WA",
  "OR",
  "TX",
  "MA",
  "MI",
  "WI",
  "MN",
  "NJ",
  "NY",
];

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

  let requestedStates: StateCode[] = DEFAULT_STATES;
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.stateCodes) && body.stateCodes.length > 0) {
      requestedStates = body.stateCodes.slice(0, 20);
    }
  } catch {
    // fall back to defaults
  }

  try {
    // Use the basic Tavily-style search endpoint plus a regular LLM model,
    // instead of an opaque multi-tool agent, so we have explicit control
    // over what is searched and how results are scored.
    const searchRes = await fetch(`${AI_BUILDERS_BASE_URL}/search/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        keywords: [
          "Best metros and suburbs for strong public high schools, nearby public universities, and owner-occupied-friendly short term rentals in these US states: " +
            JSON.stringify(requestedStates),
        ],
        max_results: 20,
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
      throw new Error(msg || "Search request for location scores failed");
    }

    const searchJson = (await searchRes.json()) as unknown;

    const client = new OpenAI({
      apiKey: token,
      baseURL: AI_BUILDERS_BASE_URL,
    });

    const systemPrompt = `
You are ranking US metros/regions for a long-term education + Airbnb plan.
You receive raw web search data (Tavily-style JSON) and must:

- Propose 1–3 strong candidate metros or regions per requested state.
- For each location, compute:
  - EducationScore (0–100), weight 0.45:
    - Public high school quality and pipeline (scores, AP/IB, college-going).
    - Proximity and quality of nearby public universities (esp. strong flagships).
  - FinancialFeasibilityScore (0–100), weight 0.25:
    - For a typical middle/upper-middle property in that metro, can conservative STR income
      during ~6 months/year plausibly cover interest + property tax (not necessarily principal)?
  - STRViabilityScore (0–100), weight 0.15:
    - Clarity and friendliness of short-term rental regulations for owner-occupied or mixed-use
      (live ~6 months, rent ~6 months).
  - LifestyleScore (0–100), weight 0.15:
    - Safety, amenities, airport access, Asian/Chinese community presence where relevant.

Then compute totalScore as the weighted combination.

Return ONLY this JSON shape:
{
  "locations": [
    {
      "id": "CA|SF Bay Area",
      "state": "CA",
      "label": "San Francisco Bay Area, CA",
      "totalScore": 0,
      "educationScore": 0,
      "financialScore": 0,
      "strViabilityScore": 0,
      "lifestyleScore": 0,
      "educationNotes": "",
      "financialNotes": "",
      "strNotes": "",
      "lifestyleNotes": "",
      "overallNotes": ""
    }
  ]
}

- Scores must be numbers between 0 and 100 (integers or decimals).
- Fill all required fields; notes can be short strings.
- Do NOT include any markdown, comments, or extra text outside the JSON.
`.trim();

    const userPrompt = `
Requested US state codes: ${JSON.stringify(requestedStates)}.

Here is raw web search data (Tavily-style JSON) about schools, universities, STR rules, and lifestyle for various locations in those states:
${JSON.stringify(searchJson, null, 2)}

Using ONLY this data plus your general knowledge, produce the JSON described in the system prompt.
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
            "Model returned an empty or non-text response when generating location scores.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    let parsed: LocationScoresResponse;
    try {
      parsed = JSON.parse(raw) as LocationScoresResponse;
      if (!parsed || !Array.isArray(parsed.locations)) {
        throw new Error("Parsed JSON is missing 'locations' array.");
      }
    } catch (err) {
      console.error("[location-scores API] Failed to parse JSON from model:", {
        error: err instanceof Error ? err.message : String(err),
        raw,
      });
      return new Response(
        JSON.stringify({
          error:
            "Failed to parse JSON from model when generating location scores. Check server logs for raw response.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const errObj = err as Record<string, unknown> | undefined;
    const status = typeof errObj?.status === "number" ? errObj.status : undefined;
    const code = typeof errObj?.code === "string" ? errObj.code : undefined;

    console.error("[location-scores API] Error:", {
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

