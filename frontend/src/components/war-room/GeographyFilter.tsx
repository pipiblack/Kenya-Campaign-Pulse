"use client";

import { useMemo } from "react";
import { ChevronDown, MapPinned, RotateCcw } from "lucide-react";
import type { Constituency, County, GeographySelection, Ward } from "@/types";

interface GeographyFilterProps {
  counties: County[];
  constituencies: Constituency[];
  wards: Ward[];
  selection: GeographySelection;
  onChange: (selection: GeographySelection) => void;
}

function SelectChevron() {
  return <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 h-4 w-4 text-slate-500" aria-hidden="true" />;
}

export function GeographyFilter({ counties, constituencies, wards, selection, onChange }: GeographyFilterProps) {
  const selectedCounty = useMemo(
    () => counties.find((county) => county.code === selection.countyCode),
    [counties, selection.countyCode],
  );
  const selectedConstituency = useMemo(
    () => constituencies.find((constituency) => constituency.code === selection.constituencyCode),
    [constituencies, selection.constituencyCode],
  );
  const selectedWard = useMemo(
    () => wards.find((ward) => ward.code === selection.wardCode),
    [wards, selection.wardCode],
  );
  const availableConstituencies = useMemo(
    () => selectedCounty ? constituencies.filter((constituency) => constituency.county_id === selectedCounty.id) : [],
    [constituencies, selectedCounty],
  );
  const availableWards = useMemo(
    () => selectedConstituency ? wards.filter((ward) => ward.constituency_id === selectedConstituency.id) : [],
    [selectedConstituency, wards],
  );
  const breadcrumb = [selectedCounty?.name, selectedConstituency?.name, selectedWard?.name].filter(Boolean).join(" / ");
  const hasSelection = selection.countyCode !== null;

  return (
    <section className="panel mx-auto mb-3 max-w-[1880px] p-4" aria-labelledby="geography-filter-title">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <div className="flex min-w-0 flex-1 items-start gap-3 xl:max-w-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal">
            <MapPinned className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="mono text-[9px] uppercase tracking-[0.2em] text-signal">Geographic focus</p>
            <h2 id="geography-filter-title" className="mt-1 text-base font-semibold">Choose the area you want to understand</h2>
            <p className="mt-1 text-xs text-slate-400">Start with a county, then narrow to a constituency or ward only when needed.</p>
          </div>
        </div>

        <div className="grid min-w-0 flex-[2] gap-2 sm:grid-cols-3">
          <label className="relative block">
            <span className="mono mb-1.5 block text-[9px] uppercase tracking-wider text-slate-500">1 · County</span>
            <select
              value={selection.countyCode ?? ""}
              onChange={(event) => onChange({ countyCode: event.target.value ? Number(event.target.value) : null, constituencyCode: null, wardCode: null })}
              className="w-full appearance-none rounded-xl border border-line bg-wash/[0.045] px-3 py-3 pr-10 text-sm font-medium text-slate-100"
            >
              <option value="">All 47 counties</option>
              {counties.map((county) => <option key={county.code} value={county.code}>{county.name}</option>)}
            </select>
            <SelectChevron />
          </label>

          <label className="relative block">
            <span className="mono mb-1.5 block text-[9px] uppercase tracking-wider text-slate-500">2 · Constituency</span>
            <select
              value={selection.constituencyCode ?? ""}
              disabled={!selectedCounty}
              onChange={(event) => onChange({ ...selection, constituencyCode: event.target.value ? Number(event.target.value) : null, wardCode: null })}
              className="w-full appearance-none rounded-xl border border-line bg-wash/[0.045] px-3 py-3 pr-10 text-sm font-medium text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <option value="">{selectedCounty ? `All ${selectedCounty.name} constituencies` : "Select a county first"}</option>
              {availableConstituencies.map((constituency) => <option key={constituency.code} value={constituency.code}>{constituency.name}</option>)}
            </select>
            <SelectChevron />
          </label>

          <label className="relative block">
            <span className="mono mb-1.5 block text-[9px] uppercase tracking-wider text-slate-500">3 · Ward</span>
            <select
              value={selection.wardCode ?? ""}
              disabled={!selectedConstituency}
              onChange={(event) => onChange({ ...selection, wardCode: event.target.value ? Number(event.target.value) : null })}
              className="w-full appearance-none rounded-xl border border-line bg-wash/[0.045] px-3 py-3 pr-10 text-sm font-medium text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <option value="">{selectedConstituency ? `All ${selectedConstituency.name} wards` : "Select a constituency first"}</option>
              {availableWards.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
            </select>
            <SelectChevron />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 xl:w-64 xl:flex-col xl:items-stretch">
          <div className="min-w-0 rounded-xl border border-line/70 bg-wash/[0.045] px-3 py-2">
            <p className="mono text-[8px] uppercase tracking-wider text-slate-500">Current view</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100" title={breadcrumb || "Kenya national overview"}>{breadcrumb || "Kenya national overview"}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ countyCode: null, constituencyCode: null, wardCode: null })}
            disabled={!hasSelection}
            className="flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-slate-300 transition hover:border-signal/40 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset to national
          </button>
        </div>
      </div>
    </section>
  );
}
