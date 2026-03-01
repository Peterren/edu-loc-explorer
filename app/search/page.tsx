"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ClarifyResponse, PriceResult } from "../lib/types";
import RegionCard from "../components/RegionCard";
import LoadingState from "../components/LoadingState";

type Stage = "idle" | "clarifying" | "loading" | "results" | "error";

const EXAMPLES = ["Chanel Classic Flap Mini", "Hermes Birkin 25", "Harry Winston Ribbon Ring"];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [input, setInput] = useState("");
  const [clarify, setClarify] = useState<ClarifyResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PriceResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchPrices = useCallback(async (confirmedQuery: string, brand: string) => {
    setStage("loading");
    try {
      const res = await fetch("/api/price-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedQuery, brand }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Search failed");
      const data: PriceResult = await res.json();
      setResult(data);
      setStage("results");
      const url = new URL(window.location.href);
      url.searchParams.set("q", confirmedQuery);
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      setError(String(e));
      setStage("error");
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setInput(q);
      fetchPrices(q, "");
    }
  }, [searchParams, fetchPrices]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setInput(query);
    setStage("loading");
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Clarification failed");
      const data: ClarifyResponse = await res.json();
      setClarify(data);
      setAnswers({});
      setStage("clarifying");
    } catch (e) {
      setError(String(e));
      setStage("error");
    }
  };

  const handleClarifySubmit = () => {
    if (!clarify) return;
    const parts = [clarify.productSummary, ...Object.values(answers).filter(v => v && v !== "N/A" && v.trim() !== "")];
    const confirmedQuery = parts.join(" ");
    fetchPrices(confirmedQuery, clarify.brand);
  };

  const confirmedQuery = clarify
    ? [clarify.productSummary, ...Object.values(answers).filter(Boolean)].join(" ")
    : "";

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Luxury Price Compare", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 pb-16 pt-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-2xl font-light tracking-widest text-transparent uppercase">
            Luxury Price Compare
          </h1>
          <p className="mt-1 text-xs text-[#555]">
            Official pre-tax retail prices across 4 regions
          </p>
        </div>

        {/* IDLE */}
        {stage === "idle" && (
          <div className="flex flex-col gap-4">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(input); }}
              className="flex flex-col gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Chanel Classic Flap Mini, Harry Winston Ribbon Ring..."
                className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-base text-white placeholder-[#555] focus:border-[#444] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40"
              >
                Compare Prices
              </button>
            </form>
            <div className="flex flex-wrap gap-2 pt-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleSearch(ex)}
                  className="rounded-full border border-[#333] px-3 py-1.5 text-xs text-[#777] transition hover:border-amber-500/50 hover:text-amber-400"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CLARIFYING */}
        {stage === "clarifying" && clarify && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#555]">Detected</p>
              <p className="text-base font-light text-amber-400">
                {clarify.brand} &mdash; {clarify.productSummary}
              </p>
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-[#2a2a2a] bg-[#141414] p-4">
              {clarify.questions.map((q) => (
                <div key={q.id} className="flex flex-col gap-1.5">
                  <label className="text-sm text-[#aaa]">
                    {q.label}{q.required && <span className="ml-0.5 text-amber-500">*</span>}
                  </label>
                  {q.type === "select" ? (
                    <select
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      className="w-full rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:border-[#444] focus:outline-none"
                    >
                      <option value="">Select&hellip;</option>
                      {q.options?.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder={`Enter ${q.label.toLowerCase()}...`}
                      className="w-full rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder-[#555] focus:border-[#444] focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
            {confirmedQuery && (
              <p className="text-xs text-[#555]">Will search: <span className="text-[#777]">{confirmedQuery}</span></p>
            )}
            <button
              onClick={handleClarifySubmit}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              Search Prices
            </button>
            <button onClick={() => setStage("idle")} className="text-xs text-[#555] hover:text-[#777]">
              &larr; Back
            </button>
          </div>
        )}

        {/* LOADING */}
        {stage === "loading" && <LoadingState />}

        {/* RESULTS */}
        {stage === "results" && result && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-light uppercase tracking-widest text-white">
                {result.product}
              </h2>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-xs text-[#555]">{result.confirmedQuery}</p>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1 text-xs text-[#555] transition hover:text-amber-400"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {copied ? "Copied!" : "Share"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {result.regions.map((r) => (
                <RegionCard key={r.region} region={r} />
              ))}
            </div>
            <p className="text-center text-xs text-[#444]">{result.disclaimer}</p>
            <p className="text-center text-xs text-[#444]">FX rates updated daily</p>
            <button
              onClick={() => { setStage("idle"); setInput(""); setResult(null); router.push("/search"); }}
              className="mt-2 text-xs text-[#555] hover:text-[#777]"
            >
              &larr; Search again
            </button>
          </div>
        )}

        {/* ERROR */}
        {stage === "error" && (
          <div className="flex flex-col gap-4 rounded-xl border border-red-900/50 bg-red-950/30 p-4">
            <p className="text-sm text-red-400">Something went wrong: {error}</p>
            <button
              onClick={() => setStage("idle")}
              className="w-full rounded-xl border border-red-800/50 py-2 text-sm text-red-400 hover:bg-red-900/20"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SearchContent />
    </Suspense>
  );
}

