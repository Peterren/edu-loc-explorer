import { NextRequest } from "next/server";
import OpenAI from "openai";
import { AI_BUILDERS_BASE_URL, DEFAULT_MODEL } from "@/app/lib/sharedConfig";
import type { TavilySearchResponse, SearchAndSummaryResponse } from "@/app/lib/search";

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

  let query = "";
  let topic: string | undefined;
  let maxResults = 5;
  let searchDepth = "basic";
  let summarize = true;

  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (typeof body?.topic === "string" && body.topic.trim()) {
      topic = body.topic.trim();
    }
    if (typeof body?.maxResults === "number" && body.maxResults > 0 && body.maxResults <= 20) {
      maxResults = body.maxResults;
    }
    if (typeof body?.searchDepth === "string" && body.searchDepth.trim()) {
      searchDepth = body.searchDepth.trim();
    }
    if (typeof body?.summarize === "boolean") {
      summarize = body.summarize;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 1) Call AI Builders Space Tavily-backed search endpoint.
    const searchRes = await fetch(`${AI_BUILDERS_BASE_URL}/search/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        keywords: [query],
        max_results: maxResults,
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
      throw new Error(msg || "Search request failed");
    }

    const searchJson = (await searchRes.json()) as TavilySearchResponse;

    let summary: string | undefined;
    if (summarize) {
      const client = new OpenAI({
        apiKey: token,
        baseURL: AI_BUILDERS_BASE_URL,
      });

      const systemPrompt = `
You are a careful research summarizer.
- You receive results from a Tavily-style web search (array of sources with URL, title, and content).
- You must:
  - Synthesize a concise answer to the user's query.
  - Highlight 3–7 key findings.
  - Mention any major disagreements across sources.
  - Include inline source markers like [1], [2] that correspond to the order of sources you used.
`;

      const userContent = `
User query:
${query}

Search results (JSON):
${JSON.stringify(searchJson, null, 2)}
`;

      const completion = await client.chat.completions.create({
        model: DEFAULT_MODEL,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: userContent.trim() },
        ],
        max_tokens: 800,
      });

      const raw = completion.choices?.[0]?.message?.content;
      if (typeof raw === "string" && raw.trim()) {
        summary = raw.trim();
      }
    }

    const response: SearchAndSummaryResponse = {
      query,
      topic,
      maxResults,
      searchDepth,
      raw: searchJson,
      summary,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

