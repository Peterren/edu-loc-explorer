'use client';

import { useState } from 'react';
import { useShortlist } from './ShortlistContext';

type ScoreCategory = 'education' | 'financial' | 'str' | 'lifestyle' | 'total';

const CATEGORY_COLORS: Record<ScoreCategory, string> = {
  education: 'text-indigo-400 bg-indigo-500/20 border border-indigo-500/40',
  financial: 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/40',
  str: 'text-violet-400 bg-violet-500/20 border border-violet-500/40',
  lifestyle: 'text-amber-400 bg-amber-500/20 border border-amber-500/40',
  total: 'text-white bg-white/10',
};

function ScorePill({
  score,
  category,
  isWinner = false,
}: {
  score: number;
  category: ScoreCategory;
  isWinner?: boolean;
}) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[category]} ${
        isWinner ? 'ring-1 ring-green-400' : ''
      }`}
    >
      {Math.round(score)}
    </span>
  );
}

function FilledStarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ShortlistPanel() {
  const { shortlist, removeFromShortlist } = useShortlist();
  const [panelOpen, setPanelOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const exportCSV = () => {
    if (shortlist.length < 2) return;
    const [a, b] = shortlist;
    const rows = [
      ['Category', a.label, b.label],
      ['Total', String(Math.round(a.totalScore)), String(Math.round(b.totalScore))],
      ['Education', String(Math.round(a.educationScore)), String(Math.round(b.educationScore))],
      ['Financial', String(Math.round(a.financialScore)), String(Math.round(b.financialScore))],
      ['STR', String(Math.round(a.strViabilityScore)), String(Math.round(b.strViabilityScore))],
      ['Lifestyle', String(Math.round(a.lifestyleScore)), String(Math.round(b.lifestyleScore))],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metro-comparison.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const compareRows: { label: string; category: ScoreCategory; getScore: (i: 0 | 1) => number }[] =
    [
      { label: 'Total', category: 'total', getScore: (i) => shortlist[i]?.totalScore ?? 0 },
      {
        label: 'Education',
        category: 'education',
        getScore: (i) => shortlist[i]?.educationScore ?? 0,
      },
      {
        label: 'Financial',
        category: 'financial',
        getScore: (i) => shortlist[i]?.financialScore ?? 0,
      },
      { label: 'STR', category: 'str', getScore: (i) => shortlist[i]?.strViabilityScore ?? 0 },
      {
        label: 'Lifestyle',
        category: 'lifestyle',
        getScore: (i) => shortlist[i]?.lifestyleScore ?? 0,
      },
    ];

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setPanelOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-white shadow-lg transition hover:bg-indigo-500"
        title="Saved metros"
      >
        <FilledStarIcon />
        {shortlist.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-indigo-700">
            {shortlist.length}
          </span>
        )}
      </button>

      {/* Slide-up panel */}
      {panelOpen && (
        <div className="fixed bottom-20 right-6 z-40 w-72 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-100">
              Saved metros ({shortlist.length}/2)
            </span>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-gray-400 transition hover:text-gray-100"
              aria-label="Close panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {shortlist.length === 0 && (
            <p className="text-xs text-gray-400">No metros saved yet. Star up to 2.</p>
          )}

          <ul className="space-y-1">
            {shortlist.map((loc) => (
              <li
                key={loc.id}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-100"
              >
                <span className="truncate pr-2">{loc.label}</span>
                <button
                  type="button"
                  onClick={() => removeFromShortlist(loc.id)}
                  className="flex-shrink-0 text-gray-400 transition hover:text-red-400"
                  aria-label={`Remove ${loc.label}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-3.5 w-3.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18 18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {shortlist.length === 2 && (
            <button
              type="button"
              onClick={() => {
                setPanelOpen(false);
                setCompareOpen(true);
              }}
              className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              Compare
            </button>
          )}
        </div>
      )}

      {/* Compare modal */}
      {compareOpen && shortlist.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-2xl">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setCompareOpen(false)}
              className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-100"
              aria-label="Close compare"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-5 text-base font-bold text-gray-100">Compare Metros</h2>

            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="pb-3 text-left text-xs font-medium text-gray-400">Category</th>
                  <th className="pb-3 text-center text-xs font-semibold text-gray-100">
                    {shortlist[0].label}
                  </th>
                  <th className="pb-3 text-center text-xs font-semibold text-gray-100">
                    {shortlist[1].label}
                  </th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map(({ label, category, getScore }) => {
                  const s0 = getScore(0);
                  const s1 = getScore(1);
                  return (
                    <tr key={category} className="border-t border-white/10">
                      <td className="py-2.5 text-xs text-gray-300">{label}</td>
                      <td className="py-2.5 text-center">
                        <ScorePill score={s0} category={category} isWinner={s0 >= s1} />
                      </td>
                      <td className="py-2.5 text-center">
                        <ScorePill score={s1} category={category} isWinner={s1 >= s0} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={exportCSV}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
