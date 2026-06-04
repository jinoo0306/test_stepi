export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export interface JobSummary {
  job_id: string;
  request_id: string | null;
  mode: string;
  status: JobStatus;
  progress: JobProgress;
  created_at: string;
  updated_at: string;
  error?: string | null;
  deleted_at?: string | null;
}

export interface JobListResponse {
  items: JobSummary[];
  total: number;
  limit: number;
  offset: number;
}

export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export interface JobProgress {
  total: number;
  done: number;
  failed: number;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: JobProgress;
  created_at: string;
  updated_at: string;
  error?: string | null;
}

export interface JobResultResponse {
  job_id: string;
  status: JobStatus;
  results: ApplicantResult[] | null;
  error?: string | null;
}

export interface ApplicantResult {
  applicant_id: string;
  job_track: string;
  job_field?: string | null;
  labels?: Record<string, string | null> | null;
  summary?: {
    overall?: string;
    overall_lines?: string[];
    by_question?: Array<{
      question_id: string;
      question: string;
      item_index?: number;
      title: string;
      content: string;
    }>;
  };
  scores?: {
    core_similarity?: Record<string, number>;
    job_fit?: Record<string, { score: number; reason: string }>;
    job_fit_cosine_percentile?: Record<string, number>;
    department_fit?: Array<{ department: string; score: number }>;
  };
  evidence?: Record<string, Array<{ sentence: string; similarity: number }>>;
  interview_questions?: Array<{
    id: number;
    question: string;
    intent?: string;
    topic_tag?: string;
  }>;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

// ─── 논문 첨부 분석 / 직군 적합도 v2 ────────────────────────────────────────

export type PaperStatus =
  | "uploaded"
  | "extracted"
  | "extract_partial"
  | "extract_fail"
  | "analyzed"
  | "analysis_fail"
  | "meta_only";  // PDF 미첨부, xlsx 학술지 게재 메타만

export interface PaperFile {
  file_id: number | null;  // PDF 미첨부 (meta_only) 시 null
  paper_id: number | null;
  original_filename: string | null;
  size_bytes: number | null;
  status: PaperStatus;
  error_message: string | null;
  uploaded_at: string;
  title?: string | null;
  claimed_title?: string | null;
  claimed_journal?: string | null;
  claimed_year?: string | null;
  match_status?: string | null;
  abstract_chars?: number;
  analyzed_at?: string | null;
  paper_problem?: string | null;
  paper_strength?: string | null;
}

export interface PaperEvidenceCoord {
  page: number;
  bbox: [number, number, number, number];
  text: string;
}

export interface PaperDetail extends PaperFile {
  abstract?: string | null;
  doi?: string | null;
  journal?: string | null;
  year?: string | null;
  authors_text?: string | null;
  paper_problem?: string | null;
  paper_solution?: string | null;
  paper_result?: string | null;
  paper_evidence?: { problem?: string; solution?: string; result?: string } | null;
  paper_tech_stack?: string[] | null;
  paper_process?: string[] | null;
  paper_strength?: string | null;
  paper_weakness?: string | null;
  paper_interview_qs?: string[] | null;
  evidence_with_coords?: Record<string, PaperEvidenceCoord> | null;
}

export interface DeptFitItem {
  dept_name: string;
  score: number;
  reason: string | null;
}

export interface DeptFitResponse {
  applicant_id: string;
  job_track: string;
  skipped: boolean;
  skipped_reason: string | null;
  items: DeptFitItem[];
  computed_at: string | null;
  prompt_version: string | null;
}


export interface TuringMetricsResponse {
  generated_at: string;
  window: { jobs: number; limit: number };
  metrics: {
    hallucination_prevention: {
      rate: number | null;
      numeric_consistency_rate: number | null;
      entity_consistency_rate: number | null;
      nli_entailment_rate: number | null;
      nli_status: string;
      samples: number;
    };
    format_compliance: {
      rate: number | null;
      passed: number;
      total: number;
    };
    response_time: {
      avg_seconds: number | null;
      avg_seconds_per_applicant: number | null;
      p50_seconds: number | null;
      p95_seconds: number | null;
    };
  };
  jobs: Array<{
    job_id: string;
    request_id: string | null;
    status: JobStatus;
    applicants_done: number;
    applicants_total: number;
    duration_seconds: number | null;
    avg_seconds_per_applicant: number | null;
    format_compliance_rate: number | null;
    hallucination_prevention_rate: number | null;
    created_at: string;
    updated_at: string;
    format_errors: string[];
  }>;
}

export interface TuringRiskItem {
  risk_type?: "numeric_mismatch" | "nli_contradiction" | "llm_contradiction" | "llm_unsupported";
  job_id: string;
  request_id: string | null;
  applicant_id: string;
  score: number;
  numeric_rate: number;
  entity_rate: number;
  nli_entailment_rate: number | null;
  nli_status: string;
  numeric_misses: string[];
  entity_misses: string[];
  verdict?: "contradiction" | "unsupported" | "faithful" | null;
  reason?: string | null;
  nli_contradictions?: Array<{
    generated: string;
    source: string;
    qid?: string | null;
    max_con: number;
    max_ent: number;
    reason?: string | null;
  }>;
  generated_excerpt: string;
}

export interface TuringRiskResponse {
  generated_at: string;
  window: { jobs: number; limit: number; job_id?: string | null };
  items: TuringRiskItem[];
}

export interface FeedbackEntry {
  job_id: string;
  applicant_id: string;
  component: string;
  item_key: string;
  rating: boolean;
  created_at: string;
  updated_at: string;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  // 핵심인재(#1) 레이더의 합격자 평균 기준선
  getCorePassedBaseline: () =>
    http<{ core_passed_baseline: Record<string, number>; n_passed_matched: number; scale: string }>(
      `/core-passed-baseline`,
    ),
  getTuringMetrics: (limit = 30) => http<TuringMetricsResponse>(`/turing/metrics?limit=${limit}`),
  getTuringRisks: (limit = 5, maxItems = 12) =>
    http<TuringRiskResponse>(`/turing/hallucination-risks?limit=${limit}&max_items=${maxItems}`),
  listJobs: (params?: { limit?: number; offset?: number; status?: string; trashed?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    if (params?.status) qs.set("status", params.status);
    if (params?.trashed) qs.set("trashed", "true");
    const suffix = qs.toString() ? `?${qs}` : "";
    return http<JobListResponse>(`/analysis-jobs${suffix}`);
  },
  softDeleteJob: (id: string) =>
    http<void>(`/analysis-jobs/${id}`, { method: "DELETE" }),
  restoreJob: (id: string) =>
    http<{ job_id: string; status: string; created_at: string }>(
      `/analysis-jobs/${id}/restore`,
      { method: "POST" },
    ),
  hardDeleteJob: (id: string) =>
    http<void>(`/analysis-jobs/${id}/permanent`, { method: "DELETE" }),
  getStatus: (id: string) => http<JobStatusResponse>(`/analysis-jobs/${id}`),
  getResult: (id: string) => http<JobResultResponse>(`/analysis-jobs/${id}/result`),
  cancelJob: (id: string) =>
    http<{ job_id: string; status: string; created_at: string }>(
      `/analysis-jobs/${id}/cancel`,
      { method: "POST" },
    ),
  resumeJob: (id: string) =>
    http<{ job_id: string; status: string; created_at: string }>(
      `/analysis-jobs/${id}/resume`,
      { method: "POST" },
    ),
  listFeedback: (id: string, applicantId: string) =>
    http<{ items: FeedbackEntry[] }>(`/analysis-jobs/${id}/applicants/${applicantId}/feedback`),
  upsertFeedback: (
    id: string,
    applicantId: string,
    body: { component: string; item_key?: string; rating: boolean },
  ) =>
    http<FeedbackEntry>(`/analysis-jobs/${id}/applicants/${applicantId}/feedback`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteFeedback: (
    id: string,
    applicantId: string,
    component: string,
    itemKey = "",
  ) => {
    const qs = new URLSearchParams({ component, item_key: itemKey });
    return http<void>(`/analysis-jobs/${id}/applicants/${applicantId}/feedback?${qs}`, {
      method: "DELETE",
    });
  },
  getSourceInput: (id: string) =>
    http<{
      job_id: string;
      applicants: Array<{
        applicant_id: string;
        job_track: string;
        job_field: string | null;
        education: Array<{
          kind: string;
          school?: string;
          degree?: string;
          major?: string;
          major_field?: string;
          start_date?: string;
          end_date?: string;
          status?: string;
          gpa?: string;
          gpa_scale?: string;
        }> | null;
        career: Array<{
          company: string;
          department?: string;
          title?: string;
          duties?: string;
          employment_type?: string;
          period?: string;
          start_date?: string;
          end_date?: string;
        }> | null;
      }>;
    }>(`/analysis-jobs/${id}/source-input`),
  applicantsSummary: (id: string) =>
    http<
      {
        applicant_id: string;
        papers_total: number;
        papers_analyzed: number;
        top_dept: { department: string; score: number } | null;
        dept_skipped: boolean;
      }[]
    >(`/analysis-jobs/${id}/applicants/summary`),
  listExcelSheets: async (file: File): Promise<string[]> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/analysis-jobs/excel-sheets`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<string[]>;
  },
  injectInfoXlsx: async (
    jobId: string,
    infoFile: File,
    opts?: { info_sheet_name?: string; replace?: boolean },
  ) => {
    const fd = new FormData();
    fd.append("info_file", infoFile);
    if (opts?.info_sheet_name) fd.append("info_sheet_name", opts.info_sheet_name);
    if (opts?.replace) fd.append("replace", "true");
    const res = await fetch(`${API_BASE}/analysis-jobs/${jobId}/inject-info-xlsx`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<{
      inserted_papers: number;
      matched_applicants: number;
      unmatched_count: number;
      unmatched_applicants: string[];
      replaced: boolean;
    }>;
  },
  uploadExcel: async (
    file: File,
    extra?: {
      request_id?: string;
      mode?: string;
      job_track?: string;
      info_file?: File;
      sheet_name?: string;
      info_sheet_name?: string;
      limit?: number;
    },
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    if (extra?.info_file) fd.append("info_file", extra.info_file);
    if (extra?.request_id) fd.append("request_id", extra.request_id);
    if (extra?.mode) fd.append("mode", extra.mode);
    if (extra?.job_track) fd.append("job_track", extra.job_track);
    if (extra?.sheet_name) fd.append("sheet_name", extra.sheet_name);
    if (extra?.info_sheet_name) fd.append("info_sheet_name", extra.info_sheet_name);
    if (extra?.limit !== undefined) fd.append("limit", String(extra.limit));
    const res = await fetch(`${API_BASE}/analysis-jobs/from-excel`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<{ job_id: string; status: string; created_at: string }>;
  },
  deleteApplicant: (id: string, applicantId: string) =>
    http<void>(
      `/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}`,
      { method: "DELETE" },
    ),
  bulkUploadPapers: async (id: string, zipFile: File) => {
    const fd = new FormData();
    fd.append("file", zipFile);
    const res = await fetch(`${API_BASE}/analysis-jobs/${id}/papers/bulk-upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<{
      total_pdf_entries: number;
      queued: number;
      duplicate_skipped: number;
      unmatched_applicants: string[];
      errors: string[];
      queued_file_ids: number[];
    }>;
  },
  reportPdfUrl: (id: string) => `${API_BASE}/analysis-jobs/${id}/report.pdf`,
  resultCsvUrl: (id: string) => `${API_BASE}/analysis-jobs/${id}/result.csv`,

