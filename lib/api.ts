import type { AiDetectionExplanation } from "./ai-detection";
import { SESSION_COOKIE, sessionExp, signApiToken, verifySession } from "./auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// 키가 없으면 토큰 없이 보냄(백엔드 off/observe). exp 는 이 컴퓨터 시계 기준으로 바꿔 둠(시계 어긋남 대비)
let browserToken: { token: string | null; exp: number } | null = null;
let browserTokenReq: Promise<string | null> | null = null;

/** minLeft: 남은 수명이 이보다 짧으면 새로 받음. nginx 가 본문을 다 받은 뒤 넘기는 업로드는 길게 */
async function apiToken(minLeft = 60): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (typeof window === "undefined") {
    const secret = process.env.API_AUTH_SECRET ?? "";
    if (!secret) return null;
    // proxy.ts 를 건너뛴 요청(예: 확장자로 끝나는 주소)이어도 로그인 안 된 요청에는 서명하지 않음
    const { cookies } = await import("next/headers");
    const session = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
    if (!(await verifySession(session, process.env.SESSION_SECRET ?? ""))) return null;
    return signApiToken({ p: "api", exp: Math.min(now + 60, sessionExp(session)) }, secret);
  }
  if (browserToken && browserToken.exp - minLeft > now) return browserToken.token;
  browserTokenReq ??= fetch("/api/api-token", { method: "POST", cache: "no-store" })
    .then(async (res) => {
      if (res.status === 401 || res.redirected) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        throw new Error("로그인이 필요합니다.");
      }
      if (!res.ok) throw new Error("접속 확인에 실패하였습니다. 잠시 후 다시 시도해 주십시오.");
      const body = (await res.json()) as { token: string | null; ttl: number };
      browserToken = { token: body.token, exp: now + body.ttl };
      return browserToken.token;
    })
    .finally(() => {
      browserTokenReq = null;
    });
  return browserTokenReq;
}

/** 로그아웃 때 메모리의 토큰을 버림 */
export const clearApiToken = () => {
  browserToken = null;
};

/** 백엔드 호출은 모두 이것으로 함. FormData 의 Content-Type 은 건드리지 않음 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const upload = init.body instanceof FormData || init.body instanceof Blob;
  const token = await apiToken(upload ? 540 : 60);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined") browserToken = null;
  return res;
}

/** <a href>·<img src> 용. 프론트 서버가 로그인을 확인하고 서명한 API 주소로 넘겨 줌 */
export const downloadUrl = (path: string) => `/api/dl?u=${encodeURIComponent(path)}`;

/** AbortSignal.timeout 이 없는 옛 Safari 에서는 시간 제한 없이 보냄 */
const timeoutSignal = (ms: number) =>
  typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : undefined;

export interface JobSummary {
  job_id: string;
  request_id: string | null;
  mode: string;
  status: JobStatus;
  progress: JobProgress;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  estimated_finished_at?: string | null;
  estimated_overdue?: boolean;
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
  /** 오류 횟수 누적. 같은 지원자가 재시도에서 또 실패하면 여러 번 셈 */
  failed: number;
  /** 실패한 지원자 수 */
  failed_applicants: number;
}

/** "실패 2명" 또는 오류가 더 많으면 "실패 2명, 오류 3번" */
export function failedLabel(p: JobProgress, withAttempts = true): string | null {
  const people = p.failed_applicants > 0 ? p.failed_applicants : p.failed;
  if (people <= 0) return null;
  return withAttempts && p.failed > people ? `실패 ${people}명, 오류 ${p.failed}회` : `실패 ${people}명`;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: JobProgress;
  created_at: string;
  updated_at: string;
  error?: string | null;
  /** 분석명. 옛 서버 응답에는 없음 */
  request_id?: string | null;
  /** 분석 수준(full·score_only·questions_only). 옛 서버 응답에는 없음 */
  mode?: string;
  /** 생성 때 남긴 입력 경고(분석에서 뺀 지원자, 연결 안 된 지원정보 등). 옛 서버 응답에는 없음 */
  warnings?: string[];
}

export interface JobResultResponse {
  job_id: string;
  status: JobStatus;
  results: ApplicantResult[] | null;
  error?: string | null;
}

// --- 실패 원인 보기 ---

export type FailureCauseCode =
  | "enqueue_failed"
  | "timeout"
  | "gpu_oom"
  | "gpu_unavailable"
  | "model_output_unreadable"
  | "input_unreadable"
  | "unknown";

export interface FailureCause {
  code: FailureCauseCode;
  title: string;
  description: string;
  guidance: string;
  raw_summary?: string | null;
}

export interface JobFailureCause extends FailureCause {
  unprocessed_count: number;
}

export interface FailureAttempt {
  failed_at: string;
  cause_code: FailureCauseCode;
  title: string;
  raw_summary: string | null;
}

