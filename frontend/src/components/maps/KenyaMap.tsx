"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Map as MapIcon, MapPin, MousePointerClick } from "lucide-react";
import { boundsForFeatures, createProjection, featureCenter, geometryPath, type MapFeatureCollection } from "@/lib/geo";
import type { CountySignal } from "@/types";

interface KenyaMapProps {
  signals: CountySignal[];
  selectedCounty: number | null;
  selectedWard: number | null;
  onSelectCounty: (countyCode: number | null) => void;
  onSelectWard: (wardCode: number, constituencyCode: number) => void;
}

interface CountyMapProperties {
  county_code: number;
  county_name: string;
}

interface WardMapProperties {
  ward_code: number;
  ward_name: string;
  constituency_code: number;
  constituency_name: string;
  population_2009: number | null;
}

const MAP_WIDTH = 520;
const MAP_HEIGHT = 590;

function fillFor(signal?: CountySignal): string {
  if (!signal || signal.mentions === 0) return "rgb(var(--map-empty))";
  if (signal.threat_level >= 4) return "rgb(var(--map-critical))";
  if (signal.threat_level === 3) return "rgb(var(--map-threat))";
  if (signal.net_sentiment < -0.25) return "rgb(var(--map-negative))";
  if (signal.net_sentiment > 0.25) return "rgb(var(--map-positive))";
  return "rgb(var(--map-neutral))";
}

