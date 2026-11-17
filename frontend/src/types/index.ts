export type SentimentLabel = "positive" | "neutral" | "negative";

export interface County {
  id: string;
  code: number;
  name: string;
  slug: string;
}

export interface Constituency {
  id: string;
  county_id: string;
  code: number;
  name: string;
  slug: string;
}

export interface Ward {
  id: string;
  constituency_id: string;
  code: number;
  name: string;
  slug: string;
}

export interface GeographySelection {
  countyCode: number | null;
  constituencyCode: number | null;
  wardCode: number | null;
}

export interface CountySignal {
  county: County;
  mentions: number;
  net_sentiment: number;
  threat_level: number;
}

export interface Mention {
  id: string;
  source: string;
  author_handle?: string | null;
  text: string;
  language: string;
  sheng_detected: boolean;
  engagement_count: number;
  collected_at: string;
  county_code?: number | null;
  county_name?: string | null;
  constituency_code?: number | null;
  constituency_name?: string | null;
  ward_code?: number | null;
  ward_name?: string | null;
  score: number;
  sentiment: SentimentLabel;
  issue_axis: string;
}

export interface AxisSummary {
  axis: string;
  score: number;
  volume: number;
}

export interface SentimentSummary {
  total_mentions: number;
  net_sentiment: number;
  positive: number;
  neutral: number;
  negative: number;
  window_hours: number;
  axes: AxisSummary[];
}

export interface PlaybookStep {
  minute: number;
  action: string;
  owner: string;
}

export interface Alert {
  id: string;
  county_code?: number | null;
  county_name?: string | null;
  severity: number;
  category: string;
  title: string;
  narrative: string;
  status: "open" | "acknowledged" | "resolved";
  playbook: PlaybookStep[];
  created_at: string;
}

export interface VoiceMetrics {
  poll_id: string;
  poll_name: string;
  status: string;
  target_sample: number;
  completed: number;
  completion_rate: number;
  calls_attempted: number;
  contact_rate: number;
  active_agents: number;
  average_handle_seconds: number;
  quotas: Record<string, { target: number; complete: number }>;
}

export interface StreamEnvelope<T = unknown> {
  id: string;
  type: string;
  data: T;
}

export type Scenario = "cost_of_living" | "healthcare_outage" | "security_incident" | "leadership_scandal";

