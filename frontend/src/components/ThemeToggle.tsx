"use client";

import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "pulse-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`grid h-9 w-9 place-items-center rounded-lg border border-line/80 bg-wash/[0.045] text-slate-400 transition hover:border-signal/45 hover:text-signal ${className}`}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
    >
      <Sun className="theme-to-light h-4 w-4" aria-hidden="true" />
      <Moon className="theme-to-dark h-4 w-4" aria-hidden="true" />
    </button>
  );
}
