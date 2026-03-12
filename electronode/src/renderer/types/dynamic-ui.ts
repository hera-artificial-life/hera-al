/**
 * Dynamic UI Types
 *
 * LLM-generated UI with full HTML/CSS/JS freedom
 */

export interface DynamicUIActivity {
  id: string;
  type: "button" | "input" | "canvas" | "custom";
  context?: Record<string, unknown>;
  /** JS expression evaluated at event time. Result is included as 'provided' in the action payload. */
  dataProvider?: string;
}

export interface DynamicUIPayload {
  html: string;
  css?: string;
  js?: string;
  activities: DynamicUIActivity[];
}

export interface DynamicUIAction {
  activityId: string;
  type: string;
  data?: unknown;
  context?: Record<string, unknown>;
}

export interface DynamicUIMessage {
  type: "render" | "update" | "action" | "ready" | "error" | "query" | "query_result";
  payload?: DynamicUIPayload;
  js?: string; // For incremental updates
  action?: DynamicUIAction;
  error?: string;
  /** For query: unique ID to correlate request/response */
  queryId?: string;
  /** For query_result: evaluation result */
  result?: unknown;
}
