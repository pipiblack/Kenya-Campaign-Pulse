"use client";

import { useState } from "react";
import { Activity, ChevronDown, LoaderCircle, Zap } from "lucide-react";
import type { CountySignal, Scenario } from "@/types";

interface PitchControlProps {
  counties: CountySignal[];
  selectedCounty: number | null;
  onInject: (countyCode: number, scenario: Scenario, intensity: number) => Promise<void>;
}

const scenarios: Array<{ value: Scenario; label: string }> = [
  { value: "cost_of_living", label: "Cost-of-living spike" },
  { value: "healthcare_outage", label: "Healthcare outage" },
  { value: "security_incident", label: "Security incident" },
  { value: "leadership_scandal", label: "Leadership scandal" },
];

export function PitchControl({ counties, selectedCounty, onInject }: PitchControlProps) {
  const [scenario, setScenario] = useState<Scenario>("cost_of_living");
  const [county, setCounty] = useState(32);
  const [intensity, setIntensity] = useState(78);
  const [loading, setLoading] = useState(false);
  const activeCounty = selectedCounty ?? county;

  async function inject() {
    setLoading(true);
    try {
      await onInject(activeCounty, scenario, intensity);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-5xl rounded-2xl border border-signal/20 bg-elevated/95 p-2 shadow-[0_12px_60px_rgba(0,0,0,.28)] backdrop-blur-xl sm:bottom-5" aria-label="Pitch simulation controls">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 px-2 py-1 sm:border-r sm:border-line sm:pr-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-signal/10 text-signal"><Activity className="h-4 w-4" /></span>
          <div>
            <p className="mono text-[9px] uppercase tracking-[0.2em] text-signal">Pitch control</p>
            <p className="text-xs text-slate-400">Live simulation</p>
          </div>
        </div>

        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Scenario</span>
          <select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)} className="w-full appearance-none rounded-xl border border-line bg-wash/[0.06] px-3 py-2 pr-8 text-xs text-slate-200">
            {scenarios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
        </label>

        <label className="relative min-w-0 flex-1">
          <span className="sr-only">County</span>
          <select value={activeCounty} disabled={selectedCounty !== null} onChange={(event) => setCounty(Number(event.target.value))} className="w-full appearance-none rounded-xl border border-line bg-wash/[0.06] px-3 py-2 pr-8 text-xs text-slate-200 disabled:opacity-70">
            {counties.map(({ county: item }) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
        </label>

        <label className="flex min-w-40 items-center gap-2 rounded-xl border border-line bg-wash/[0.06] px-3 py-2 text-[10px] text-slate-400">
          INTENSITY
          <input type="range" min="10" max="100" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="min-w-0 flex-1 accent-emerald-300" />
          <span className="mono w-7 text-right text-slate-200">{intensity}</span>
        </label>

        <button type="button" onClick={inject} disabled={loading || counties.length === 0} className="flex items-center justify-center gap-2 rounded-xl bg-signal px-4 py-2 text-xs font-bold text-on-signal transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} INJECT NARRATIVE
        </button>
      </div>
    </aside>
  );
}

