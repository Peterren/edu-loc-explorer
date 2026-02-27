import { NextRequest } from "next/server";
import OpenAI from "openai";

// Reuse the same base URL and token as chat API
const AI_BUILDERS_BASE_URL = "https://space.ai-builders.com/backend/v1";
const DEFAULT_MODEL = "grok-4-fast";

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

  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = new OpenAI({
      apiKey: token,
      baseURL: AI_BUILDERS_BASE_URL,
    });

    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You generate very short, descriptive titles for chat conversations.\n" +
            "- Output a title of at most 6 words.\n" +
            "- Capture the main topic or task.\n" +
            "- Do not include quotes or punctuation at the ends.\n" +
            "- Return only the title text.",
        },
        ...messages,
      ],
      max_tokens: 32,
    });

    const raw = completion.choices?.[0]?.message?.content;
    const title =
      typeof raw === "string"
        ? raw.trim().replace(/^[\"“]+|[\"”]+$/g, "")
        : "New chat";

    return new Response(
      JSON.stringify({ title: title || "New chat" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const errObj = err as Record<string, unknown> | undefined;
    const status = typeof errObj?.status === "number" ? errObj.status : undefined;
    const code = typeof errObj?.code === "string" ? errObj.code : undefined;

    console.error("[title API] Error:", {
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