function KenyaMapComponent({ signals, selectedCounty, selectedWard, onSelectCounty, onSelectWard }: KenyaMapProps) {
  const [countyMap, setCountyMap] = useState<MapFeatureCollection<CountyMapProperties> | null>(null);
  const [wardMap, setWardMap] = useState<MapFeatureCollection<WardMapProperties> | null>(null);
  const [hoveredCounty, setHoveredCounty] = useState<number | null>(null);
  const [hoveredWard, setHoveredWard] = useState<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const signalByCode = useMemo(() => new Map(signals.map((signal) => [signal.county.code, signal])), [signals]);
  const selectedSignal = selectedCounty ? signalByCode.get(selectedCounty) : undefined;
  const selectedCountyName = selectedSignal?.county.name
    ?? countyMap?.features.find((feature) => feature.properties.county_code === selectedCounty)?.properties.county_name
    ?? "County";

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/maps/counties.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("County map could not be loaded");
        return response.json() as Promise<MapFeatureCollection<CountyMapProperties>>;
      })
      .then((data) => {
        setCountyMap(data);
        setMapError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setMapError(reason instanceof Error ? reason.message : "County map could not be loaded");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setHoveredWard(null);
    if (!selectedCounty) {
      setWardMap(null);
      return undefined;
    }
    const controller = new AbortController();
    setWardMap(null);
    fetch(`/data/maps/wards-${String(selectedCounty).padStart(2, "0")}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${selectedCountyName} ward map could not be loaded`);
        return response.json() as Promise<MapFeatureCollection<WardMapProperties>>;
      })
      .then((data) => {
        setWardMap(data);
        setMapError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setMapError(reason instanceof Error ? reason.message : "Ward map could not be loaded");
      });
    return () => controller.abort();
  }, [selectedCounty, selectedCountyName]);

  const projection = useMemo(() => {
    if (selectedCounty) {
      if (!wardMap?.features.length) return null;
      return createProjection(boundsForFeatures(wardMap.features), MAP_WIDTH, MAP_HEIGHT, 28);
    }
    if (!countyMap?.features.length) return null;
    return createProjection(boundsForFeatures(countyMap.features), MAP_WIDTH, MAP_HEIGHT, 22);
  }, [countyMap, selectedCounty, wardMap]);
  const hoveredSignal = hoveredCounty ? signalByCode.get(hoveredCounty) : undefined;
  const hoveredCountyFeature = countyMap?.features.find((feature) => feature.properties.county_code === hoveredCounty);
  const hoveredWardFeature = wardMap?.features.find((feature) => feature.properties.ward_code === hoveredWard);
  const constituencyCount = useMemo(
    () => new Set((wardMap?.features ?? []).map((feature) => feature.properties.constituency_code)).size,
    [wardMap],
  );
  const countyShapes = useMemo(() => {
    if (!countyMap || !projection || selectedCounty) return [];
    return countyMap.features.map((feature) => ({
      feature,
      path: geometryPath(feature.geometry, projection),
      center: featureCenter(feature, projection),
    }));
  }, [countyMap, projection, selectedCounty]);
  const wardShapes = useMemo(() => {
    if (!wardMap || !projection || !selectedCounty) return [];
    return wardMap.features.map((feature) => ({
      feature,
      path: geometryPath(feature.geometry, projection),
    }));
  }, [projection, selectedCounty, wardMap]);

  const activateCounty = (countyCode: number) => onSelectCounty(selectedCounty === countyCode ? null : countyCode);
  const activateWard = (wardCode: number, constituencyCode: number) => onSelectWard(wardCode, constituencyCode);

  return (
    <section className="panel scanline flex min-h-[31rem] self-start flex-col p-4" aria-labelledby="map-title">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-signal/70">Screen 01 · Geospatial signal</p>
          <h2 id="map-title" className="mt-1 text-lg font-semibold">{selectedCounty ? `${selectedCountyName} ward pulse` : "Kenya county pulse"}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {selectedCounty
              ? `${wardMap?.features.length ?? "—"} wards across ${constituencyCount || "—"} constituencies`
              : "Live intelligence across all 47 counties"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectCounty(null)}
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-slate-300 transition hover:border-signal/60 hover:text-signal"
        >
          {selectedCounty ? <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> : <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          {selectedCounty ? "Back to Kenya" : "National"}
        </button>
      </div>

      <div className="relative h-[25rem] flex-none overflow-hidden rounded-xl border border-line/70 bg-wash/[0.025]">
        {mapError ? (
          <div className="grid h-full min-h-80 place-items-center px-8 text-center text-sm text-red-300">{mapError}</div>
        ) : !projection ? (
          <div className="grid h-full min-h-80 place-items-center text-center text-sm text-slate-500">
            <div><MapPin className="mx-auto mb-2 h-6 w-6 animate-pulse text-signal" /><p>Loading boundary map…</p></div>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="h-full w-full drop-shadow-[0_14px_22px_rgba(8,28,23,0.12)]"
            role="group"
            aria-label={selectedCounty ? `Interactive map of ${selectedCountyName} wards` : "Interactive map of Kenya's 47 counties"}
          >
            {!selectedCounty && countyShapes.map(({ feature, path, center: [labelX, labelY] }) => {
              const { county_code: code, county_name: name } = feature.properties;
              const signal = signalByCode.get(code);
              return (
                <g
                  key={code}
                  role="button"
                  tabIndex={0}
                  aria-label={`${name}: ${signal?.mentions ?? 0} public signals, threat tier ${signal?.threat_level ?? 1}. Open ward map.`}
                  onMouseEnter={() => setHoveredCounty(code)}
                  onMouseLeave={() => setHoveredCounty(null)}
                  onFocus={() => setHoveredCounty(code)}
                  onBlur={() => setHoveredCounty(null)}
                  onClick={() => activateCounty(code)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activateCounty(code);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <path
                    d={path}
                    fill={fillFor(signal)}
                    fillRule="evenodd"
                    stroke={hoveredCounty === code ? "rgb(var(--signal))" : "rgb(var(--map-stroke))"}
                    strokeWidth={hoveredCounty === code ? 2.8 : 1.15}
                    vectorEffect="non-scaling-stroke"
                    className="transition-all duration-150 hover:brightness-125"
                  />
                  <text x={labelX} y={labelY + 2} textAnchor="middle" fill="rgb(var(--slate-50))" fontSize="9" fontWeight="700" pointerEvents="none">
                    {code.toString().padStart(2, "0")}
                  </text>
                  {signal && signal.threat_level >= 3 ? <circle cx={labelX + 7} cy={labelY - 7} r="3" fill="rgb(var(--amber))" pointerEvents="none" /> : null}
                </g>
              );
            })}

            {selectedCounty && wardShapes.map(({ feature, path }) => {
              const { ward_code: wardCode, ward_name: wardName, constituency_code: constituencyCode, constituency_name: constituencyName } = feature.properties;
              const selected = selectedWard === wardCode;
              const hovered = hoveredWard === wardCode;
              return (
                <g
                  key={wardCode}
                  role="button"
                  tabIndex={0}
                  aria-label={`${wardName} ward, ${constituencyName} constituency. Focus dashboard on this ward.`}
                  aria-pressed={selected}
                  onMouseEnter={() => setHoveredWard(wardCode)}
                  onMouseLeave={() => setHoveredWard(null)}
                  onFocus={() => setHoveredWard(wardCode)}
                  onBlur={() => setHoveredWard(null)}
                  onClick={() => activateWard(wardCode, constituencyCode)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activateWard(wardCode, constituencyCode);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <path
                    d={path}
                    fill={selected ? "rgb(var(--signal))" : hovered ? "rgb(var(--map-neutral))" : "rgb(var(--map-empty))"}
                    fillOpacity={selected ? 0.72 : hovered ? 0.8 : 0.62}
                    fillRule="evenodd"
                    stroke={selected || hovered ? "rgb(var(--signal))" : "rgb(var(--map-stroke))"}
                    strokeWidth={selected ? 2.5 : hovered ? 1.8 : 0.8}
                    vectorEffect="non-scaling-stroke"
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {!selectedCounty && hoveredCountyFeature ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-line bg-panel/95 p-3 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div><p className="mono text-[8px] uppercase tracking-wider text-signal">County {hoveredCountyFeature.properties.county_code.toString().padStart(2, "0")}</p><p className="mt-1 text-sm font-semibold">{hoveredCountyFeature.properties.county_name}</p></div>
              <div className="text-right"><p className="text-lg font-semibold">{hoveredSignal?.mentions ?? 0}</p><p className="text-[10px] text-slate-500">signals · click for wards</p></div>
            </div>
          </div>
        ) : null}

        {selectedCounty && hoveredWardFeature ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-line bg-panel/95 p-3 shadow-xl backdrop-blur">
            <p className="mono text-[8px] uppercase tracking-wider text-signal">{hoveredWardFeature.properties.constituency_name} constituency</p>
            <div className="mt-1 flex items-center justify-between gap-3"><p className="text-sm font-semibold">{hoveredWardFeature.properties.ward_name} Ward</p><p className="text-[10px] text-slate-500">Click to focus dashboard</p></div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />{selectedCounty ? "SELECT A WARD TO FOCUS ALL SCREENS" : "SELECT A COUNTY TO OPEN ITS WARD MAP"}</span>
        {!selectedCounty ? (
          <div className="flex items-center gap-3">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[rgb(var(--map-positive))]" />Positive</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[rgb(var(--map-neutral))]" />Neutral</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[rgb(var(--map-threat))]" />Threat</span>
          </div>
        ) : <span>{selectedSignal?.mentions ?? 0} county signals · ward boundaries</span>}
      </div>
    </section>
  );
}

export const KenyaMap = memo(KenyaMapComponent);

