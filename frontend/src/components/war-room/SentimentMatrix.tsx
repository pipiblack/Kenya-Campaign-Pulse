"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SentimentSummary } from "@/types";

export function SentimentMatrix({ summary }: { summary: SentimentSummary | null }) {
  const axes = summary?.axes.map((axis) => ({ ...axis, label: axis.axis.replaceAll("_", " ") })) ?? [];
  return (
    <div className="rounded-xl border border-line/70 bg-wash/[0.045] p-3">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="mono text-[9px] uppercase tracking-[0.2em] text-slate-500">Issue-axis matrix</p>
          <p className="mt-1 text-2xl font-semibold">{summary ? `${summary.net_sentiment >= 0 ? "+" : ""}${(summary.net_sentiment * 100).toFixed(0)}` : "—"}<span className="ml-1 text-xs font-normal text-slate-500">net</span></p>
        </div>
        <p className="mono text-[10px] text-slate-400">{summary?.total_mentions ?? 0} SIGNALS / 24H</p>
      </div>
      <div className="h-36" aria-label="Sentiment by issue axis">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={axes} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 2 }}>
            <XAxis type="number" domain={[-1, 1]} hide />
            <YAxis type="category" dataKey="label" width={92} tick={{ fill: "rgb(var(--slate-500))", fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,.025)" }}
              contentStyle={{ background: "rgb(var(--elevated))", border: "1px solid rgb(var(--line))", borderRadius: 10, color: "rgb(var(--slate-100))", fontSize: 11 }}
              formatter={(value) => [Number(value).toFixed(2), "Sentiment"]}
            />
            <Bar dataKey="score" radius={[3, 3, 3, 3]}>
              {axes.map((axis) => <Cell key={axis.axis} fill={axis.score >= 0 ? "rgb(var(--map-positive))" : "rgb(var(--map-critical))"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-wider">
        <span className="rounded-lg bg-emerald-400/8 py-1.5 text-emerald-300">{summary?.positive ?? 0} positive</span>
        <span className="rounded-lg bg-slate-400/8 py-1.5 text-slate-300">{summary?.neutral ?? 0} neutral</span>
        <span className="rounded-lg bg-red-400/8 py-1.5 text-red-300">{summary?.negative ?? 0} negative</span>
      </div>
    </div>
  );
}

