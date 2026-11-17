"use client";

import { Headphones, PhoneCall, Timer, UsersRound } from "lucide-react";
import type { VoiceMetrics } from "@/types";

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof PhoneCall }) {
  return (
    <div className="rounded-xl border border-line/70 bg-wash/[0.045] p-3">
      <div className="flex items-center justify-between text-slate-500"><span className="mono text-[9px] uppercase tracking-wider">{label}</span><Icon className="h-3.5 w-3.5" /></div>
      <p className="mt-2 text-xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

export function VoicePanel({ metrics }: { metrics: VoiceMetrics | null }) {
  return (
    <section className="panel flex h-full min-h-[31rem] flex-col p-4" aria-labelledby="voice-title">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-signal/70">Screen 04 · CATI telemetry</p>
          <h2 id="voice-title" className="mt-1 text-lg font-semibold">KP-Voice operations</h2>
        </div>
        <span className="rounded-full border border-signal/20 bg-signal/5 px-2 py-1 text-[10px] uppercase text-signal">{metrics?.status ?? "offline"}</span>
      </div>

      <div className="rounded-xl border border-line/70 bg-wash/[0.045] p-4">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-signal/10 text-signal"><Headphones className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{metrics?.poll_name ?? "Loading active poll"}</p><p className="mt-0.5 text-xs text-slate-500">Stratified RDD national sample</p></div></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-wash/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-signal transition-all" style={{ width: `${(metrics?.completion_rate ?? 0) * 100}%` }} /></div>
        <div className="mono mt-2 flex justify-between text-[10px] text-slate-400"><span>{metrics?.completed.toLocaleString() ?? 0} complete</span><span>{((metrics?.completion_rate ?? 0) * 100).toFixed(1)}% / {metrics?.target_sample.toLocaleString() ?? 0}</span></div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Calls attempted" value={metrics?.calls_attempted.toLocaleString() ?? "—"} icon={PhoneCall} />
        <Metric label="Contact rate" value={`${((metrics?.contact_rate ?? 0) * 100).toFixed(1)}%`} icon={UsersRound} />
        <Metric label="Active agents" value={metrics?.active_agents.toString() ?? "—"} icon={Headphones} />
        <Metric label="Avg. handle" value={metrics ? `${Math.floor(metrics.average_handle_seconds / 60)}m ${metrics.average_handle_seconds % 60}s` : "—"} icon={Timer} />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-line/70 bg-wash/[0.045] p-3">
        <p className="mono mb-3 text-[9px] uppercase tracking-[0.2em] text-slate-500">Live quota attainment</p>
        <div className="space-y-3">
          {Object.entries(metrics?.quotas ?? {}).map(([quota, values]) => {
            const progress = values.complete / Math.max(1, values.target);
            return <div key={quota}><div className="mb-1 flex justify-between text-[11px]"><span className="capitalize text-slate-300">{quota.replaceAll("_", " ")}</span><span className="mono text-slate-500">{values.complete}/{values.target}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-wash/[0.07]"><div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.min(100, progress * 100)}%` }} /></div></div>;
          })}
        </div>
      </div>
    </section>
  );
}

