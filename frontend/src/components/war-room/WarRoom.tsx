"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BellRing, CircleAlert, Command, RadioTower, type LucideIcon } from "lucide-react";
import { KenyaMap } from "@/components/maps/KenyaMap";
import { ThemeToggle } from "@/components/ThemeToggle";
import { pulseApi } from "@/lib/api";
import { connectPulseStream } from "@/lib/sse";
import type { Alert, Constituency, CountySignal, GeographySelection, Mention, Scenario, SentimentSummary, VoiceMetrics, Ward } from "@/types";
import { AlertModal } from "./AlertModal";
import { AreaBrief } from "./AreaBrief";
import { GeographyFilter } from "./GeographyFilter";
import { LiveTicker } from "./LiveTicker";
import { PitchControl } from "./PitchControl";
import { SentryPanel } from "./SentryPanel";
import { VoicePanel } from "./VoicePanel";

export type WarRoomFocus = "sense" | "sentry" | "voice" | "command";

const NAV_ITEMS: Array<{ href: string; label: string; focus: WarRoomFocus; icon: LucideIcon }> = [
  { href: "/dashboard/sense", label: "Sense", focus: "sense", icon: Activity },
  { href: "/dashboard/sentry", label: "Sentry", focus: "sentry", icon: BellRing },
  { href: "/dashboard/voice", label: "Voice", focus: "voice", icon: RadioTower },
  { href: "/dashboard/command", label: "Command", focus: "command", icon: Command },
];

