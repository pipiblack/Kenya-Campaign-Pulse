import { BellRing, ChartNoAxesCombined, MessageSquareText, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Alert, GeographySelection, SentimentSummary } from "@/types";

interface AreaBriefProps {
  scopeLabel: string;
  selection: GeographySelection;
  summary: SentimentSummary | null;
  alerts: Alert[];
}

function issueLabel(value?: string): string {
  return value ? value.replaceAll("_", " ") : "No issue data";
}

export function AreaBrief({ scopeLabel, selection, summary, alerts }: AreaBriefProps) {
  const total = summary?.total_mentions ?? 0;
  const score = summary?.net_sentiment ?? 0;
  const leadingIssue = summary?.axes.reduce((current, axis) => axis.volume > current.volume ? axis : current, summary.axes[0]);
  const activeAlerts = alerts.filter((alert) => alert.status !== "resolved").length;
  const isSubCounty = selection.constituencyCode !== null;
  const isLoading = summary === null;
  const mood = total === 0 ? "No data" : score > 0.15 ? "Positive" : score < -0.15 ? "Negative" : "Mixed";
  const MoodIcon = total === 0 ? Minus : score > 0.15 ? TrendingUp : score < -0.15 ? TrendingDown : Minus;
  const moodClass = total === 0 ? "text-slate-400" : score > 0.15 ? "text-emerald-400" : score < -0.15 ? "text-red-400" : "text-amber";
  const scopeKind = selection.wardCode ? "Ward view" : selection.constituencyCode ? "Constituency view" : selection.countyCode ? "County view" : "National view";
  const observation = isLoading
    ? `Loading the latest public intelligence for ${scopeLabel}…`
    : total === 0
    ? `No public signals are tagged to ${scopeLabel} in the last 24 hours. Widen the area or run a demo simulation for this scope.`
    : `${total.toLocaleString()} public signal${total === 1 ? "" : "s"} are tagged to ${scopeLabel}. Conversation is ${mood.toLowerCase()}${leadingIssue ? `, with ${issueLabel(leadingIssue.axis)} generating the most discussion` : ""}.`;

  return (
    <section className="panel mx-auto mb-3 max-w-[1880px] overflow-hidden" aria-labelledby="area-brief-title">
      <div className="grid gap-0 xl:grid-cols-[1.25fr_2fr]">
        <div className="border-b border-line/70 p-4 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mono text-[9px] uppercase tracking-[0.2em] text-signal">At-a-glance area brief</p>
              <h2 id="area-brief-title" className="mt-1 text-xl font-semibold text-slate-50">{scopeLabel}</h2>
            </div>
            <span className="mono rounded-full border border-line px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-400">{scopeKind} · 24h</span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{observation}</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-line/60 sm:grid-cols-4 sm:divide-y-0">
          <div className="p-4">
            <div className="flex items-center gap-2 text-slate-500"><MessageSquareText className="h-4 w-4" /><span className="mono text-[9px] uppercase tracking-wider">Public signals</span></div>
            <p className="mt-3 text-2xl font-semibold text-slate-50">{summary ? total.toLocaleString() : "—"}</p>
            <p className="mt-1 text-xs text-slate-500">Tagged in the last 24h</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-slate-500"><MoodIcon className="h-4 w-4" /><span className="mono text-[9px] uppercase tracking-wider">Conversation mood</span></div>
            <p className={`mt-3 text-2xl font-semibold ${moodClass}`}>{summary ? mood : "—"}</p>
            <p className="mono mt-1 text-xs text-slate-500">{total > 0 ? `${score >= 0 ? "+" : ""}${Math.round(score * 100)} net` : "Awaiting signals"}</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-slate-500"><ChartNoAxesCombined className="h-4 w-4" /><span className="mono text-[9px] uppercase tracking-wider">Main issue</span></div>
            <p className="mt-3 truncate text-lg font-semibold capitalize text-slate-50" title={issueLabel(leadingIssue?.axis)}>{summary ? issueLabel(leadingIssue?.axis) : "—"}</p>
            <p className="mt-1 text-xs text-slate-500">{leadingIssue ? `${leadingIssue.volume} related signals` : "No issue pattern yet"}</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-slate-500"><BellRing className="h-4 w-4" /><span className="mono text-[9px] uppercase tracking-wider">Open alerts</span></div>
            <p className="mt-3 text-2xl font-semibold text-slate-50">{isLoading ? "—" : activeAlerts}</p>
            <p className="mt-1 text-xs text-slate-500">{isLoading ? "Loading alert status" : isSubCounty ? "Reported at county level" : "Within the selected area"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
