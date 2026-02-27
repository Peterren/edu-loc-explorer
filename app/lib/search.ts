// We intentionally keep this very loose because the AI Builders Space
// /v1/search/ endpoint can return a Tavily-style structure keyed by
// keyword. We mostly treat it as opaque JSON and pass it through to
// the UI or an LLM for summarization.
export type TavilySearchResponse = unknown;

export type SearchAndSummaryResponse = {
  query: string;
  topic?: string;
  maxResults: number;
  searchDepth: string;
  raw: TavilySearchResponse;
  summary?: string;
};

