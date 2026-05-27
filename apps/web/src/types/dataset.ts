export type DatasetStatus = "uploading" | "processing" | "ready" | "failed" | "archived";
export type ColumnType = "integer" | "float" | "string" | "boolean" | "datetime" | "date" | "unknown";

export interface ColumnProfile {
  name: string;
  dtype: ColumnType;
  null_count: number;
  null_pct: number;
  unique_count: number;
  cardinality: number;
  sample_values: unknown[];
  min_value: number | string | null;
  max_value: number | string | null;
  mean_value: number | null;
  std_value: number | null;
  skewness: number | null;
  kurtosis: number | null;
  quantiles: Record<string, number>;
  top_values: [unknown, number][];
}

export interface DatasetSchema {
  columns: ColumnProfile[];
  row_count: number;
  column_count: number;
  size_bytes: number;
  inferred_primary_key: string | null;
  inferred_time_column: string | null;
  inferred_target_column: string | null;
  correlation_matrix: Record<string, Record<string, number>>;
  data_quality_score: number;
}

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  original_filename: string;
  file_format: string;
  status: DatasetStatus;
  row_count: number | null;
  column_count: number | null;
  data_quality_score: number | null;
  analysis_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DatasetDetail extends Dataset {
  schema: DatasetSchema | null;
  metadata: Record<string, unknown>;
}

export interface DatasetUploadParams {
  file: File;
  name: string;
  description?: string;
  tags?: string[];
}

export type AnalysisType =
  | "eda"
  | "anomaly_detection"
  | "forecasting"
  | "clustering"
  | "classification"
  | "regression"
  | "correlation"
  | "custom_query"
  | "full_pipeline";

export type AnalysisStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AgentStep {
  step_number: number;
  agent_name: string;
  action: string;
  tool_name: string | null;
  tool_input: Record<string, unknown>;
  tool_output: string | null;
  reasoning: string;
  sql_executions: SQLExecution[];
  duration_ms: number;
  timestamp: string;
}

export interface SQLExecution {
  id: string;
  query: string;
  natural_language_intent: string | null;
  execution_time_ms: number;
  row_count: number;
  result_preview: Record<string, unknown>[];
  execution_plan: string | null;
  error: string | null;
  executed_at: string;
}

export interface ForecastPoint {
  timestamp: string;
  value: number;
  lower_bound: number;
  upper_bound: number;
  is_forecast: boolean;
}

export interface AnomalyRecord {
  row_index: number;
  anomaly_score: number;
  algorithm: string;
  affected_columns: string[];
  explanation: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface MLResult {
  model_name: string;
  task_type: string;
  metrics: Record<string, number>;
  feature_importance: Record<string, number>;
  shap_values: Record<string, number[]>;
  forecast_points: ForecastPoint[];
  anomalies: AnomalyRecord[];
  natural_language_summary: string;
}

export interface AnalysisResult {
  summary: string;
  key_findings: string[];
  sql_executions: SQLExecution[];
  ml_results: MLResult[];
  visualizations: unknown[];
  confidence_score: number;
  evidence_references: string[];
}

export interface Analysis {
  id: string;
  dataset_id: string;
  analysis_type: AnalysisType;
  status: AnalysisStatus;
  user_query: string | null;
  duration_seconds: number | null;
  step_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface AnalysisDetail extends Analysis {
  agent_steps: AgentStep[];
  result: AnalysisResult | null;
  error_message: string | null;
}

export type InsightCategory =
  | "anomaly" | "trend" | "correlation" | "forecast"
  | "recommendation" | "data_quality" | "business" | "statistical";

export type InsightSeverity = "info" | "warning" | "critical" | "opportunity";

export interface Insight {
  id: string;
  dataset_id: string;
  analysis_id: string | null;
  title: string;
  body: string;
  category: InsightCategory;
  severity: InsightSeverity;
  confidence_score: number;
  affected_columns: string[];
  tags: string[];
  business_impact: string | null;
  recommended_actions: string[];
  is_verified: boolean;
  created_at: string;
}
