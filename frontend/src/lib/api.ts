import type { Alert, Constituency, CountySignal, GeographySelection, Mention, Scenario, SentimentSummary, VoiceMetrics, Ward } from "@/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const TOKEN_STORAGE_KEY = "pulse_access_token:v1";

function accessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = accessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(detail.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loginSession(tenantSlug: string, email: string, password: string): Promise<void> {
  const token = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ tenant_slug: tenantSlug, email, password }),
  });
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token.access_token);
}

function geographyQuery(scope: GeographySelection): string {
  const params = new URLSearchParams();
  if (scope.countyCode) params.set("county_code", scope.countyCode.toString());
  if (scope.constituencyCode) params.set("constituency_code", scope.constituencyCode.toString());
  if (scope.wardCode) params.set("ward_code", scope.wardCode.toString());
  return params.toString();
}

export const pulseApi = {
  constituencies: () => request<Constituency[]>("/sentiment/constituencies"),
  wards: () => request<Ward[]>("/sentiment/wards"),
  summary: (scope: GeographySelection) => request<SentimentSummary>(`/sentiment/summary?window_hours=24&${geographyQuery(scope)}`),
  mentions: (scope: GeographySelection) => request<Mention[]>(`/sentiment/mentions?limit=40&${geographyQuery(scope)}`),
  countyMap: () => request<CountySignal[]>("/sentiment/county-map?window_hours=24"),
  alerts: (countyCode?: number | null) => request<Alert[]>(`/alerts?minimum_severity=2&limit=30${countyCode ? `&county_code=${countyCode}` : ""}`),
  voice: () => request<VoiceMetrics>("/voice/metrics"),
  inject: (scope: GeographySelection & { countyCode: number }, scenario: Scenario, intensity: number) =>
    request<{ alert: Alert; mentions_created: number; event_id: string }>("/pitch/inject-crisis", {
      method: "POST",
      body: JSON.stringify({
        county_code: scope.countyCode,
        constituency_code: scope.constituencyCode,
        ward_code: scope.wardCode,
        scenario,
        intensity,
      }),
    }),
  actOnAlert: (alertId: string, action: "acknowledge" | "resolve" | "reopen") =>
    request<Alert>(`/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify({ action }) }),
};

