"use client";

import { useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { fipsToState, STATE_TO_NAME } from "../lib/stateCodes";
import type { StateCode } from "../lib/locationScores";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

type Props = {
  selectedStates: StateCode[];
  allowedStates: StateCode[];
  onToggleState: (code: StateCode) => void;
};

export default function USStateMap({ selectedStates, allowedStates, onToggleState }: Props) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseEnter = useCallback(
    (geo: { id?: string | number }) => {
      const code = geo.id != null ? fipsToState(geo.id) : null;
      if (code) {
        setHoveredState(code);
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredState(null);
    setCursorPos(null);
  }, []);

  const handleClick = useCallback(
    (geo: { id?: string | number }) => {
      const code = geo.id != null ? fipsToState(geo.id) : null;
      if (code && allowedStates.includes(code as StateCode)) {
        onToggleState(code as StateCode);
      }
    },
    [onToggleState, allowedStates]
  );

  return (
    <div
      className="relative w-full max-w-2xl rounded-lg border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--surface))]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{
          scale: 1000,
          center: [-96, 38],
        }}
        className="w-full h-auto"
      >
        <ZoomableGroup center={[-96, 38]} zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              (geographies as { id?: string | number; rsmKey?: string }[]).map((geo) => {
                const code = geo.id != null ? fipsToState(geo.id) : null;
                const allowed = code && allowedStates.includes(code as StateCode);
                const selected = code && selectedStates.includes(code);
                const hovered = code === hoveredState;
                const fill = !allowed
                  ? "#1f2937"
                  : selected
                    ? "#3b82f6"
                    : hovered
                      ? "#60a5fa"
                      : "#374151";
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#1f2937"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", cursor: allowed ? "pointer" : "default" },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={() => handleMouseEnter(geo)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleClick(geo)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Fixed tooltip near cursor */}
      {hoveredState && cursorPos && (
        <div
          className={`pointer-events-none fixed z-50 rounded-md border px-2 py-1 text-xs font-medium shadow-lg ${
            allowedStates.includes(hoveredState as StateCode)
              ? "border-gray-600 bg-gray-800 text-gray-100"
              : "border-amber-600/60 bg-gray-700 text-gray-300"
          }`}
          style={{ left: cursorPos.x + 12, top: cursorPos.y + 12 }}
        >
          {STATE_TO_NAME[hoveredState] || hoveredState} ({hoveredState})
          {!allowedStates.includes(hoveredState as StateCode) && (
            <span className="ml-1 block text-amber-400">— Not included in this search</span>
          )}
        </div>
      )}

      {/* In-map label on hover (always visible when hovering) */}
      {hoveredState && (
        <div
          className={`pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-md border px-3 py-1.5 text-sm font-medium shadow-lg ${
            allowedStates.includes(hoveredState as StateCode)
              ? "border-gray-600 bg-gray-800/95 text-gray-100"
              : "border-amber-600/60 bg-amber-900/40 text-amber-100"
          }`}
          style={{ minWidth: "max-content" }}
        >
          {allowedStates.includes(hoveredState as StateCode) ? (
            <>
              {STATE_TO_NAME[hoveredState] || hoveredState} ({hoveredState}) — Click
              to {selectedStates.includes(hoveredState as StateCode) ? "deselect" : "select"}
            </>
          ) : (
            <>
              {STATE_TO_NAME[hoveredState] || hoveredState} ({hoveredState}) — Not included in this search
            </>
          )}
        </div>
      )}
    </div>
  );
}
