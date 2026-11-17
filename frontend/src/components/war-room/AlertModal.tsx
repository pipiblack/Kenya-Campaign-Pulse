"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert, X } from "lucide-react";
import type { Alert } from "@/types";

interface AlertModalProps {
  alert: Alert | null;
  onDismiss: () => void;
  onAction: (id: string, action: "acknowledge" | "resolve") => Promise<void>;
}

export function AlertModal({ alert, onDismiss, onAction }: AlertModalProps) {
  return (
    <AnimatePresence>
      {alert && alert.severity >= 3 && alert.status !== "resolved" && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alert-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-red-400/35 bg-elevated shadow-[0_0_80px_rgba(255,70,70,.16)]"
          >
            <div className="flex items-center justify-between border-b border-red-400/20 bg-red-400/8 px-5 py-3">
              <div className="flex items-center gap-2 text-red-300">
                <ShieldAlert className="h-5 w-5" />
                <span className="mono text-xs font-semibold tracking-[0.2em]">T{alert.severity} COMMAND ALERT</span>
              </div>
              <button type="button" onClick={onDismiss} className="rounded-lg p-1.5 text-slate-400 hover:bg-wash/[0.08] hover:text-slate-50" aria-label="Dismiss alert overlay">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-400/10 text-red-300"><AlertTriangle /></div>
                <div>
                  <p className="mono text-[10px] uppercase tracking-widest text-slate-500">{alert.county_name ?? "National"} · {alert.category.replaceAll("_", " ")}</p>
                  <h2 id="alert-modal-title" className="mt-1 text-xl font-semibold sm:text-2xl">{alert.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{alert.narrative}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mono mb-3 text-[10px] uppercase tracking-[0.22em] text-signal/70">30-minute response playbook</p>
                <ol className="space-y-2">
                  {alert.playbook.map((step) => (
                    <li key={`${step.minute}-${step.action}`} className="flex items-start gap-3 rounded-xl border border-line/80 bg-wash/[0.045] p-3">
                      <span className="mono flex min-w-12 items-center gap-1 text-xs text-amber"><Clock3 className="h-3 w-3" />+{step.minute}</span>
                      <span className="flex-1 text-sm text-slate-200">{step.action}</span>
                      <span className="hidden text-xs text-slate-500 sm:block">{step.owner}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => onAction(alert.id, "acknowledge")} className="rounded-xl border border-line px-4 py-2.5 text-sm text-slate-200 hover:border-signal/40">Acknowledge</button>
                <button type="button" onClick={() => onAction(alert.id, "resolve")} className="flex items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-signal hover:brightness-110">
                  <CheckCircle2 className="h-4 w-4" /> Mark contained
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