export interface FailedApplicant {
  applicant_id: string;
  job_field: string | null;
  failed_at: string;
  raw_summary: string | null;
  attempt_count: number;
  attempts: FailureAttempt[];
}

export interface FailureGroup extends FailureCause {
  count: number;
  applicants: FailedApplicant[];
}

export interface JobFailuresResponse {
  job_id: string;
  status: JobStatus;
  running: boolean;
  total: number;
  failed_applicants: number;
  /** 오류 횟수 누적 */
  failed_attempts: number;
  legacy: boolean;
  legacy_count: number;
  legacy_message: string | null;
  job_cause: JobFailureCause | null;
  groups: FailureGroup[];
}

export interface AiDetection {
  status: "not_analyzed" | "running" | "succeeded" | "insufficient_input" | "failed";
  last_success: null | {
    score: number; score_kind: "experimental_suspicion";
    threshold_score: number; threshold_exceeded: boolean; warnings: string[];
    model_version: string; calibration_version: string; normalization_version: string;
    input_hash: string; analyzed_at: string;
    explanation?: AiDetectionExplanation;
  };
  last_attempt: null | { run_id: string; started_at: string; finished_at: string | null; error_code: string | null };
  stale: boolean;
}

export interface ApplicantResult {
  ai_detection?: AiDetection;
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

// --- 논문 첨부 분석 / 직군 적합도 v2 ---

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


export type TuringPeriod = "30d" | "90d" | "all";

// TURING-001 핵심 지표 카드. 값은 백엔드가 계산함
export interface TuringCard {
  id: string;
  name: string;
  area: string;
  value: number | null;
  unit: "%" | "초" | "건" | "점" | "상관";
  denominator: number | null;
  unmeasured_reason: string | null;
  detail: {
    failed_by_cause?: Record<string, number>;
    unknown?: number;
    excluded_jobs?: number;
    not_in_source?: number;
    judged?: number;
    candidates?: number;
    invalid?: number;
  } | null;
  delta: number | null;
  prev_denominator: number | null;
}

export interface TuringMetricsResponse {
  generated_at: string;
  window: {
    jobs: number;
    job_id?: string | null;
    period: TuringPeriod | null;
    from: string | null;
    to: string;
    excluded_jobs: number;
    verdicts: number;
    excluded_tickets: number;
  };
  cards: TuringCard[];
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
    job_cards: TuringCard[];
  }>;
}

export interface TuringRiskItem {
  risk_type?: "faithfulness" | "nli_contradiction" | "llm_contradiction" | "llm_unsupported";
  job_id: string;
  request_id: string | null;
  applicant_id: string;
  score: number | null;
  checked?: number;
  confirmed?: number;
  numeric_misses: string[];
  entity_misses: string[];
  invalid_quotes?: { text: string; where: "summary" | "axis_reason" | "dept_reason" }[];
  empty_summaries?: { question_id: string; question: string }[];
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
  window: { jobs: number; period: TuringPeriod | null; job_id?: string | null };
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

/** 인재상 기준 문장 한 줄(TALENT-001). judged_by: 규칙 판정(code) 또는 판정 대기(pending) */
export type TalentCriterion = {
  item_id: string;
  no: number;
  name: string;
  question: string;
  rule: string;
  x_example: string | null;
  judged_by: "code" | "pending";
  pending_reason: string | null;
  updated_at: string;
};
export type TalentCriteria = { version: string; axes: { no: number; axis: string; items: TalentCriterion[] }[] };
export type TalentCriterionInput = Pick<TalentCriterion, "name" | "question" | "rule" | "x_example">;

/** 백엔드가 주고받는 인재상 세트. lib/talent-selection.ts 의 TalentSet 과 같은 모양 */
export interface TalentSetPayload {
  id: string;
  name: string;
  nos: number[];
}

export interface TalentSelectionResponse {
  job_id: string;
  sets: TalentSetPayload[];
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw await readApiError(res, path);
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/** 서버 요청 실패. reason 은 화면에 그대로 붙일 한글 문장(서버의 한글 사유 또는 상태별 안내) */
export class ApiError extends Error {
  constructor(
    public status: number,
    public reason: string,
  ) {
    super(reason);
    this.name = "ApiError";
  }
}

const HANGUL = /[가-힣]/;
export const hasHangul = (s: unknown): s is string => typeof s === "string" && HANGUL.test(s);
const withPeriod = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);
const NETWORK_REASON = "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주십시오.";
const STATUS_REASON: Record<number, string> = {
  400: "입력한 내용이나 파일을 확인해 주십시오.",
  401: "로그인이 필요합니다. 다시 로그인해 주십시오.",
  403: "이 작업을 할 권한이 없습니다.",
  404: "이미 삭제되었거나 찾을 수 없는 항목입니다.",
  409: "현재 상태에서는 처리할 수 없으니 화면을 새로고침해 주십시오.",
  413: "파일 용량이 허용 범위를 넘었습니다.",
  422: "입력한 내용이나 파일을 확인해 주십시오.",
};
const statusReason = (status: number) =>
  STATUS_REASON[status] ??
  (status >= 500 ? "서버 오류가 발생하였습니다. 잠시 후 다시 시도해 주십시오." : "잠시 후 다시 시도해 주십시오.");

/** 실패 응답 본문을 ApiError 로. 서버 원문(영어·JSON)은 화면 대신 콘솔에 남김 */
export function apiError(status: number, body: string, where = ""): ApiError {
  let detail: unknown;
  try {
    detail = JSON.parse(body).detail;
  } catch {}
  console.warn(`API ${status} ${where}`, body);
  return new ApiError(status, hasHangul(detail) ? withPeriod(detail.trim()) : statusReason(status));
}
export const readApiError = async (res: Response, where = res.url) =>
  apiError(res.status, await res.text().catch(() => ""), where);

/** 실패 사유나 다음 할 일 한 문장. 영어·JSON 원문은 내보내지 않음 */
export function failReason(e: unknown): string {
  if (e instanceof ApiError) return e.reason;
  if (!(e instanceof Error)) return "잠시 후 다시 시도해 주십시오.";
  if (e.name === "TimeoutError") return "응답이 지연되었으니 새로고침한 후 다시 시도해 주십시오.";
  // fetch 가 서버에 닿지 못하면 브라우저마다 다른 영어 문구의 TypeError 를 던짐
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) return NETWORK_REASON;
  return hasHangul(e.message) && !/[{}]/.test(e.message) ? withPeriod(e.message.trim()) : "잠시 후 다시 시도해 주십시오.";
}

