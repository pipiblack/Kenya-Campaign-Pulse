"use client";

import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Building2, Globe2, KeyRound, Mail, RadioTower, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { loginSession } from "@/lib/api";

const OVERVIEW_METRICS = [
  { value: "47", label: "Counties monitored", icon: Globe2 },
  { value: "1,450", label: "Wards resolved", icon: BarChart3 },
  { value: "03", label: "Active T3+ signals", icon: ShieldCheck },
  { value: "38", label: "CATI agents live", icon: RadioTower },
];

export default function LandingPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState(process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginSession(tenantSlug.trim(), email.trim().toLowerCase(), password);
      router.push("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start demo session");
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6 sm:px-10">
      <div className="absolute left-1/2 top-[-25rem] h-[48rem] w-[48rem] -translate-x-1/2 rounded-full border border-signal/10 bg-emerald-500/[0.035] blur-2xl" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-signal/20 bg-signal/10 text-signal"><RadioTower className="h-4 w-4" /></span><span className="font-bold tracking-tight">PULSE KENYA</span></div>
        <div className="flex items-center gap-3">
          <span className="mono hidden text-[9px] uppercase tracking-[0.24em] text-slate-500 sm:block">A GeoLabs Intelligence System</span>
          <ThemeToggle />
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[82vh] max-w-7xl items-center gap-16 py-20 lg:grid-cols-[1.1fr_.9fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-signal/20 bg-signal/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-signal"><span className="status-dot h-1.5 w-1.5 rounded-full bg-signal" /> Kenyan public intelligence, live</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-slate-50 sm:text-7xl">See the signal.<br /><span className="text-signal">Move before the noise.</span></h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">One command layer for multilingual sentiment, coordinated threat detection, geographic intelligence and CATI polling across all 47 counties.</p>
          <form onSubmit={signIn} className="mt-9 grid max-w-2xl gap-3 rounded-2xl border border-line/70 bg-panel/70 p-4 backdrop-blur sm:grid-cols-3">
            <label className="relative">
              <span className="sr-only">Organisation</span>
              <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input required value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} autoComplete="organization" placeholder="Organisation" className="h-11 w-full rounded-xl border border-line bg-wash/[0.04] pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-signal/50" />
            </label>
            <label className="relative">
              <span className="sr-only">Email address</span>
              <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="Email address" className="h-11 w-full rounded-xl border border-line bg-wash/[0.04] pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-signal/50" />
            </label>
            <label className="relative">
              <span className="sr-only">Password</span>
              <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Password" className="h-11 w-full rounded-xl border border-line bg-wash/[0.04] pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-signal/50" />
            </label>
            <button type="submit" disabled={loading} className="group flex h-11 items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-bold text-on-signal transition hover:brightness-110 disabled:opacity-60 sm:col-span-3">{loading ? "Establishing secure link…" : "Enter secure war room"}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>
          </form>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.6 }} className="panel relative p-3 sm:p-5">
          <div className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-signal/20 via-transparent to-amber/10 blur-xl" />
          <div className="flex items-center justify-between border-b border-line pb-3"><div><p className="mono text-[9px] uppercase tracking-[.2em] text-signal">National signal overview</p><p className="mt-1 text-sm font-semibold">Live operating picture</p></div><span className="mono rounded-full border border-signal/20 px-2 py-1 text-[9px] text-signal">LIVE</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {OVERVIEW_METRICS.map(({ value, label, icon: Icon }) => <div key={label} className="rounded-xl border border-line/70 bg-wash/[0.045] p-4"><Icon className="mb-5 h-4 w-4 text-signal/70" /><p className="text-3xl font-semibold">{value}</p><p className="mono mt-1 text-[9px] uppercase tracking-wider text-slate-500">{label}</p></div>)}
          </div>
          <div className="mt-2 rounded-xl border border-line/70 bg-wash/[0.045] p-4"><div className="flex items-center justify-between text-xs"><span className="text-slate-400">National net sentiment</span><span className="mono text-amber">-12.4</span></div><div className="mt-3 flex h-2 overflow-hidden rounded-full bg-wash/[0.07]"><span className="w-[31%] bg-red-400/70" /><span className="w-[41%] bg-slate-500/50" /><span className="w-[28%] bg-emerald-400/70" /></div><div className="mono mt-2 flex justify-between text-[8px] text-slate-600"><span>NEGATIVE 31%</span><span>NEUTRAL 41%</span><span>POSITIVE 28%</span></div></div>
        </motion.div>
      </section>
    </main>
  );
}

