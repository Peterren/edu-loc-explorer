import { NextRequest, NextResponse } from "next/server";
import type { ClarifyResponse } from "../../lib/types";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const token = process.env.AI_BUILDER_TOKEN;

    const res = await fetch("https://space.ai-builders.com/backend/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content: `You are a luxury goods expert. Given a product description, return ONLY valid JSON with clarifying questions to identify the exact SKU. No markdown, no code blocks. Format:
{"brand":"Chanel","productSummary":"Classic Flap Mini","questions":[{"id":"size","label":"Size","type":"select","options":["Mini 20cm","Small 23cm","Medium 25cm"],"required":true},{"id":"material","label":"Leather","type":"select","options":["Caviar","Lambskin","Tweed","Patent"],"required":true},{"id":"hardware","label":"Hardware","type":"select","options":["Gold","Silver","Ruthenium"],"required":true},{"id":"color","label":"Color","type":"text","required":true}]}
Tailor questions to the specific brand and product type. For jewelry include metal, stone, ring size optional. For bags include size, material, hardware, handle type, color.`,
          },
          { role: "user", content: query },
        ],
      }),
    });

    if (!res.ok) throw new Error(`LLM error: ${res.status}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed: ClarifyResponse = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
