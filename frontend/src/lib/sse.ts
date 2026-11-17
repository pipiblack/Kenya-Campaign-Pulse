import { API_URL } from "./api";

export interface PulseStreamHandlers {
  onMention: (data: unknown) => void;
  onAlert: (data: unknown) => void;
  onAlertUpdate: (data: unknown) => void;
  onConnection: (connected: boolean) => void;
}

export function connectPulseStream(handlers: PulseStreamHandlers): () => void {
  const token = window.localStorage.getItem("pulse_access_token:v1");
  const url = new URL(`${API_URL}/pitch/events`, window.location.origin);
  if (token) url.searchParams.set("token", token);
  const stream = new EventSource(url);

  stream.addEventListener("connected", () => handlers.onConnection(true));
  stream.addEventListener("mention.created", (event) => handlers.onMention(JSON.parse((event as MessageEvent<string>).data)));
  stream.addEventListener("alert.created", (event) => handlers.onAlert(JSON.parse((event as MessageEvent<string>).data)));
  stream.addEventListener("alert.updated", (event) => handlers.onAlertUpdate(JSON.parse((event as MessageEvent<string>).data)));
  stream.onerror = () => handlers.onConnection(false);

  return () => stream.close();
}

