"use client";

import { useState } from "react";
import type { LocationScore, StateCode, LocationScoresResponse } from "../lib/locationScores";
import type { ZipSuggestion } from "../lib/zipSuggestions";
import type { ZipListing } from "../lib/zipListings";
import USStateMap from "../components/USStateMap";

const ALL_STATES: { code: StateCode; label: string }[] = [
  { code: "CA", label: "California" },
  { code: "WA", label: "Washington" },
  { code: "OR", label: "Oregon" },
  { code: "TX", label: "Texas" },
  { code: "MA", label: "Massachusetts" },
  { code: "MI", label: "Michigan" },
  { code: "WI", label: "Wisconsin" },
  { code: "MN", label: "Minnesota" },
  { code: "NJ", label: "New Jersey" },
  { code: "NY", label: "New York" },
];

export default function LocationsPage() {
  const [selectedStates, setSelectedStates] = useState<StateCode[]>(["CA", "WA", "TX"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LocationScore[] | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipLocation, setZipLocation] = useState<LocationScore | null>(null);
  const [zipResults, setZipResults] = useState<ZipSuggestion[] | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingZip, setListingZip] = useState<string | null>(null);
  const [listingResults, setListingResults] = useState<ZipListing[] | null>(null);

  const toggleState = (code: StateCode) => {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const clearAllStates = () => {
    setSelectedStates([]);
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setZipLocation(null);
    setZipResults(null);
    setZipError(null);
    setListingZip(null);
    setListingResults(null);
    setListingError(null);
    try {
      const res = await fetch("/api/location-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateCodes: selectedStates }),
      });
      if (!res.ok) {
        const text = await res.text();
        let err: { error?: string; apiError?: string } = { error: res.statusText };
        try {
          if (text) err = JSON.parse(text);
        } catch {
          if (text) err.error = text;
        }
        const msg = [res.status, err.error, err.apiError].filter(Boolean).join(" — ");
        throw new Error(msg || "Request failed");
      }
      const json = (await res.json()) as LocationScoresResponse;
      const sorted = [...json.locations].sort(
        (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)
      );
      setResults(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const fetchListings = async (zip: string, state: StateCode) => {
    setListingLoading(true);
    setListingError(null);
    setListingZip(zip);
    setListingResults(null);
    try {
      const res = await fetch("/api/zip-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, state }),
      });
      if (!res.ok) {
        const text = await res.text();
        let err: { error?: string; apiError?: string } = { error: res.statusText };
        try {
          if (text) err = JSON.parse(text);
        } catch {
          if (text) err.error = text;
        }
        const msg = [res.status, err.error, err.apiError].filter(Boolean).join(" — ");
        throw new Error(msg || "Request failed");
      }
      const json = (await res.json()) as { listings: ZipListing[] };
      setListingResults(json.listings ?? []);
    } catch (e) {
      setListingError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setListingLoading(false);
    }
  };

  const fetchZips = async (loc: LocationScore) => {
    setZipLoading(true);
    setZipError(null);
    setZipLocation(loc);
    setZipResults(null);
    try {
      const res = await fetch("/api/zip-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: loc.state,
          label: loc.label,
          locationId: loc.id,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let err: { error?: string; apiError?: string } = { error: res.statusText };
        try {
          if (text) err = JSON.parse(text);
        } catch {
          if (text) err.error = text;
        }
        const msg = [res.status, err.error, err.apiError].filter(Boolean).join(" — ");
        throw new Error(msg || "Request failed");
      }
      const json = (await res.json()) as { zips: ZipSuggestion[] };
      setZipResults(json.zips ?? []);
    } catch (e) {
      setZipError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col bg-[hsl(var(--surface))] text-gray-100">
      <header className="border-b border-[hsl(var(--border))] px-4 py-3">
        <h1 className="text-lg font-semibold">Education + Airbnb Location Explorer</h1>
        <p className="text-xs text-gray-400">
          Select states, then rank metros by education, financial feasibility, STR rules, and
          lifestyle. Data is fetched live via the AI Builders Space Tavily search API.
        </p>
      </header>

      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-medium text-gray-300">Select states:</div>
          <div className="flex flex-wrap gap-2">
            {ALL_STATES.map((s) => {
              const active = selectedStates.includes(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => toggleState(s.code)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-blue-400 bg-blue-500/20 text-blue-100"
                      : "border-[hsl(var(--border))] bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={clearAllStates}
            disabled={selectedStates.length === 0}
            title="Unselect all states"
            className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-900/40 hover:text-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unselect all
          </button>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading || selectedStates.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Run analysis"}
          </button>
        </div>

        <details className="mt-3 group/map">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-white/5 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-gray-100 [&::-webkit-details-marker]:hidden">
            <span className="transition group-open/map:rotate-90">›</span>
            <span className="group-open/map:hidden">Show map</span>
            <span className="hidden group-open/map:inline">Hide map</span>
          </summary>
          <div className="mt-2 flex justify-center">
            <USStateMap
              selectedStates={selectedStates}
              allowedStates={ALL_STATES.map((s) => s.code)}
              onToggleState={toggleState}
            />
          </div>
        </details>

        {error && (
          <p className="mt-2 text-xs text-red-400">
            Error: {error}
          </p>
        )}
      </section>

      <section className="flex-1 overflow-y-auto px-4 py-4">
        <details className="group mb-4 rounded-lg border border-[hsl(var(--border))] bg-white/5">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-300 transition hover:text-gray-100 [&::-webkit-details-marker]:hidden">
            <span className="transition group-open:rotate-90">›</span>
            How scores are calculated
          </summary>
          <div className="border-t border-[hsl(var(--border))] px-4 py-3 text-xs text-gray-300">
            <p className="mb-3">
              Each metro is ranked using web search data (Tavily) and an AI model (Grok). The total
              score is a weighted combination of four sub-scores (0–100 each):
            </p>
            <ul className="space-y-2">
              <li>
                <span className="font-semibold text-blue-300">Education (45%)</span> — Public high
                school quality, AP/IB pipeline, college-going rates, and proximity to strong public
                universities.
              </li>
              <li>
                <span className="font-semibold text-blue-300">Financial (25%)</span> — Whether
                conservative STR income during ~6 months/year can plausibly cover interest and
                property tax for a typical middle/upper-middle property.
              </li>
              <li>
                <span className="font-semibold text-blue-300">STR viability (15%)</span> —
                Clarity and friendliness of short-term rental rules for owner-occupied or mixed-use
                (live ~6 months, rent ~6 months).
              </li>
              <li>
                <span className="font-semibold text-blue-300">Lifestyle (15%)</span> — Safety,
                amenities, airport access, and community presence where relevant.
              </li>
            </ul>
          </div>
        </details>

        {!results && !loading && !error && (
          <p className="text-sm text-gray-400">
            Select one or more states and click <span className="font-semibold">Run analysis</span>{" "}
            to see candidate metros ranked by their overall score. You can expand each row for
            detailed explanations of the sub-scores.
          </p>
        )}

        {loading && (
          <p className="text-sm text-gray-400">
            Running analysis using AI Builders Space Tavily search and Grok-4-Fast…
          </p>
        )}

        {results && results.length === 0 && !loading && (
          <p className="text-sm text-gray-400">
            No candidate locations were returned for the selected states.
          </p>
        )}

        {results && results.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-[hsl(var(--border))] bg-white/5 text-gray-300">
                <tr>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Education</th>
                  <th className="px-3 py-2">Financial</th>
                  <th className="px-3 py-2">STR</th>
                  <th className="px-3 py-2">Lifestyle</th>
                  <th className="px-3 py-2">ZIPs</th>
                </tr>
              </thead>
              <tbody>
                {results.map((loc, idx) => (
                  <tr
                    key={loc.id}
                    className={idx % 2 === 0 ? "bg-white/0" : "bg-white/5"}
                  >
                    <td className="px-3 py-2 align-top text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 align-top">
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-gray-100">
                          {loc.label}
                        </summary>
                        <div className="mt-1 space-y-1 text-[11px] text-gray-300">
                          {loc.overallNotes && (
                            <p>
                              <span className="font-semibold">Overall:</span> {loc.overallNotes}
                            </p>
                          )}
                          {loc.educationNotes && (
                            <p>
                              <span className="font-semibold">Education:</span> {loc.educationNotes}
                            </p>
                          )}
                          {loc.financialNotes && (
                            <p>
                              <span className="font-semibold">Financial:</span> {loc.financialNotes}
                            </p>
                          )}
                          {loc.strNotes && (
                            <p>
                              <span className="font-semibold">STR:</span> {loc.strNotes}
                            </p>
                          )}
                          {loc.lifestyleNotes && (
                            <p>
                              <span className="font-semibold">Lifestyle:</span>{" "}
                              {loc.lifestyleNotes}
                            </p>
                          )}
                        </div>
                      </details>
                    </td>
                    <td className="px-3 py-2 align-top text-gray-200">{loc.state}</td>
                    <td className="px-3 py-2 align-top text-gray-100">
                      {Math.round(loc.totalScore)}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-200">
                      {Math.round(loc.educationScore)}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-200">
                      {Math.round(loc.financialScore)}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-200">
                      {Math.round(loc.strViabilityScore)}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-200">
                      {Math.round(loc.lifestyleScore)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => fetchZips(loc)}
                        className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-gray-100 transition hover:bg-white/20"
                      >
                        View ZIPs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {zipLocation && (
          <div className="mt-4 space-y-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 text-[11px] text-gray-200">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold">
                  ZIP suggestions for {zipLocation.label} ({zipLocation.state})
                </div>
                <div className="text-[10px] text-gray-400">
                  Based on Tavily search results and the same education + STR criteria.
                </div>
              </div>
              {zipLoading && (
                <span className="text-[10px] text-gray-400">Loading ZIPs…</span>
              )}
            </div>
            {zipError && (
              <p className="text-[10px] text-red-400">
                Error loading ZIPs: {zipError}
              </p>
            )}
            {!zipLoading && zipResults && zipResults.length === 0 && !zipError && (
              <p className="text-[10px] text-gray-400">
                No ZIP suggestions were returned for this location.
              </p>
            )}
            {!zipLoading && zipResults && zipResults.length > 0 && (
              <ul className="space-y-1">
                {zipResults.map((z) => (
                  <li key={z.zip} className="rounded-md bg-white/5 px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {z.zip}
                          {z.city ? ` – ${z.city}` : ""}
                        </span>
                        <div className="mt-0.5 space-y-0.5 text-[10px] text-gray-300">
                          {z.educationNotes && (
                            <p>
                              <span className="font-semibold">Edu:</span> {z.educationNotes}
                            </p>
                          )}
                          {z.strNotes && (
                            <p>
                              <span className="font-semibold">STR:</span> {z.strNotes}
                            </p>
                          )}
                          {z.overallNotes && (
                            <p>
                              <span className="font-semibold">Overall:</span> {z.overallNotes}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-300">
                        Score: {Math.round(z.score)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => fetchListings(z.zip, z.state)}
                        className="rounded-md bg-blue-500/60 px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-blue-500"
                      >
                        View listings
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {listingZip && (
              <div className="mt-3 space-y-1 rounded-md bg-black/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold">
                    Listings for ZIP {listingZip}
                  </span>
                  {listingLoading && (
                    <span className="text-[10px] text-gray-400">Loading listings…</span>
                  )}
                </div>
                {listingError && (
                  <p className="text-[10px] text-red-400">
                    Error loading listings: {listingError}
                  </p>
                )}
                {!listingLoading && listingResults && listingResults.length === 0 && !listingError && (
                  <p className="text-[10px] text-gray-400">
                    No listings were returned for this ZIP. Try opening the portals directly.
                  </p>
                )}
                {!listingLoading && listingResults && listingResults.length > 0 && (
                  <ul className="space-y-1">
                    {listingResults.map((l, idx) => (
                      <li key={`${l.url}-${idx}`} className="rounded bg-white/5 px-2 py-1">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-blue-300 hover:underline"
                          >
                            {l.title || l.url}
                          </a>
                          {l.price && (
                            <span className="text-[10px] text-gray-200">{l.price}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-300">
                          {l.source && (
                            <span className="mr-2 text-gray-400">{l.source}</span>
                          )}
                          {l.summary}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Future enhancement: a US heatmap that colors states by the best location score. */}
      </section>
    </main>
  );
}