/** 화면 오류 문장. "○○에 실패하였습니다." 뒤에 사유나 다음 할 일을 붙임 */
export const failText = (e: unknown, action: string): string =>
  e instanceof Error && e.message.startsWith(action) ? e.message : `${action} ${failReason(e)}`;

/** 서버 컴포넌트에서 실패를 빈 값과 구별해 받음. `.catch(asError)` 뒤 `instanceof Error` 로 가름 */
export const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
/** 서버가 404 를 돌려준 실패인지 */
export const isNotFound = (e: unknown): boolean => e instanceof ApiError && e.status === 404;

export const api = {
  // 인재상 기준 문장(TALENT-001)
  getTalentCriteria: () => http<TalentCriteria>("/talent-criteria"),
  addTalentCriterion: (axisNo: number, body: TalentCriterionInput) =>
    http<TalentCriterion>(`/talent-criteria/axes/${axisNo}/items`, { method: "POST", body: JSON.stringify(body) }),
  putTalentCriterion: (itemId: string, body: TalentCriterionInput & { updated_at: string }) =>
    http<TalentCriterion>(`/talent-criteria/items/${encodeURIComponent(itemId)}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTalentCriterion: (itemId: string, updatedAt: string) =>
    http<void>(`/talent-criteria/items/${encodeURIComponent(itemId)}?updated_at=${encodeURIComponent(updatedAt)}`, {
      method: "DELETE",
    }),
  // 분석별 선정 인재상 세트 (lib/talent-selection.ts 가 씀).
  // id 를 인코딩하지 않으면 "../" 가 든 값이 전송 전에 정규화돼 다른 엔드포인트를 때림
  getTalentSelection: (id: string) =>
    http<TalentSelectionResponse>(`/analysis-jobs/${encodeURIComponent(id)}/talent-selection`),
  putTalentSelection: (id: string, sets: TalentSetPayload[]) =>
    http<TalentSelectionResponse>(`/analysis-jobs/${encodeURIComponent(id)}/talent-selection`, {
      method: "PUT",
      body: JSON.stringify({ sets }),
    }),
  // 핵심인재(#1) 레이더의 합격자 평균 기준선
  getCorePassedBaseline: () =>
    http<{ core_passed_baseline: Record<string, number>; n_passed_matched: number; scale: string }>(
      `/core-passed-baseline`,
    ),
  getTuringMetrics: (period: TuringPeriod = "90d") => http<TuringMetricsResponse>(`/turing/metrics?period=${period}`),
  getTuringRisks: (period: TuringPeriod = "90d", maxItems = 8) =>
    http<TuringRiskResponse>(`/turing/hallucination-risks?period=${period}&max_items=${maxItems}`),
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
  getFailures: (id: string) =>
    http<JobFailuresResponse>(`/analysis-jobs/${encodeURIComponent(id)}/failures`),
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
    http<{ items: FeedbackEntry[] }>(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/feedback`),
  upsertFeedback: (
    id: string,
    applicantId: string,
    body: { component: string; item_key?: string; rating: boolean },
  ) =>
    http<FeedbackEntry>(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/feedback`, {
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
    return http<void>(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/feedback?${qs}`, {
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
    const res = await apiFetch(`/analysis-jobs/excel-sheets`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw await readApiError(res);
    return res.json() as Promise<string[]>;
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
    const res = await apiFetch(`/analysis-jobs/from-excel`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw await readApiError(res);
    return res.json() as Promise<{ job_id: string; status: string; created_at: string; warnings?: string[] }>;
  },
  deleteApplicant: (id: string, applicantId: string) =>
    http<void>(
      `/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}`,
      { method: "DELETE" },
    ),
  bulkUploadPapers: async (id: string, zipFile: File) => {
    const fd = new FormData();
    fd.append("file", zipFile);
    const res = await apiFetch(`/analysis-jobs/${id}/papers/bulk-upload`, {
      method: "POST",
      body: fd,
    });
    return prelimJson<{
      total_pdf_entries: number;
      queued: number;
      duplicate_skipped: number;
      unmatched_applicants: string[];
      errors: string[];
      queued_file_ids: number[];
    }>(res);
  },
  reportPdfUrl: (id: string) => downloadUrl(`/analysis-jobs/${id}/report.pdf`),
  resultCsvUrl: (id: string) => downloadUrl(`/analysis-jobs/${id}/result.csv`),

  // 논문 첨부
  listPapers: (id: string, applicantId: string) =>
    http<PaperFile[]>(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/papers`),
  getPaperDetail: (id: string, applicantId: string, fileId: number) =>
    http<PaperDetail>(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/papers/${fileId}`),
  uploadPaper: async (id: string, applicantId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/papers`,
      { method: "POST", body: fd },
    );
    if (!res.ok) throw await readApiError(res);
    return res.json() as Promise<PaperFile>;
  },
  deletePaper: (id: string, applicantId: string, fileId: number) =>
    http<void>(
      `/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/papers/${fileId}`,
      { method: "DELETE" },
    ),
  paperPdfUrl: (id: string, applicantId: string, fileId: number) =>
    downloadUrl(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/papers/${fileId}/pdf`),

  // 직군 적합도 v2
  getDeptFit: (id: string, applicantId: string) =>
    http<DeptFitResponse>(`/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/dept-fit`),
  recomputeDeptFit: (id: string, applicantId: string) =>
    http<{ enqueued: boolean; applicant_id: string }>(
      `/analysis-jobs/${id}/applicants/${encodeURIComponent(applicantId)}/dept-fit/recompute`,
      { method: "POST" },
    ),
};

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
  /** 백엔드가 규칙별 템플릿으로 만든 제척사유 문장. 옛 결과에는 없을 수 있음 */
  reason?: string;
}
export interface PrelimCounts {
  applicants: number;
  blind_by_category: Record<string, number>;
  blind_total: number;
  recusal_by_rule: Record<string, number>;
  recusal_total: number;
  /** 수험번호가 빈 줄 수: 대시보드 지원자 번호와 연결되지 않는 줄 */
  no_id_rows?: number;
  /** 읽지 못해 건너뛴 파일·시트 안내 */
  skipped?: string[];
}
/** 제척 기준 정보 탭의 표 세 가지 */
export type PrelimRefKind = "staff" | "orgs" | "reviewers";
export type PrelimRefRow = { id: number } & Record<string, string | number | null>;
export type PrelimRefSummary = Record<PrelimRefKind, { count: number; updated_at: string | null }>;
/** 제척 기준 정보 엑셀 올리기 미리보기. 충돌 key 는 "kind:id" */
export interface PrelimRefImportSheet {
  kind: PrelimRefKind;
  label: string;
  found: boolean;
  total: number;
  add: number;
  update: number;
  delete: number;
  conflict: number;
  bulk_delete: boolean;
  added: { row: number; name: string; same_name: boolean }[];
  updated: { id: number; row: number; name: string; changes: { label: string; db: string; excel: string }[] }[];
  deleted_names: string[];
  conflicts: {
    key: string;
    id: number;
    row: number | null;
    type: "update" | "delete";
    name: string;
    cols: { label: string; db: string; excel: string }[];
  }[];
  skipped: { row: number; name: string; reason: string }[];
  notes: string[];
}
export interface PrelimRefImportPreview {
  token: string;
  file_name: string;
  form: string | null;
  download_id: string | null;
  downloaded_at: string | null;
  delete_enabled: boolean;
  /** 이 내려받기 파일로 이미 한 번 추가를 반영함(관리번호 빈 줄이 다시 추가될 수 있음) */
  already_applied: boolean;
  no_change: boolean;
  sheets: PrelimRefImportSheet[];
}
export interface PrelimRefImportApplied {
  file_name: string;
  add: number;
  update: number;
  delete: number;
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
  warnings?: string[];
}
// --- 사전스크리닝 결과 화면(담당자 HTML v1). 계산은 서버 derive.py 한 곳, 화면은 받은 값을 그리기만 함 ---
export type PrelimStage = "서류" | "필기" | "면접";
export type PrelimVerdictValue = "confirm" | "dismiss" | "hold";
export interface PrelimEssayItem {
  id: string; no: string; name: string; type: string; category: string;
  q: number; item: string; itemName: string;
  before: string; hit: string; after: string; why: string;
  /** 같은 자리에서 여러 유형으로 걸려 합친 적발의 유형 목록(type 은 " · " 로 이은 글자) */
  types?: string[];
  merged_ids?: string[];
}
export interface PrelimAttachItem {
  id: string; no: string; name: string; cat: string; file: string;
  lang: string; match: string; hits: number[]; total: number; snip: string;
  is_image?: boolean;
  /** 매칭된 쪽의 발췌. 키는 쪽 번호 */
  excerpts?: Record<string, string>;
  /** 쪽 번호별 검출 위치 상자 [x0, y0, x1, y1] (쪽 크기 대비 0~1 비율). 위치를 못 잡은 쪽은 없음 */
  boxes?: Record<string, number[][]>;
  in_filename?: boolean;
  ocr_limited?: boolean;
  suggested?: { value: PrelimVerdictValue; reason?: string | null } | null;
}
export interface PrelimInternalRow {
  id: string; no: string; name: string; project: string;
  from: string | null; to: string | null; kind: "내부참여" | "외부참여";
  dept?: string | null; dfrom?: string | null; dto?: string | null;
  pi: string | null; s: string | null; e: string | null; ap: string | null;
  flag: "yes" | "no" | null;
}
export interface PrelimWorkRow {
  id: string; no: string; name: string; dept: string;
  from: string | null; to: string | null;
  hd: string | null; up: string | null; within2y: boolean;
}
export interface PrelimDegreeRow {
  id: string; no: string; name: string; deg: string; school: string; major: string;
  prof: string; staff: string; staffDept: string; staffDeg: string;
  /** 담당자가 전공명 AI 비교에서 확정한 줄 */
  ai_confirmed?: boolean;
}
/** 전공명 AI 비교(확정 제척 아님). label 은 서버가 붙인 화면·엑셀 공통 글자 */
export type PrelimAiRelation = "equivalent_expression" | "related_uncertain" | "different" | "unknown";
export interface PrelimDegreeAiRow extends PrelimDegreeRow {
  staffMajor: string; relation: PrelimAiRelation; label: string; reason: string;
  error: string | null; incomplete: boolean; cached: boolean;
  model: string | null; prompt_version: string | null; compared_at: string | null;
  /** 근거 칸 문장(전공별 한 줄), 담당자 판정 */
  why?: string; verdict?: "confirm" | "dismiss" | null;
  comparisons: { applicant_major: string; staff_major: string; relation: PrelimAiRelation; label: string;
    reason: string; error: string | null; cached: boolean }[];
}
/** 지원자 지도교수가 내부위원(제척(내부)) 또는 직전 채용 섭외 위원(제척(외부))인 경우 */
export interface PrelimAdvisorRow {
  id: string; no: string; name: string; advisor: string; rule: "내부위원" | "직전 채용 위원";
}
export interface PrelimExternalRow {
  id: string; no: string; name: string; org: string;
  from: string | null; to: string | null;
}
export interface PrelimView {
  version: number; legacy?: boolean; end: string | null; notice: string | null;
  essay: PrelimEssayItem[]; attach: PrelimAttachItem[];
  external: PrelimExternalRow[];
  missing: { count: number; rows: number[] };
  warnings: string[];
}
/** 제척(내부) 항목. win = 제척 해당(2년 이내 또는 동일학력·지도교수) */
export interface PrelimInxItem {
  id: string; no: string; kind: string; basis: string;
  from: string | null; to: string | null; pending: boolean;
  targets: { label: string; reason: string }[]; win: boolean;
}
export interface PrelimStaffRow {
  name: string; title: string; dept: string; reasons: string[]; nos: string[]; cnt: number;
}
export interface PrelimCommittee {
  src: string[]; name: string; org: string; title: string; phone?: string; mail?: string;
  reasons?: string[];
}
export interface PrelimOrgRow { org: string; people: number; count: number; within: number }
export interface PrelimPersonRow {
  no: string; name: string; essay: number; attach: number; internal: number; external: number;
  essay_done: boolean; out: string | null;
  penalty?: boolean;
  /** 가산점 증빙 검토 대상자면 구분과 판정(grant·deny·hold, 미판정 null). 대상자 아니면 null */
  pref?: { cats: string[]; verdict: string | null } | null;
}
/** 가산점 증빙 검토 한 줄(PRELIM-001) */
export interface PrelimPrefFile { id: string; file: string; total: number; renderable: boolean }
export interface PrelimPrefRow {
  no: string; name: string;
  cats: { cat: string; raw: string }[];
  folders: { folder: string; files: PrelimPrefFile[] }[];
  verdict: PrelimVerdict | null;
}
export interface PrelimPref {
  /** 지원정보 엑셀을 올렸는지. legacy 는 이 기능 전에 만든 검토 */
  read: boolean | null; missing_cols: string[]; rows: PrelimPrefRow[]; legacy: boolean;
}
/** 블라인드 최종 결과 한 줄. st 빈 글자는 미판정 */
export interface PrelimFinalRow {
  id: string; no: string; kind: "자기소개서" | "첨부 실적"; cat: string; word: string;
  file: string | null; where: string; st: "confirm" | "hold" | "dismiss" | ""; reason: string | null;
}
export interface PrelimFinal {
  rows: PrelimFinalRow[];
  penalty: { no: string; count: number }[];
  pending: number;
}
export interface PrelimDerived {
  end: string | null; win: string | null;
  summary_fixed: {
    people_matrix: PrelimPersonRow[];
    kpi: {
      essay_total: number; essay_people: number; essay_by_type: [string, number][];
      attach_total: number; attach_done: number;
      internal_total: number; external_total: number;
      missing: { count: number; rows: number[] };
      penalty_people?: number;
      pref_people?: number;
    };
    tab_counts: { essay: number; attach: number; inx: number; exx: number; final?: number; pref?: number };
    attach_confirmed: number;
    progress: { done: number; total: number };
    org_bars: [string, number][];
    internal_staff: PrelimStaffRow[];
    committee_list: PrelimCommittee[];
    /** 외부위원 목록 출처. reference = 제척 기준 정보의 섭외 심사위원, 없으면 null */
    committee_source: "reference" | null;
    dropped_count: number;
  };
  inx: {
    staff_rows: PrelimStaffRow[];
    items?: PrelimInxItem[];
    pending_count: number;
    internal: PrelimInternalRow[]; work: PrelimWorkRow[]; degree: PrelimDegreeRow[];
    advisor?: PrelimAdvisorRow[];
    /** api 재시작 전 응답에는 없고, 해당 기능 이전에 실행한 검토는 null */
    degree_ai?: PrelimDegreeAiRow[] | null;
    degree_ai_counts?: Record<PrelimAiRelation, number>;
  };
  /** api 재시작 전 응답에는 없음 */
  final?: PrelimFinal;
  exx: Record<PrelimStage, {
    org_rows: PrelimOrgRow[]; limited_org_rows: PrelimOrgRow[]; limited_org_count: number;
    restricted_committee: PrelimCommittee[]; gone_orgs: string[];
  }>;
  exx_detail: (PrelimExternalRow & { within2y: boolean; out: string | null; first: boolean; span: number })[];
  exx_advisor?: PrelimAdvisorRow[];
  /** api 재시작 전 응답에는 없음 */
  pref?: PrelimPref;
  warnings: string[];
}
export interface PrelimVerdict { value: string; reason: string | null }
export interface PrelimVerdicts {
  essay: Record<string, PrelimVerdict>;
  attach: Record<string, PrelimVerdict>;
  out: Record<string, PrelimVerdict>;
  /** 전공명 AI 비교 줄 확정·제외. api 재시작 전 응답에는 없음 */
  deg_ai?: Record<string, PrelimVerdict>;
  /** 가산점 증빙 검토 판정. 키는 지원자 번호 */
  pref?: Record<string, PrelimVerdict>;
}
export type PrelimUploadKind = "inx" | "work";
export interface PrelimResult extends PrelimRunResponse {
  computed_at: string;
  applicant_count: number;
  notice: string | null;
  deleted_at: string | null;
  /** reference 는 제척 기준 정보 건수·수정일 (9/23 이후 검토) */
  files_used: Record<
    string,
    string | null | { staff: number; orgs: number; reviewers?: number; updated_at: string | null }
  > | null;
  attach_status: "none" | "uploading" | "queued" | "scanning" | "done" | "failed";
  attach_done: number | null; attach_total: number | null;
  attach_error?: string | null;
  /** 엑셀 검토 진행(PRELIM-002). 예전 서버·검토는 없거나 done. done 이 아니면 view·verdicts·derived 는 null */
  run_status?: "running" | "done" | "failed";
  run_error?: string | null;
  /** 서버가 받은 첨부 바이트 수. 끊긴 업로드를 이어 올릴 때 씀 */
  attach_received?: number;
  attach_size?: number | null;
  attach_name?: string | null;
  /** 이 업로드의 준비 번호. 다른 창이 처음부터 다시 올리면 바뀜 */
  attach_id?: string | null;
  view: PrelimView;
  verdicts: PrelimVerdicts | null;
  /** warnings: 올린 파일에서 빠진 열·빈 칸 알림. 9/30 이전 업로드에는 없음 */
  uploads: Partial<Record<PrelimUploadKind, { file_name: string; uploaded_at: string | null; warnings?: string[] }>>;
  derived: PrelimDerived | null;
}

/** 사전스크리닝 API 응답. 실패면 ApiError(서버 한글 사유는 그대로 실림) */
async function prelimJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw await readApiError(res);
  return res.json() as Promise<T>;
}

export interface PrelimSummary {
  ticket: string;
  label: string | null;
  eval_date: string | null;
  counts: PrelimCounts;
  applicant_count: number;
  computed_at: string;
  notice?: string | null;
  deleted_at?: string | null;
  attach_status?: string;
  attach_done?: number | null;
  attach_total?: number | null;
  run_status?: "running" | "done" | "failed";
  /** view 를 저장하기 전의 옛 실행은 null */
  view_counts?: { essay: number; attach: number; inx: number; exx: number } | null;
  judged?: number;
  /** 판정 대상 수(자소서 위배 + 첨부 후보 + 다른 전공이 아닌 AI 비교 줄) */
  judged_total?: number | null;
}

/** 첨부 조각을 서버가 받은 곳과 다른 위치부터 보냈을 때. received 부터 다시 보내면 됨 */
export class AttachOffsetError extends Error {
  constructor(public received: number) {
    super("받은 곳과 다른 위치부터 보냈습니다.");
  }
}

export const prelim = {
  /** ticket 을 바로 돌려주고 검토는 서버에서 이어서 함(PRELIM-002) */
  async run(form: FormData): Promise<{ ticket: string; run_status?: "running" }> {
    const res = await apiFetch(`/prelim/run`, {
      method: "POST",
      body: form,
    });
    // 서버가 detail 에 담아 보낸 한글 안내(예: 암호 걸린 엑셀)는 그대로 보여 줌
    if (!res.ok) throw await readApiError(res);
    return res.json();
  },
  list: (opts?: { trashed?: boolean; limit?: number }) =>
    http<{ items: PrelimSummary[] }>(
      `/prelim/results?limit=${opts?.limit ?? 20}${opts?.trashed ? "&trashed=true" : ""}`,
    ),
  remove: (ticket: string, hard = false) =>
    http<{ ticket: string }>(`/prelim/results/${encodeURIComponent(ticket)}${hard ? "?hard=1" : ""}`, { method: "DELETE" }),
  restore: (ticket: string) =>
    http<{ ticket: string }>(`/prelim/results/${encodeURIComponent(ticket)}/restore`, { method: "POST" }),
  /** 제척 기준 정보(내부위원 학력정보, 섭외 심사위원 목록, 연구기관 목록). 검토 실행 때 서버가 이 표를 읽음 */
  reference: {
    summary: () => http<PrelimRefSummary>(`/prelim/reference/summary`),
    list: (kind: PrelimRefKind) => http<{ items: PrelimRefRow[] }>(`/prelim/reference/${kind}`),
    async create(kind: PrelimRefKind, body: Record<string, string | null>): Promise<PrelimRefRow> {
      const res = await apiFetch(`/prelim/reference/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: timeoutSignal(30_000),
      });
      return prelimJson<PrelimRefRow>(res);
    },
    async update(kind: PrelimRefKind, id: number, body: Record<string, string | null>): Promise<PrelimRefRow> {
      const res = await apiFetch(`/prelim/reference/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: timeoutSignal(30_000),
      });
      return prelimJson<PrelimRefRow>(res);
    },
    async remove(kind: PrelimRefKind, id: number): Promise<void> {
      const res = await apiFetch(`/prelim/reference/${kind}/${id}`, { method: "DELETE" });
      await prelimJson(res);
    },
    /** empty 면 줄 없는 빈 양식 */
    exportUrl: (empty = false) => downloadUrl(`/prelim/reference/export.xlsx${empty ? "?empty=1" : ""}`),
    async importPreview(file: File): Promise<PrelimRefImportPreview> {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch(`/prelim/reference/import/preview`, {
        method: "POST",
        body: fd,
        signal: timeoutSignal(120_000),
      });
      return prelimJson<PrelimRefImportPreview>(res);
    },
    async importApply(body: {
      token: string;
      choices: Record<string, "db" | "excel">;
      confirm_bulk_delete: boolean;
    }): Promise<PrelimRefImportApplied> {
      const res = await apiFetch(`/prelim/reference/import/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: timeoutSignal(120_000),
      });
      return prelimJson<PrelimRefImportApplied>(res);
    },
    async importCancel(token: string): Promise<void> {
      const res = await apiFetch(`/prelim/reference/import/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: timeoutSignal(30_000),
      });
      await prelimJson(res);
    },
  },
  result: (ticket: string) => http<PrelimResult>(`/prelim/results/${encodeURIComponent(ticket)}`),
  verdict: {
    /** value 가 null 이면 판정 취소. 화면은 응답의 verdicts·derived 로만 갱신함 */
    async put(ticket: string, body: { kind: "essay" | "attach" | "out" | "deg_ai" | "pref"; item_id: string; value: string | null; reason?: string | null }) {
      const res = await apiFetch(`/prelim/results/${encodeURIComponent(ticket)}/verdicts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // 저장은 한 줄로 차례대로 가므로, 멈춘 요청 하나가 뒤의 저장을 붙잡지 않게 끊음
        signal: timeoutSignal(30_000),
      });
      return prelimJson<{ verdicts: PrelimVerdicts; derived: PrelimDerived }>(res);
    },
  },
  upload: {
    async put(ticket: string, kind: PrelimUploadKind, file: File) {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/prelim/results/${encodeURIComponent(ticket)}/uploads/${kind}`, {
        method: "PUT",
        body: form,
        signal: timeoutSignal(120_000),
      });
      return prelimJson<{ uploads: PrelimResult["uploads"]; derived: PrelimDerived }>(res);
    },
  },
  attach: {
    status: () => http<{ enabled: boolean; max_bytes: number }>(`/prelim/attach/status`),
    /** 크기·디스크 검사. 업로드 중·실패면 받은 조각을 지우고 처음부터 받을 준비를 함 */
    async prepare(ticket: string, file: File): Promise<{ attach_id?: string }> {
      const pre = await apiFetch(`/prelim/results/${encodeURIComponent(ticket)}/attach/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size_bytes: file.size, file_name: file.name }),
      });
      return prelimJson<{ attach_id?: string }>(pre);
    },
    /** zip 의 offset 부터 한 조각을 보냄. 진행률 때문에 XHR 을 씀. 받은 위치가 다르면 AttachOffsetError */
    async sendFrom(
      ticket: string,
      piece: Blob,
      offset: number,
      attachId: string | null | undefined,
      onProgress: (sent: number) => void,
    ): Promise<{ received: number; attach_status: string }> {
      const path =
        `/prelim/results/${encodeURIComponent(ticket)}/attach?offset=${offset}` +
        (attachId ? `&attach_id=${encodeURIComponent(attachId)}` : "");
      // 본문 전송 시작 때 한 번만 검사하므로, 긴 전송 중에 토큰이 만료돼도 끊기지 않음
      const token = await apiToken(540);
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}${path}`);
        xhr.setRequestHeader("Content-Type", "application/zip");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => onProgress(e.loaded);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText));
          if (xhr.status === 409) {
            try {
              const b = JSON.parse(xhr.responseText);
              if (typeof b.received === "number") return reject(new AttachOffsetError(b.received));
            } catch {}
          }
          reject(apiError(xhr.status, xhr.responseText, path));
        };
        xhr.onerror = () => reject(new Error("업로드 중 연결이 끊겼습니다."));
        xhr.send(piece);
      });
    },
  },
  /** 표별 xlsx. stage 는 exx-com 에만 씀 */
  exportKeyUrl: (ticket: string, key: string, stage?: PrelimStage) =>
    downloadUrl(
      `/prelim/results/${encodeURIComponent(ticket)}/export/${encodeURIComponent(key)}` +
        (stage ? `?stage=${encodeURIComponent(stage)}` : ""),
    ),
};

