export default function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <p className="text-sm text-[#777]">Searching across 4 regions&hellip;</p>
      <div className="grid w-full grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-[#2a2a2a]" />
            <div className="border-t border-[#2a2a2a]" />
            <div className="h-8 w-32 animate-pulse rounded bg-[#2a2a2a]" />
            <div className="h-4 w-20 animate-pulse rounded bg-[#2a2a2a]" />
            <div className="border-t border-[#2a2a2a]" />
            <div className="h-3 w-full animate-pulse rounded bg-[#2a2a2a]" />
            <div className="h-7 w-full animate-pulse rounded-lg bg-[#2a2a2a]" />
          </div>
        ))}
      </div>
    </div>
  );
}
