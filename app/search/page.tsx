"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ProductInfo, PriceResult } from "../lib/types";
import RegionCard from "../components/RegionCard";
import LoadingState from "../components/LoadingState";

type Stage = "idle" | "loading" | "results" | "error";

const EXAMPLES = [
  { label: "Harry Winston Ribbon Band", url: "https://www.harrywinston.com/en/products/diamond-bands-by-harry-winston/ribbon-diamond-wedding-band-wbdprdpar" },
  { label: "Chanel Classic Flap", url: "https://www.chanel.com/us/fashion/p/A01112Y01864C3906/classic-handbag-grained-calfskin-silver-tone-metal/" },
  { label: "Cartier Love Bracelet", url: "https://www.cartier.com/en-us/jewelry/bracelets/love-collection/love-bracelet-B6035517.html" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [urlInput, setUrlInput] = useState("");
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [result, setResult] = useState<PriceResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchPrices = useCallback(async (info: ProductInfo) => {
    setStage("loading");
    try {
      const res = await fetch("/api/price-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmedQuery: `${info.brand} ${info.product}${info.sku ? " " + info.sku : ""}`,
          brand: info.brand,
          productUrl: info.officialUrl,
          homeRegion: info.homeRegion,
          homePrice: info.homePrice,
          homeCurrency: info.homeCurrency,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Search failed");
      const data: PriceResult = await res.json();
      setResult(data);
      setStage("results");
      const url = new URL(window.location.href);
      url.searchParams.set("q", info.officialUrl);
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      setError(String(e));
      setStage("error");
    }
  }, []);

  const handleIdentify = useCallback(async (inputUrl: string) => {
    if (!inputUrl.trim()) return;
    setUrlInput(inputUrl);
    setStage("loading");
    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });
      if (!res.ok) throw new Error("Could not identify product");
      const info: ProductInfo = await res.json();
      setProductInfo(info);
      await fetchPrices(info);
    } catch (e) {
      setError(String(e));
      setStage("error");
    }
  }, [fetchPrices]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q.startsWith("http")) {
      setUrlInput(q);
      handleIdentify(q);
    }
  }, [searchParams, handleIdentify]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Luxury Price Compare", url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const reset = () => {
    setStage("idle");
    setUrlInput("");
    setProductInfo(null);
    setResult(null);
    router.push("/search");
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
            Paste an official product URL &mdash; we find the price in every region
          </p>
        </div>

        {/* IDLE */}
        {stage === "idle" && (
          <div className="flex flex-col gap-4">
            <form onSubmit={(e) => { e.preventDefault(); handleIdentify(urlInput); }} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#555] uppercase tracking-widest">Official product URL</label>
                <textarea
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.harrywinston.com/en/products/..."
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-sm text-white placeholder-[#555] focus:border-[#444] focus:outline-none"
                />
                <p className="text-xs text-[#444]">Works with Chanel, Cartier, Harry Winston, Hermès, Louis Vuitton, Van Cleef &amp; more</p>
              </div>
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40"
              >
                Compare Prices Across Regions
              </button>
            </form>

            {/* Examples */}
            <div className="mt-2">
              <p className="mb-2 text-xs text-[#444] uppercase tracking-widest">Try an example</p>
              <div className="flex flex-col gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.url}
                    onClick={() => handleIdentify(ex.url)}
                    className="w-full rounded-xl border border-[#222] bg-[#141414] px-4 py-3 text-left transition hover:border-amber-500/30 hover:bg-[#1a1a1a]"
                  >
                    <span className="text-sm text-white">{ex.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#555]">{ex.url}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {stage === "loading" && (
          <div className="flex flex-col gap-4">
            {productInfo ? (
              <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3">
                <p className="text-xs text-[#555] uppercase tracking-widest">Identified</p>
                <p className="text-base text-white font-light">{productInfo.brand} &mdash; {productInfo.product}</p>
                {productInfo.homePriceLabel && (
                  <p className="text-sm text-amber-400">{productInfo.homeFlag} {productInfo.homeRegion}: {productInfo.homePriceLabel}</p>
                )}
              </div>
            ) : null}
            <LoadingState />
          </div>
        )}

        {/* RESULTS */}
        {stage === "results" && result && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3">
              <p className="text-xs text-[#555] uppercase tracking-widest">{result.brand}</p>
              <h2 className="text-lg font-light uppercase tracking-widest text-white">{result.product}</h2>
              <div className="mt-1 flex items-center gap-3">
                <a href={urlInput} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-[#555] hover:text-amber-400 transition">
                  {urlInput}
                </a>
                <button onClick={handleShare} className="shrink-0 flex items-center gap-1 text-xs text-[#555] hover:text-amber-400 transition">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {copied ? "Copied!" : "Share"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {result.regions.map((r) => <RegionCard key={r.region} region={r} />)}
            </div>
            <p className="text-center text-xs text-[#444]">{result.disclaimer}</p>
            <p className="text-center text-xs text-[#444]">Exchange rates updated daily</p>
            <button onClick={reset} className="mt-2 text-xs text-[#555] hover:text-[#777]">&larr; Compare another product</button>
          </div>
        )}

        {/* ERROR */}
        {stage === "error" && (
          <div className="flex flex-col gap-4 rounded-xl border border-red-900/50 bg-red-950/30 p-4">
            <p className="text-sm text-red-400">Something went wrong: {error}</p>
            <button onClick={reset} className="w-full rounded-xl border border-red-800/50 py-2 text-sm text-red-400 hover:bg-red-900/20">Try again</button>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
