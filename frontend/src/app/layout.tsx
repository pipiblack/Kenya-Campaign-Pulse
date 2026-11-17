import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const themeScript = `(function(){try{var saved=localStorage.getItem("pulse-theme");var theme=saved==="light"||saved==="dark"?saved:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export const metadata: Metadata = {
  title: "Pulse Kenya | Public Intelligence",
  description: "Live Kenyan public intelligence, sentiment, threat detection and CATI telemetry.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}

