// ── Auth ─────────────────────────────────────────────────────────
export type UserRole = 'recruiter' | 'hiring_manager' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  role: UserRole
}

// ── Jobs ─────────────────────────────────────────────────────────
export type JobStatus = 'draft' | 'generating_jd' | 'pending_approval' | 'approved' | 'published' | 'monitoring' | 'screening' | 'interviewing' | 'onboarding' | 'closed'

export interface Job {
  id: string
  title: string
  department: string
  location: string
  job_type: 'full_time' | 'part_time' | 'contract' | 'remote'
  experience_level: string
  status: JobStatus
  hiring_goal: string
  target_candidate_count?: number
  created_by: string
  created_at: string
  updated_at: string
  hired_count?: number
  rejected_count?: number
}

export interface JobDescription {
  id: string
  job_id: string
  content: string
  version: number
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  created_at: string
}

export interface CreateJobRequest {
  title: string
  department: string
  location: string
  job_type: string
  experience_level: string
  hiring_goal: string
  target_candidate_count?: number
}

// ── Candidates ───────────────────────────────────────────────────
export type CandidateStatus = 'applied' | 'screening' | 'shortlisted' | 'interview_scheduled' | 'interviewed' | 'selected' | 'rejected' | 'onboarding'
export type MatchCategory = 'strong_match' | 'partial_match' | 'weak_match'

export interface Candidate {
  id: string
  name: string
  email: string
  phone?: string
  job_id: string
  status: CandidateStatus
  resume_url?: string
  created_at: string
}

export interface CandidateScore {
  id: string
  candidate_id: string
  job_id: string
  score: number
  category: MatchCategory
  explanation: string
  skills_matched: string[]
  skills_missing: string[]
  created_at: string
}

export interface CandidateProfile extends Candidate {
  score?: CandidateScore
  interviews?: Interview[]
  onboarding_tasks?: OnboardingTask[]
}

// ── Interviews ───────────────────────────────────────────────────
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'

export interface Interview {
  id: string
  candidate_id: string
  job_id: string
  scheduled_at: string
  duration_minutes: number
  interviewer: string
  interview_type: 'technical' | 'hr' | 'cultural_fit' | 'final'
  status: InterviewStatus
  meeting_link?: string
  calendar_event_id?: string
  created_at: string
}

// ── Workflow ─────────────────────────────────────────────────────
export type WorkflowStage =
  | 'not_started'
  | 'supervisor'
  | 'planning'
  | 'jd_generation'
  | 'human_approval'
  | 'sourcing'
  | 'monitoring'
  | 'screening'
  | 'human_review'
  | 'interviewing'
  | 'onboarding'
  | 'completed'
  | 'failed'

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'waiting_approval'

export interface WorkflowState {
  id: string
  job_id: string
  current_stage: WorkflowStage
  agent_statuses: Record<string, AgentStatus>
  started_at: string
  updated_at: string
  error?: string
}

export interface AgentLog {
  id: string
  workflow_id: string
  agent_name: string
  action: string
  input_summary: string
  output_summary: string
  latency_ms: number
  token_usage: number
  status: 'success' | 'failure'
  created_at: string
}

// ── Onboarding ───────────────────────────────────────────────────
export interface OnboardingTask {
  id: string
  candidate_id: string
  task_name: string
  description: string
  assigned_to: string
  status: 'pending' | 'in_progress' | 'completed'
  due_date: string
  completed_at?: string
}

// ── Analytics ────────────────────────────────────────────────────
export interface DashboardMetrics {
  active_jobs: number
  total_candidates: number
  interviews_this_week: number
  offers_made: number
  avg_time_to_hire_days: number
  screening_pass_rate: number
}

export interface FunnelData {
  stage: string
  count: number
  conversion_rate: number
}

export interface HiringTrend {
  month: string
  applications: number
  shortlisted: number
  hired: number
}

// ── API Responses ─────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  detail: string
  status_code?: number
}