/** 외부위원 섭외 회차 정리. 기준일·경계일·대상은 서버가 계산한 값을 그대로 씀 */
export interface PrelimRetentionPreview {
  base_date: string;
  cutoff: string;
  token: string;
  count: number;
  items: { id: number; recruitment: string | null; stage: string | null; held_on: string; name: string }[];
  excluded_internal: number;
  needs_check: { unknown_origin: number; missing_date: number };
}
export interface PrelimRetentionRun {
  id: number;
  run_at: string;
  base_date: string;
  cutoff: string;
  deleted_count: number;
}
/** status 가 409 면 미리보기 갱신 필요, 423 이면 다른 실행 중, 없으면 응답을 못 받음 */
export type PrelimRetentionError = Error & { status?: number };


export const prelimRetention = {
  async preview(): Promise<PrelimRetentionPreview> {
    const res = await apiFetch(`/prelim/reference/retention/preview`, {
      cache: "no-store",
      signal: timeoutSignal(30_000),
    });
    return prelimJson<PrelimRetentionPreview>(res);
  },
  async history(limit = 20): Promise<{ items: PrelimRetentionRun[] }> {
    const res = await apiFetch(`/prelim/reference/retention/history?limit=${limit}`, {
      cache: "no-store",
      signal: timeoutSignal(30_000),
    });
    return prelimJson<{ items: PrelimRetentionRun[] }>(res);
  },
  async run(body: { token: string; base_date: string; count: number }): Promise<Omit<PrelimRetentionRun, "id">> {
    const res = await apiFetch(`/prelim/reference/retention/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeoutSignal(60_000),
    });
    return prelimJson<Omit<PrelimRetentionRun, "id">>(res);
  },
};

export function feedbackKey(component: string, itemKey = ""): string {
  return `${component}::${itemKey}`;
}