export function WarRoom({ focus = "command" }: { focus?: WarRoomFocus }) {
  const [selection, setSelection] = useState<GeographySelection>({ countyCode: null, constituencyCode: null, wardCode: null });
  const [signals, setSignals] = useState<CountySignal[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<SentimentSummary | null>(null);
  const [voice, setVoice] = useState<VoiceMetrics | null>(null);
  const [modalAlert, setModalAlert] = useState<Alert | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopedRequestVersion = useRef(0);

  const loadReferenceData = useCallback(async () => {
    try {
      const [signalData, constituencyData, wardData, voiceData] = await Promise.all([
        pulseApi.countyMap(),
        pulseApi.constituencies(),
        pulseApi.wards(),
        pulseApi.voice(),
      ]);
      setSignals(signalData);
      setConstituencies(constituencyData);
      setWards(wardData);
      setVoice(voiceData);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load geography data");
    }
  }, []);

  const loadScopedData = useCallback(async () => {
    const requestVersion = ++scopedRequestVersion.current;
    try {
      const [summaryData, mentionData, alertData] = await Promise.all([
        pulseApi.summary(selection),
        pulseApi.mentions(selection),
        pulseApi.alerts(selection.countyCode),
      ]);
      if (requestVersion === scopedRequestVersion.current) {
        setSummary(summaryData);
        setMentions(mentionData);
        setAlerts(alertData);
        setError(null);
      }
    } catch (reason) {
      if (requestVersion === scopedRequestVersion.current) {
        setError(reason instanceof Error ? reason.message : "Unable to load area intelligence");
      }
    }
  }, [selection]);

  const changeSelection = useCallback((nextSelection: GeographySelection) => {
    scopedRequestVersion.current += 1;
    setSummary(null);
    setMentions([]);
    setAlerts([]);
    setSelection(nextSelection);
  }, []);

  useEffect(() => { void loadReferenceData(); }, [loadReferenceData]);
  useEffect(() => { void loadScopedData(); }, [loadScopedData]);

  useEffect(() => connectPulseStream({
    onMention: () => { void loadScopedData(); },
    onAlert: (data) => {
      const alert = data as Alert;
      if (selection.countyCode === null || alert.county_code === selection.countyCode) setModalAlert(alert);
      void loadScopedData();
      void pulseApi.countyMap().then(setSignals);
    },
    onAlertUpdate: () => { void loadScopedData(); },
    onConnection: setConnected,
  }), [loadScopedData, selection.countyCode]);

  const counties = useMemo(() => signals.map((item) => item.county), [signals]);
  const selectedCounty = useMemo(() => counties.find((county) => county.code === selection.countyCode), [counties, selection.countyCode]);
  const selectedConstituency = useMemo(() => constituencies.find((item) => item.code === selection.constituencyCode), [constituencies, selection.constituencyCode]);
  const selectedWard = useMemo(() => wards.find((item) => item.code === selection.wardCode), [wards, selection.wardCode]);
  const scopeLabel = selectedWard?.name ?? selectedConstituency?.name ?? selectedCounty?.name ?? "Kenya national overview";

  async function inject(countyCode: number, scenario: Scenario, intensity: number) {
    try {
      const injectionScope = {
        countyCode,
        constituencyCode: countyCode === selection.countyCode ? selection.constituencyCode : null,
        wardCode: countyCode === selection.countyCode ? selection.wardCode : null,
      };
      const result = await pulseApi.inject(injectionScope, scenario, intensity);
      setAlerts((current) => [result.alert, ...current.filter((item) => item.id !== result.alert.id)]);
      setModalAlert(result.alert);
      await Promise.all([loadScopedData(), pulseApi.countyMap().then(setSignals)]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Simulation failed");
    }
  }

  async function actOnAlert(id: string, action: "acknowledge" | "resolve") {
    const updated = await pulseApi.actOnAlert(id, action);
    setAlerts((current) => current.map((item) => item.id === id ? updated : item));
    if (action === "resolve") setModalAlert(null);
    else setModalAlert(updated);
  }

  const show = (module: WarRoomFocus) => focus === "command" || focus === module;

  return (
    <main className="min-h-screen px-3 pb-28 pt-3 sm:px-5 sm:pt-4">
      <header className="mx-auto mb-4 flex max-w-[1880px] flex-col gap-3 border-b border-line/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-signal/20 bg-signal/10 text-signal shadow-glow"><RadioTower className="h-5 w-5" /></span>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-lg font-bold tracking-tight">PULSE KENYA</h1><span className="mono rounded bg-wash/[0.07] px-1.5 py-0.5 text-[8px] tracking-wider text-slate-500">GEOLABS</span></div>
            <p className="mono text-[9px] uppercase tracking-[0.22em] text-slate-500">National public intelligence system</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-line/70 bg-wash/[0.045] p-1 text-xs" aria-label="Command modules">
          {NAV_ITEMS.map(({ href, label, focus: itemFocus, icon: Icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:text-signal ${focus === itemFocus ? "bg-signal/10 text-signal" : "text-slate-400"}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <ThemeToggle />
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] ${connected ? "border-signal/20 text-signal" : "border-amber/30 text-amber"}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? "status-dot bg-signal" : "bg-amber"}`} />{connected ? "LIVE LINK" : "RECONNECTING"}</div>
        </div>
      </header>

      <GeographyFilter counties={counties} constituencies={constituencies} wards={wards} selection={selection} onChange={changeSelection} />

      {error && <div className="mx-auto mb-3 flex max-w-[1880px] items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-2 text-xs text-red-200"><CircleAlert className="h-4 w-4" />{error}</div>}

      <AreaBrief scopeLabel={scopeLabel} selection={selection} summary={summary} alerts={alerts} />

      <div className={`mx-auto grid max-w-[1880px] gap-3 ${focus === "command" ? "xl:grid-cols-2 2xl:grid-cols-4" : "lg:grid-cols-2"}`}>
        {show("sense") && (
          <KenyaMap
            signals={signals}
            selectedCounty={selection.countyCode}
            selectedWard={selection.wardCode}
            onSelectCounty={(countyCode) => changeSelection({ countyCode, constituencyCode: null, wardCode: null })}
            onSelectWard={(wardCode, constituencyCode) => changeSelection({ countyCode: selection.countyCode, constituencyCode, wardCode })}
          />
        )}
        {show("sense") && <LiveTicker mentions={mentions} />}
        {show("sentry") && <SentryPanel alerts={alerts} summary={summary} onOpen={setModalAlert} />}
        {show("voice") && <VoicePanel metrics={voice} />}
      </div>

      <AlertModal alert={modalAlert} onDismiss={() => setModalAlert(null)} onAction={actOnAlert} />
      {(focus === "command" || focus === "sentry") && <PitchControl counties={signals} selectedCounty={selection.countyCode} onInject={inject} />}
    </main>
  );
}

