"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Radio, Sparkles } from "lucide-react";
import type { Mention } from "@/types";

const badgeStyles = {
  positive: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  neutral: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  negative: "border-red-400/30 bg-red-400/10 text-red-300",
};

export function LiveTicker({ mentions }: { mentions: Mention[] }) {
  return (
    <section className="panel flex h-full min-h-[31rem] flex-col p-4" aria-labelledby="ticker-title">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-signal/70">Screen 02 · Live ingest</p>
          <h2 id="ticker-title" className="mt-1 text-lg font-semibold">Public signal ticker</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 text-[10px] text-emerald-300">
          <Radio className="h-3 w-3" /> STREAMING
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        <AnimatePresence initial={false}>
          {mentions.map((mention) => (
            <motion.article
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              key={mention.id}
              className="rounded-xl border border-line/70 bg-wash/[0.045] p-3 transition hover:border-signal/20"
            >
              <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-slate-500">
                <span className="mono">{mention.source} · {mention.ward_name ?? mention.constituency_name ?? mention.county_name ?? "National"}</span>
                <span>{new Date(mention.collected_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="line-clamp-3 text-sm leading-5 text-slate-200">{mention.text}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${badgeStyles[mention.sentiment]}`}>
                  {mention.sentiment} {mention.score > 0 ? "+" : ""}{mention.score.toFixed(2)}
                </span>
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase text-slate-400">{mention.issue_axis.replaceAll("_", " ")}</span>
                {mention.sheng_detected && (
                  <span className="flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] uppercase text-amber">
                    <Sparkles className="h-2.5 w-2.5" /> Sheng
                  </span>
                )}
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
        {mentions.length === 0 && <p className="grid h-full place-items-center text-sm text-slate-500">Awaiting signals…</p>}
      </div>
    </section>
  );
}

