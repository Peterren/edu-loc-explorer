"use client";
import type { RegionPrice } from "../lib/types";

export default function RegionCard({ region }: { region: RegionPrice }) {
  const confidenceDot =
    region.confidence === "high" ? "bg-green-400" :
    region.confidence === "medium" ? "bg-yellow-400" : "bg-[#555]";
  const confidenceLabel =
    region.confidence === "high" ? "High confidence" :
    region.confidence === "medium" ? "Medium confidence" : "Not found";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] p-4 transition-colors hover:border-[#3a3a3a]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <span className="text-xl">{region.flag}</span>
          {region.region}
        </span>
        {region.isBest && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
            Best Price
          </span>
        )}
      </div>

      <div className="border-t border-[#2a2a2a]" />

      {/* Price */}
      {region.confidence === "unavailable" || !region.localPrice ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm italic text-[#555]">Price unavailable</span>
          <span className="text-xs text-[#555]">Brand may not list this item online</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-bold text-white">{region.localPrice}</span>
          <span className="text-base text-amber-400">&asymp; {region.priceUSDFormatted} USD</span>
          <span className="text-xs text-[#555]">{region.exchangeRate}</span>
        </div>
      )}

      <div className="border-t border-[#2a2a2a]" />

      {/* Footer */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-[#777]">{region.taxNote}</span>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${confidenceDot}`} />
          <span className="text-xs text-[#777]">{confidenceLabel}</span>
        </div>
        <a
          href={region.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 w-full rounded-lg border border-[#333] px-3 py-1.5 text-center text-xs text-[#999] transition-colors hover:border-amber-500/50 hover:text-amber-400"
        >
          View official site &rarr;
        </a>
      </div>
    </div>
  );
}
