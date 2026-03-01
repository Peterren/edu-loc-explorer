import { NextRequest, NextResponse } from "next/server";
import type { ClarifyResponse } from "../../lib/types";

export async function POST(req: NextRequest) {
  try {
    const { query, productUrl } = await req.json();
    const token = process.env.AI_BUILDER_TOKEN;

    const urlNote = productUrl ? `\nProduct URL provided: ${productUrl}\nUse the brand and product details from this URL to generate better clarifying questions.` : "";

    const res = await fetch("https://space.ai-builders.com/backend/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content: `You are a luxury goods expert. Given a product description, return ONLY valid JSON with clarifying questions to identify the exact SKU. No markdown, no code blocks.${urlNote}
Format: {"brand":"Harry Winston","productSummary":"Ribbon Diamond Wedding Band","productUrl":"https://...or null","questions":[{"id":"metal","label":"Metal","type":"select","options":["Platinum","18K White Gold","18K Yellow Gold","18K Rose Gold"],"required":true},{"id":"size","label":"Ring Size","type":"text","required":false}]}
Tailor questions to the product. For bands/rings: metal, stone type, width, size. For bags: size, leather, hardware, color. Keep to 3-5 most important questions. Mark size as required:false.`,
          },
          { role: "user", content: `Product: ${query}${urlNote}` },
        ],
      }),
    });

    if (!res.ok) throw new Error(`LLM error: ${res.status}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed: ClarifyResponse & { productUrl?: string } = JSON.parse(cleaned);
    // Inject the provided URL if the LLM didn't include it
    if (productUrl && !parsed.productUrl) parsed.productUrl = productUrl;
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