  // 논문 첨부
  listPapers: (id: string, applicantId: string) =>
    http<PaperFile[]>(`/analysis-jobs/${id}/applicants/${applicantId}/papers`),
  getPaperDetail: (id: string, applicantId: string, fileId: number) =>
    http<PaperDetail>(`/analysis-jobs/${id}/applicants/${applicantId}/papers/${fileId}`),
  uploadPaper: async (id: string, applicantId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `${API_BASE}/analysis-jobs/${id}/applicants/${applicantId}/papers`,
      { method: "POST", body: fd },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<PaperFile>;
  },
  deletePaper: (id: string, applicantId: string, fileId: number) =>
    http<void>(
      `/analysis-jobs/${id}/applicants/${applicantId}/papers/${fileId}`,
      { method: "DELETE" },
    ),
  paperPdfUrl: (id: string, applicantId: string, fileId: number) =>
    `${API_BASE}/analysis-jobs/${id}/applicants/${applicantId}/papers/${fileId}/pdf`,

  // 직군 적합도 v2
  getDeptFit: (id: string, applicantId: string) =>
    http<DeptFitResponse>(`/analysis-jobs/${id}/applicants/${applicantId}/dept-fit`),
  recomputeDeptFit: (id: string, applicantId: string) =>
    http<{ enqueued: boolean; applicant_id: string }>(
      `/analysis-jobs/${id}/applicants/${applicantId}/dept-fit/recompute`,
      { method: "POST" },
    ),
};

export function gradeFromScores(
  jobFit?: Record<string, { score: number }>,
): { grade: "S" | "A" | "B" | "C" | "D"; avg: number } {
  if (!jobFit) return { grade: "C", avg: 0 };
  const vals = Object.values(jobFit).map((v) => v.score);
  if (vals.length === 0) return { grade: "C", avg: 0 };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  let grade: "S" | "A" | "B" | "C" | "D" = "C";
  if (avg >= 8.5) grade = "S";
  else if (avg >= 8.0) grade = "A";
  else if (avg >= 7.5) grade = "B";
  else if (avg >= 7.0) grade = "C";
  else grade = "D";
  return { grade, avg };
}

export interface BlindHit {
  applicant_id: string;
  essay_no: number;
  category: string;
  term: string;
  snippet: string;
  offset: number;
  confidence: number;
}
export interface RecusalHit {
  applicant_id: string;
  rule: string;
  verdict: string;
  matched: Record<string, unknown>;
}
export interface PrelimCounts {
  applicants: number;
  blind_by_category: Record<string, number>;
  blind_total: number;
  recusal_by_rule: Record<string, number>;
  recusal_total: number;
}
export interface PrelimRunResponse {
  ticket: string;
  label: string | null;
  eval_date: string;
  counts: PrelimCounts;
  blind_hits: BlindHit[];
  recusal_hits: RecusalHit[];
  truncated_blind: boolean;
  truncated_recusal: boolean;
}
export interface PrelimSummary {
  ticket: string;
  label: string | null;
  eval_date: string | null;
  counts: PrelimCounts;
  applicant_count: number;
  computed_at: string;
}

export const prelim = {
  async run(form: FormData): Promise<PrelimRunResponse> {
    const res = await fetch(`${API_BASE}/prelim/run`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`prelim/run failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<PrelimRunResponse>;
  },
  list: () => http<{ items: PrelimSummary[] }>(`/prelim/results`),
  get: (ticket: string) => http<PrelimRunResponse>(`/prelim/results/${ticket}`),
};

export function feedbackKey(component: string, itemKey = ""): string {
  return `${component}::${itemKey}`;
}
