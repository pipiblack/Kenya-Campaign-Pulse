"use client";

import { AlertOctagon, ArrowUpRight, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import type { Alert, SentimentSummary } from "@/types";

const SentimentMatrix = dynamic(() => import("./SentimentMatrix").then((module) => module.SentimentMatrix), { ssr: false });

export function SentryPanel({ alerts, summary, onOpen }: { alerts: Alert[]; summary: SentimentSummary | null; onOpen: (alert: Alert) => void }) {
  return (
    <section className="panel flex h-full min-h-[31rem] flex-col p-4" aria-labelledby="sentry-title">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-signal/70">Screen 03 · Threat watch</p>
          <h2 id="sentry-title" className="mt-1 text-lg font-semibold">KP-Sentry alerts</h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[10px] text-slate-400"><ShieldCheck className="h-3 w-3 text-signal" /> CIB ACTIVE</span>
      </div>

      <SentimentMatrix summary={summary} />

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-line/70 bg-wash/[0.045]">
        {alerts.map((alert) => (
          <button
            key={alert.id}
            type="button"
            onClick={() => onOpen(alert)}
            className="group flex w-full items-start gap-3 border-b border-line/60 p-3 text-left transition last:border-0 hover:bg-wash/[0.055]"
          >
            <span className={`mono grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${alert.severity >= 3 ? "bg-red-400/10 text-red-300" : "bg-amber/10 text-amber"}`}>T{alert.severity}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-200">{alert.title}</span>
              <span className="mono mt-1 block text-[9px] uppercase tracking-wider text-slate-500">{alert.county_name ?? "National"} · {alert.status}</span>
            </span>
            <ArrowUpRight className="mt-1 h-3.5 w-3.5 text-slate-600 transition group-hover:text-signal" />
          </button>
        ))}
        {alerts.length === 0 && <div className="grid h-28 place-items-center text-center text-xs text-slate-500"><span><AlertOctagon className="mx-auto mb-2 h-5 w-5" />No active threat alerts</span></div>}
      </div>
    </section>
  );
}

