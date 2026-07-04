import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi, jobsApi } from '@/api'
import {
  GitBranch, Activity, CheckCircle2, XCircle, AlertCircle, Loader2,
  Briefcase, RefreshCw, ClipboardList, FileText, UserCheck, Send,
  Eye, Search, Users, Video, UserPlus, AlertTriangle, ChevronRight,
  X, Zap, Brain, Bot, RotateCcw, ArrowRightLeft
} from 'lucide-react'
import type { JobStatus, AgentLog } from '@/types'
import toast from 'react-hot-toast'

/* ─── Types ──────────────────────────────────────────────── */
type StageState = 'idle' | 'running' | 'completed' | 'failed' | 'waiting_approval'

interface NodeDef {
  id: string
  title: string
  shortTitle: string
  agentName: string
  agentType: 'ai' | 'human'
  description: string
  icon: any
  subSteps: string[]
  col: number   // column index (x)
  row: number   // row index (y)
}

interface EdgeDef {
  from: string
  to: string
  type: 'forward' | 'loop' | 'branch_yes' | 'branch_no' | 'feedback'
  label?: string
}

/* ─────────────────────────────────────────────────────────
   LAYOUT STRATEGY
   We use a 5-column grid:
     Col 0  – Loop / feedback paths (left channel)
     Col 1  – Monitoring / JD optimization side lane
     Col 2  – Main pipeline spine (centre)
     Col 3  – Parallel review / renegotiation lane
     Col 4  – Rejection / close lane (right channel)
   ───────────────────────────────────────────────────────── */

const NODES: NodeDef[] = [
  /* ── Main spine ────────────────────────────────────────── */
  {
    id: 'supervisor',
    title: 'Workflow Orchestration',
    shortTitle: 'Supervisor',
    agentName: 'Supervisor Agent',
    agentType: 'ai',
    description: 'Orchestrates the entire recruitment pipeline. Routes tasks, manages memory, and handles exceptions.',
    icon: Brain,
    col: 2, row: 0,
    subSteps: ['Parse hiring goal & parameters', 'Initialise workflow session', 'Delegate to Planning Agent'],
  },
  {
    id: 'planning',
    title: 'Recruitment Planning',
    shortTitle: 'Planning',
    agentName: 'Planning Agent',
    agentType: 'ai',
    description: 'Converts recruiting goals into structured pipeline milestones and target timelines.',
    icon: ClipboardList,
    col: 2, row: 1,
    subSteps: ['Analyse job requirements & timeline', 'Formulate stage sequence & targets', 'Save plan to short-term memory'],
  },
  {
    id: 'jd_generation',
    title: 'JD Drafting',
    shortTitle: 'JD Drafting',
    agentName: 'JD Agent',
    agentType: 'ai',
    description: 'Generates AI-optimised Job Descriptions using LLM chain with skills DB lookup.',
    icon: FileText,
    col: 2, row: 2,
    subSteps: ['Search skills database', 'Invoke generative LLM chain', 'Parse draft into standard sections'],
  },
  {
    id: 'human_approval',
    title: 'JD Review & Approval',
    shortTitle: 'JD Approval',
    agentName: 'Human Recruiter',
    agentType: 'human',
    description: 'Recruiter reviews the JD draft. On rejection, JD Agent is re-invoked with feedback — loop continues until approved.',
    icon: UserCheck,
    col: 2, row: 3,
    subSteps: ['Notify hiring manager of JD draft', 'Capture edits / feedback', 'Unlock sourcing upon approval'],
  },
  {
    id: 'sourcing',
    title: 'Job Posting & Sourcing',
    shortTitle: 'Sourcing',
    agentName: 'Sourcing Agent',
    agentType: 'ai',
    description: 'Publishes approved JD to LinkedIn, Indeed, Naukri, Wellfound and company careers portal.',
    icon: Send,
    col: 2, row: 4,
    subSteps: ['Generate board-specific metadata', 'Submit listings to job board APIs', 'Save initial candidate profile records'],
  },
  {
    id: 'wait_primary',
    title: 'Wait 7 Days',
    shortTitle: 'Wait (7d)',
    agentName: 'Scheduler',
    agentType: 'ai',
    description: 'System waits 7 days for applications to accumulate before evaluating threshold.',
    icon: RotateCcw,
    col: 2, row: 5,
    subSteps: ['Hold pipeline for 7 days', 'Monitor application stream passively'],
  },
  {
    id: 'monitoring',
    title: 'Application Volume Check',
    shortTitle: 'Monitoring',
    agentName: 'Monitoring Agent',
    agentType: 'ai',
    description: 'Checks if applications ≥ threshold (10). If below threshold, triggers JD optimisation loop.',
    icon: Eye,
    col: 2, row: 6,
    subSteps: ['Track applicant counts vs. target', 'Analyse application velocity trends', 'Decide: threshold reached or loop'],
  },
  {
    id: 'jd_optimization',
    title: 'JD Optimisation',
    shortTitle: 'JD Optimise',
    agentName: 'JD Optimisation Agent',
    agentType: 'ai',
    description: 'Improves JD with keywords, visibility tweaks and market benchmark data when volume is below threshold.',
    icon: ArrowRightLeft,
    col: 0, row: 6,
    subSteps: ['Analyse low-response patterns', 'Add SEO keywords & improve clarity', 'Benchmark against market JDs'],
  },
  {
    id: 'repost',
    title: 'Repost Updated JD',
    shortTitle: 'Repost JD',
    agentName: 'Sourcing Agent',
    agentType: 'ai',
    description: 'Re-publishes the optimised JD across all job boards after each optimisation cycle.',
    icon: Send,
    col: 0, row: 5,
    subSteps: ['Push updated JD to all boards', 'Reset application collection window'],
  },
  {
    id: 'wait_loop',
    title: 'Wait 48h (Loop)',
    shortTitle: 'Wait (48h)',
    agentName: 'Scheduler',
    agentType: 'ai',
    description: 'After reposting, system waits 48 hours before re-evaluating application threshold.',
    icon: RotateCcw,
    col: 0, row: 4,
    subSteps: ['Hold 48 hours for new applications', 'Trigger monitoring check again'],
  },
  {
    id: 'screening',
    title: 'Resume Screening',
    shortTitle: 'Screening',
    agentName: 'Screening Agent',
    agentType: 'ai',
    description: 'AI parses and scores all resumes. Ranks candidates against JD match criteria.',
    icon: Search,
    col: 2, row: 7,
    subSteps: ['Parse incoming resume PDFs', 'Calculate ATS match scores', 'Generate screening justification'],
  },
  {
    id: 'human_review',
    title: 'Shortlist Validation',
    shortTitle: 'Shortlist Review',
    agentName: 'Human Recruiter',
    agentType: 'human',
    description: 'Recruiter validates AI shortlist scores and approves candidates for interview stage.',
    icon: Users,
    col: 2, row: 8,
    subSteps: ['Present AI shortlists & reasoning', 'Allow recruiter overrides', 'Trigger calendar scheduling'],
  },
  {
    id: 'interviewing',
    title: 'Interview Coordination',
    shortTitle: 'Interviews',
    agentName: 'Interview Agent',
    agentType: 'ai',
    description: 'Schedules technical + HR interviews, runs AI evaluation simulations, compiles feedback.',
    icon: Video,
    col: 2, row: 9,
    subSteps: ['Generate meeting schedules', 'Run evaluation simulations', 'Compile feedback & scores'],
  },
  /* ── Candidate selection decision ──────────────────────── */
  {
    id: 'candidate_selected',
    title: 'Offer Letter Generation',
    shortTitle: 'Send Offer',
    agentName: 'Offer Agent',
    agentType: 'ai',
    description: 'Generates personalised offer letter and sends it to the selected candidate.',
    icon: FileText,
    col: 2, row: 10,
    subSteps: ['Compose offer letter with LLM', 'Attach compensation & benefits', 'Send via email service'],
  },
  {
    id: 'rejection_email',
    title: 'Rejection Notification',
    shortTitle: 'Rejection Email',
    agentName: 'Comms Agent',
    agentType: 'ai',
    description: 'Sends a personalised regret email to non-selected candidates.',
    icon: XCircle,
    col: 4, row: 10,
    subSteps: ['Generate personalised regret email', 'Send via email service', 'Update candidate status to Closed'],
  },
  /* ── Offer acceptance decision ──────────────────────────── */
  {
    id: 'offer_accepted',
    title: 'Onboarding Initiation',
    shortTitle: 'Onboarding',
    agentName: 'Onboarding Agent',
    agentType: 'ai',
    description: 'Prepares welcome package, employee record, IT accounts, and sends welcome kit.',
    icon: UserPlus,
    col: 2, row: 11,
    subSteps: ['Collect documents & verification', 'Create employee record & ID', 'Trigger IT asset allocation & welcome kit'],
  },
  {
    id: 'renegotiation',
    title: 'Offer Renegotiation',
    shortTitle: 'Renegotiation',
    agentName: 'Renegotiation Agent',
    agentType: 'ai',
    description: 'Negotiates salary and benefits with the candidate. On acceptance → Onboarding. On final rejection → Close.',
    icon: ArrowRightLeft,
    col: 4, row: 11,
    subSteps: ['Initiate salary/benefits negotiation', 'Loop until acceptance or rejection', 'Route to Onboarding or Close'],
  },
]

/* ─── Edges (directed, typed) ────────────────────────────── */
const EDGES: EdgeDef[] = [
  // Main forward spine
  { from: 'supervisor',       to: 'planning',           type: 'forward' },
  { from: 'planning',         to: 'jd_generation',      type: 'forward' },
  { from: 'jd_generation',    to: 'human_approval',     type: 'forward' },
  // JD approval loop-back
  { from: 'human_approval',   to: 'jd_generation',      type: 'loop',      label: 'Rejected → revise' },
  // Approval → sourcing
  { from: 'human_approval',   to: 'sourcing',           type: 'branch_yes', label: 'Approved ✓' },
  { from: 'sourcing',         to: 'wait_primary',       type: 'forward' },
  { from: 'wait_primary',     to: 'monitoring',         type: 'forward' },
  // Monitoring decision
  { from: 'monitoring',       to: 'screening',          type: 'branch_yes', label: '≥ Threshold ✓' },
  { from: 'monitoring',       to: 'jd_optimization',   type: 'branch_no',  label: '< Threshold ✗' },
  // Optimisation loop
  { from: 'jd_optimization',  to: 'repost',             type: 'loop' },
  { from: 'repost',           to: 'wait_loop',          type: 'loop' },
  { from: 'wait_loop',        to: 'monitoring',         type: 'feedback',   label: 'Re-check' },
  // Screening → interview pipeline
  { from: 'screening',        to: 'human_review',       type: 'forward' },
  { from: 'human_review',     to: 'interviewing',       type: 'forward' },
  // Interview decision
  { from: 'interviewing',     to: 'candidate_selected', type: 'branch_yes', label: 'Selected ✓' },
  { from: 'interviewing',     to: 'rejection_email',    type: 'branch_no',  label: 'Rejected ✗' },
  // Offer decisions
  { from: 'candidate_selected', to: 'offer_accepted',  type: 'branch_yes', label: 'Accepted ✓' },
  { from: 'candidate_selected', to: 'renegotiation',   type: 'branch_no',  label: 'Counter ✗' },
  // Renegotiation loop
  { from: 'renegotiation',    to: 'offer_accepted',     type: 'branch_yes', label: 'Accepted ✓' },
  { from: 'renegotiation',    to: 'candidate_selected', type: 'feedback',   label: 'Loop back' },
]

/* ─── Stage progression order ────────────────────────────── */
const STAGE_ORDER = [
  'supervisor','planning','jd_generation','human_approval','sourcing',
  'wait_primary','monitoring','jd_optimization','repost','wait_loop',
  'screening','human_review','interviewing','candidate_selected',
  'rejection_email','offer_accepted','renegotiation',
]

/* ─── Status maps ────────────────────────────────────────── */
const jobStatusColor: Record<JobStatus, string> = {
  draft: '#64748b', generating_jd: '#6366f1', pending_approval: '#f59e0b',
  approved: '#10b981', published: '#3b82f6', monitoring: '#8b5cf6',
  screening: '#ec4899', interviewing: '#14b8a6', onboarding: '#a855f7', closed: '#ef4444',
}
const jobStatusLabel: Record<JobStatus, string> = {
  draft: 'Draft', generating_jd: 'JD Generation', pending_approval: 'Pending Approval',
  approved: 'Approved', published: 'Published', monitoring: 'Monitoring',
  screening: 'Screening', interviewing: 'Interviewing', onboarding: 'Onboarding', closed: 'Closed',
}

/* ─── Layout constants ───────────────────────────────────── */
const NW = 210    // node width  ← bigger
const NH = 90     // node height ← bigger
const COL_W = 280 // column pitch ← wider gap between columns
const ROW_H = 130 // row pitch   ← taller gap between rows
const PAD_X = 50
const PAD_Y = 56

const COLS = 5
const ROWS = 12

const colX = (c: number) => PAD_X + c * COL_W
const rowY = (r: number) => PAD_Y + r * ROW_H
const CANVAS_W = COLS * COL_W + PAD_X * 2
const CANVAS_H = ROWS * ROW_H + PAD_Y * 2

/* ─── Edge colours per type ──────────────────────────────── */
function edgeStyle(type: EdgeDef['type'], fromState: StageState) {
  const active = ['completed', 'running'].includes(fromState)
  switch (type) {
    case 'forward':     return { color: active ? '#10b981' : 'rgba(255,255,255,0.22)', dash: 'none',      width: active ? 3.5 : 2,   marker: active ? 'arr-done'   : 'arr-idle' }
    case 'branch_yes':  return { color: active ? '#10b981' : 'rgba(255,255,255,0.22)', dash: 'none',      width: active ? 3.5 : 2,   marker: active ? 'arr-done'   : 'arr-idle' }
    case 'branch_no':   return { color: active ? '#f59e0b' : 'rgba(255,255,255,0.18)', dash: '9 5',      width: active ? 3   : 1.8, marker: active ? 'arr-amber'  : 'arr-idle' }
    case 'loop':        return { color: active ? '#f97316' : 'rgba(255,255,255,0.18)', dash: '8 5',      width: active ? 3   : 1.8, marker: active ? 'arr-orange' : 'arr-idle' }
    case 'feedback':    return { color: active ? '#ec4899' : 'rgba(255,255,255,0.18)', dash: '10 5 3 5', width: active ? 3   : 1.8, marker: active ? 'arr-pink'   : 'arr-idle' }
    default:            return { color: 'rgba(255,255,255,0.12)', dash: 'none', width: 1.5, marker: 'arr-idle' }
  }
}

/* ─── Edge path routing ──────────────────────────────────── */
function buildEdgePath(from: NodeDef, to: NodeDef, type: EdgeDef['type']): string {
  const fx = colX(from.col) + NW / 2
  const fy = rowY(from.row) + NH
  const tx = colX(to.col) + NW / 2
  const ty = rowY(to.row)

  // Same column: simple cubic bezier top-to-bottom
  if (from.col === to.col) {
    if (from.row < to.row) {
      const cy = (fy + ty) / 2
      return `M ${fx} ${fy} C ${fx} ${cy}, ${tx} ${cy}, ${tx} ${ty}`
    }
    // Loop-back in same column — arc wide to the right so it clears the node
    const loopX = colX(from.col) + NW + 60
    return `M ${fx} ${fy} C ${loopX} ${fy}, ${loopX} ${ty}, ${tx} ${ty}`
  }

  // For loop/feedback going RIGHT → LEFT (e.g. monitoring → jd_optimization)
  if ((type === 'loop' || type === 'feedback' || type === 'branch_no') && from.col > to.col) {
    // Exit from the left side centre of from-node
    const exitX = colX(from.col)
    const exitY = rowY(from.row) + NH / 2
    // Curve outward to the left channel then into top of to-node
    const pullX = exitX - 80
    return `M ${exitX} ${exitY} C ${pullX} ${exitY}, ${pullX} ${ty + NH / 2}, ${tx} ${ty}`
  }

  // For loop/feedback going LEFT → RIGHT (e.g. wait_loop → monitoring)
  if ((type === 'loop' || type === 'feedback') && from.col < to.col) {
    const exitX = colX(from.col) + NW
    const exitY = rowY(from.row) + NH / 2
    const pullX = exitX + 80
    return `M ${exitX} ${exitY} C ${pullX} ${exitY}, ${pullX} ${ty + NH / 2}, ${tx} ${ty}`
  }

  // branch_no going LEFT → RIGHT or general cross-column forward
  const midY = (fy + ty) / 2
  return `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`
}

/* ─── Midpoint for edge labels ─────────────────────────────
   For cross-column edges the label should sit at the horizontal
   midpoint of the path, not the average of endpoints.          */
function edgeMid(from: NodeDef, to: NodeDef, type: EdgeDef['type']): { x: number; y: number } {
  const fx = colX(from.col) + NW / 2
  const fy = rowY(from.row) + NH
  const tx = colX(to.col) + NW / 2
  const ty = rowY(to.row)

  if (from.col === to.col) {
    // Same column — put label beside the arc, offset to the right
    if (from.row > to.row) {
      return { x: colX(from.col) + NW + 72, y: (fy + ty) / 2 }
    }
    return { x: (fx + tx) / 2, y: (fy + ty) / 2 }
  }

  // Cross-column — place label near the horizontal transit midpoint
  if ((type === 'loop' || type === 'feedback' || type === 'branch_no') && from.col > to.col) {
    const exitX = colX(from.col)
    const pullX = exitX - 80
    // quarter-point on the bezier (roughly where it bends)
    return { x: (exitX + pullX) / 2, y: rowY(from.row) + NH / 2 - 12 }
  }
  if ((type === 'loop' || type === 'feedback') && from.col < to.col) {
    const exitX = colX(from.col) + NW
    const pullX = exitX + 80
    return { x: (exitX + pullX) / 2, y: rowY(from.row) + NH / 2 - 12 }
  }

  return { x: (fx + tx) / 2, y: (fy + ty) / 2 }
}

function stateColors(state: StageState) {
  switch (state) {
    case 'completed':        return { stroke: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: '#10b981', text: '#10b981', badge: 'Completed',       filterId: 'glow-green'  }
    case 'running':          return { stroke: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: '#6366f1', text: '#a5b4fc', badge: 'Running',          filterId: 'glow-indigo' }
    case 'waiting_approval': return { stroke: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: '#f59e0b', text: '#f59e0b', badge: 'Awaiting Approval', filterId: 'glow-amber'  }
    case 'failed':           return { stroke: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: '#ef4444', text: '#ef4444', badge: 'Failed',            filterId: 'glow-red'    }
    default:                 return { stroke: 'rgba(255,255,255,0.09)', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.09)', text: '#4b5563', badge: 'Pending', filterId: '' }
  }
}

/* ─── Component ──────────────────────────────────────────── */
export default function WorkflowMonitor() {
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [dashOffset, setDashOffset] = useState(0)
  const [zoom, setZoom] = useState(0.58)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: jobs } = useQuery({ queryKey: ['jobs'], queryFn: () => jobsApi.list({ page_size: 50 }) })

  useEffect(() => {
    if (jobs?.items?.length && !selectedJobId) setSelectedJobId(jobs.items[0].id)
  }, [jobs, selectedJobId])

  const { data: workflowState } = useQuery({
    queryKey: ['workflow-status', selectedJobId],
    queryFn: () => workflowApi.status(selectedJobId),
    enabled: !!selectedJobId, refetchInterval: 5000,
  })

  const { data: logs } = useQuery<AgentLog[]>({
    queryKey: ['workflow-logs', selectedJobId],
    queryFn: () => workflowApi.logs(selectedJobId),
    enabled: !!selectedJobId, refetchInterval: 5000,
  })

  const retryMutation = useMutation({
    mutationFn: () => workflowApi.retryInterview(selectedJobId),
    onSuccess: () => {
      toast.success('Interview simulation re-triggered!')
      qc.invalidateQueries({ queryKey: ['workflow-status', selectedJobId] })
      qc.invalidateQueries({ queryKey: ['workflow-logs', selectedJobId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to retry'),
  })

  // Animate dashes
  useEffect(() => {
    const id = setInterval(() => setDashOffset(v => (v - 1) % 24), 50)
    return () => clearInterval(id)
  }, [])

  // Wheel zoom centred on cursor
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => {
      const next = Math.min(2.5, Math.max(0.2, z * delta))
      const scale = next / z
      setPan(p => ({ x: mx - scale * (mx - p.x), y: my - scale * (my - p.y) }))
      return next
    })
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    setIsPanning(true)
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.mx),
      y: panStart.current.py + (e.clientY - panStart.current.my),
    })
  }
  const stopPan = () => setIsPanning(false)

  const currentJob = jobs?.items?.find(j => j.id === selectedJobId)

  const getStatus = (id: string): StageState => {
    if (!workflowState) return 'idle'
    const keyMap: Record<string, string> = {
      supervisor: 'supervisor', planning: 'planning', jd_generation: 'jd_generation',
      human_approval: 'human_approval', sourcing: 'sourcing', monitoring: 'monitoring',
      screening: 'screening', human_review: 'human_review', interviewing: 'interview',
      candidate_selected: 'candidate_selected', offer_accepted: 'onboarding',
      renegotiation: 'renegotiation', rejection_email: 'rejection_email',
      jd_optimization: 'jd_optimization', repost: 'repost',
      wait_primary: 'wait_primary', wait_loop: 'wait_loop',
    }
    const raw = workflowState.agent_statuses?.[keyMap[id]] || 'idle'
    if (raw === 'threshold_reached' || raw === 'below_threshold') return 'completed'
    return raw as StageState
  }

  const getState = (id: string): StageState => {
    if (!workflowState) return 'idle'
    const cs = workflowState.current_stage
    const s = getStatus(id)
    if (['completed', 'failed', 'waiting_approval', 'running'].includes(s)) return s
    if (cs === 'completed') return 'completed'
    const ci = STAGE_ORDER.indexOf(cs), si = STAGE_ORDER.indexOf(id)
    if (ci !== -1 && si !== -1) {
      if (si < ci) return 'completed'
      if (si === ci) return 'running'
    }
    return 'idle'
  }

  const getLogs = (id: string): AgentLog[] => {
    if (!logs) return []
    const nameMap: Record<string, string> = {
      supervisor: 'Supervisor Agent', planning: 'Planning Agent', jd_generation: 'JD Agent',
      sourcing: 'Sourcing Agent', monitoring: 'Monitoring Agent', screening: 'Resume Screening Agent',
      interviewing: 'Interview Agent', offer_accepted: 'Onboarding Agent',
      jd_optimization: 'JD Optimisation Agent', renegotiation: 'Renegotiation Agent',
    }
    if (id === 'human_approval') return []
    if (id === 'human_review') return logs.filter(l => l.agent_name === 'Supervisor Agent' && l.action === 'human_review_completed')
    return logs.filter(l => l.agent_name === nameMap[id])
  }

  const getSubStep = (state: StageState, idx: number) => {
    if (state === 'completed') return 'done'
    if (state === 'idle') return 'pending'
    if (state === 'failed') return idx === 0 ? 'done' : idx === 1 ? 'failed' : 'pending'
    if (state === 'running') return idx === 0 ? 'done' : idx === 1 ? 'active' : 'pending'
    if (state === 'waiting_approval') return idx === 0 ? 'done' : 'active'
    return 'pending'
  }

  const completedCount = NODES.filter(n => getState(n.id) === 'completed').length
  const progress = NODES.length ? Math.round((completedCount / NODES.length) * 100) : 0
  const isStuckInterview = workflowState?.current_stage === 'interviewing' && workflowState?.agent_statuses?.['interview'] === 'running'

  // Edge type legend colours
  const EDGE_LEGEND = [
    { color: '#10b981', dash: 'none',     label: 'Forward flow' },
    { color: '#f59e0b', dash: '6px 4px',  label: 'Conditional branch' },
    { color: '#f97316', dash: '5px 4px',  label: 'Optimisation loop' },
    { color: '#ec4899', dash: '8px 4px',  label: 'Feedback / re-check' },
  ]

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', overflow: 'hidden', background: '#06060f', fontFamily: 'Inter, sans-serif' }}>

      {/* ── LEFT SIDEBAR ───────────────────────────────── */}
      <div style={{ width: 262, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <GitBranch size={17} color="#6366f1" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Workflow Monitor</span>
          </div>
          <p style={{ fontSize: 11.5, color: '#475569' }}>Multi-agent looping execution graph</p>
        </div>

        {workflowState && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="pulse-dot" style={{ background: '#10b981', width: 6, height: 6 }} />
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>Live · updates every 5s</span>
            </div>
          </div>
        )}

        {/* Loop / branch legend */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Edge Types</div>
          {EDGE_LEGEND.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <svg width={28} height={10} style={{ flexShrink: 0 }}>
                <line x1={2} y1={5} x2={26} y2={5} stroke={l.color} strokeWidth={1.8}
                  strokeDasharray={l.dash === 'none' ? undefined : l.dash} />
              </svg>
              <span style={{ fontSize: 10.5, color: '#64748b' }}>{l.label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 6px', marginBottom: 8 }}>
            Active Roles · {jobs?.items?.length || 0}
          </div>
          {!jobs?.items?.length ? (
            <div style={{ textAlign: 'center', padding: '36px 10px', color: '#374151' }}>
              <Briefcase size={26} style={{ display: 'block', margin: '0 auto 8px', color: '#1f2937' }} />
              <span style={{ fontSize: 12 }}>No jobs found</span>
            </div>
          ) : jobs.items.map(j => {
            const isSel = j.id === selectedJobId
            const sc = jobStatusColor[j.status] || '#64748b'
            return (
              <div key={j.id} onClick={() => { setSelectedJobId(j.id); setSelectedNode(null) }}
                style={{ padding: '11px 13px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s ease', background: isSel ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSel ? '#6366f1' : 'rgba(255,255,255,0.06)'}` }}
                onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}}
                onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: isSel ? '#a5b4fc' : '#cbd5e1', marginBottom: 3 }}>{j.title}</div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>{j.department} · {j.location}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc, boxShadow: `0 0 4px ${sc}` }} />
                  <span style={{ fontSize: 11, color: '#64748b' }}>{jobStatusLabel[j.status] || j.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── MAIN GRAPH AREA ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {!selectedJobId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#1f2937' }}>
            <Activity size={48} style={{ marginBottom: 14 }} />
            <p style={{ fontSize: 15, color: '#475569' }}>Select a job to view its workflow graph</p>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: '#374151', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>
                  Multi-Agent Workflow · {currentJob?.title}
                </div>
                {currentJob?.hiring_goal && (
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    Goal: <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>"{currentJob.hiring_goal}"</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Pipeline progress */}
                <div>
                  <div style={{ fontSize: 10.5, color: '#374151', marginBottom: 4, textAlign: 'right' }}>Pipeline Progress</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 130, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#6366f1,#10b981)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{progress}<span style={{ fontSize: 10, color: '#374151' }}>%</span></span>
                  </div>
                </div>

                {workflowState && (() => {
                  const cs = workflowState.current_stage
                  const clr = cs === 'completed' ? '#10b981' : cs === 'failed' ? '#ef4444' : '#6366f1'
                  const label = cs === 'completed' ? 'Completed' : cs === 'failed' ? 'Failed' : `Active: ${cs.replace(/_/g, ' ')}`
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: `${clr}18`, borderRadius: 20, border: `1px solid ${clr}40` }}>
                      <span className="pulse-dot" style={{ background: clr, width: 7, height: 7 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: clr }}>{label}</span>
                    </div>
                  )
                })()}

                {/* Loop indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 20 }}>
                  <RotateCcw size={11} color="#f97316" />
                  <span style={{ fontSize: 10.5, color: '#f97316', fontWeight: 600 }}>3 Active Loops</span>
                </div>
              </div>
            </div>

            {/* Canvas + Detail panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

              {/* SVG canvas */}
              <div
                ref={canvasRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={stopPan}
                onMouseLeave={stopPan}
                style={{
                  flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0,
                  cursor: isPanning ? 'grabbing' : 'grab',
                  userSelect: 'none',
                }}
              >
                {/* Transformed graph world */}
                <div style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  width: CANVAS_W,
                  height: CANVAS_H,
                  position: 'absolute',
                  top: 0, left: 0,
                }}>
                  <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} width={CANVAS_W} height={CANVAS_H} style={{ display: 'block' }}>
                    <defs>
                      {/* Glow filters */}
                      {[
                        { id: 'glow-green',  r: '0.06', g: '0.73', b: '0.51' },
                        { id: 'glow-indigo', r: '0.39', g: '0.40', b: '0.95' },
                        { id: 'glow-amber',  r: '0.96', g: '0.62', b: '0.04' },
                        { id: 'glow-red',    r: '0.94', g: '0.27', b: '0.27' },
                      ].map(f => (
                        <filter key={f.id} id={f.id} x="-60%" y="-60%" width="220%" height="220%">
                          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                          <feColorMatrix in="blur" type="matrix" values={`0 0 0 0 ${f.r}  0 0 0 0 ${f.g}  0 0 0 0 ${f.b}  0 0 0 1 0`} result="c" />
                          <feMerge><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      ))}

                      {/* Arrowhead markers — larger for visibility */}
                      {[
                        { id: 'arr-done',   fill: '#10b981' },
                        { id: 'arr-run',    fill: '#6366f1' },
                        { id: 'arr-amber',  fill: '#f59e0b' },
                        { id: 'arr-orange', fill: '#f97316' },
                        { id: 'arr-pink',   fill: '#ec4899' },
                        { id: 'arr-idle',   fill: 'rgba(255,255,255,0.3)' },
                      ].map(m => (
                        <marker key={m.id} id={m.id} markerWidth="12" markerHeight="12" refX="7" refY="4" orient="auto">
                          <path d="M0,0 L0,8 L10,4 z" fill={m.fill} />
                        </marker>
                      ))}

                      {/* Column lane backgrounds */}
                      <linearGradient id="lane-left" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(249,115,22,0.03)" />
                        <stop offset="100%" stopColor="rgba(249,115,22,0.01)" />
                      </linearGradient>
                      <linearGradient id="lane-right" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(236,72,153,0.03)" />
                        <stop offset="100%" stopColor="rgba(236,72,153,0.01)" />
                      </linearGradient>
                    </defs>

                    {/* Dot grid */}
                    {Array.from({ length: Math.ceil(CANVAS_H / 28) }, (_, ri) =>
                      Array.from({ length: Math.ceil(CANVAS_W / 28) }, (_, ci) => (
                        <circle key={`d${ri}-${ci}`} cx={ci * 28 + 14} cy={ri * 28 + 14} r={0.9} fill="rgba(255,255,255,0.03)" />
                      ))
                    )}

                    {/* Lane highlights */}
                    <rect x={colX(0) - 12} y={PAD_Y} width={COL_W} height={CANVAS_H - PAD_Y * 2} rx={12} fill="url(#lane-left)" />
                    <rect x={colX(4) - 12} y={PAD_Y} width={COL_W} height={CANVAS_H - PAD_Y * 2} rx={12} fill="url(#lane-right)" />

                    {/* Lane labels */}
                    <text x={colX(0) + NW / 2} y={PAD_Y - 18} textAnchor="middle" fontSize={9} fill="rgba(249,115,22,0.5)" fontWeight="700" fontFamily="Inter,sans-serif" letterSpacing="1">
                      OPTIMISATION LOOP
                    </text>
                    <text x={colX(2) + NW / 2} y={PAD_Y - 18} textAnchor="middle" fontSize={9} fill="rgba(99,102,241,0.5)" fontWeight="700" fontFamily="Inter,sans-serif" letterSpacing="1">
                      MAIN PIPELINE SPINE
                    </text>
                    <text x={colX(4) + NW / 2} y={PAD_Y - 18} textAnchor="middle" fontSize={9} fill="rgba(236,72,153,0.5)" fontWeight="700" fontFamily="Inter,sans-serif" letterSpacing="1">
                      REJECTION / CLOSE
                    </text>

                    {/* ── EDGES ──────────────────────────────────── */}
                    {EDGES.map((edge, ei) => {
                      const fromNode = NODES.find(n => n.id === edge.from)
                      const toNode = NODES.find(n => n.id === edge.to)
                      if (!fromNode || !toNode) return null
                      const fromState = getState(edge.from)
                      const es = edgeStyle(edge.type, fromState)
                      const isActive = ['completed', 'running'].includes(fromState)
                      const d = buildEdgePath(fromNode, toNode, edge.type)
                      const mid = edgeMid(fromNode, toNode, edge.type)
                      const isAnimated = isActive && (edge.type === 'loop' || edge.type === 'feedback' || edge.type === 'branch_no')
                      return (
                        <g key={`e-${ei}`}>
                          {/* Glow layer for active edges */}
                          {isActive && (
                            <path d={d} fill="none"
                              stroke={es.color} strokeWidth={14} opacity={0.18}
                            />
                          )}
                          {/* Solid edge */}
                          <path d={d} fill="none"
                            stroke={es.color}
                            strokeWidth={es.width}
                            strokeDasharray={es.dash === 'none' ? undefined : es.dash}
                            strokeDashoffset={isAnimated ? dashOffset : 0}
                            markerEnd={`url(#${es.marker})`}
                            opacity={isActive ? 0.9 : 0.6}
                          />
                          {/* Edge label */}
                          {edge.label && (
                            <g>
                              <rect
                                x={mid.x - 44} y={mid.y - 11}
                                width={88} height={22} rx={11}
                                fill="rgba(6,6,15,0.92)"
                                stroke={es.color}
                                strokeWidth={1.2}
                                strokeOpacity={0.8}
                              />
                              <text x={mid.x} y={mid.y + 4.5} textAnchor="middle"
                                fontSize={9.5} fill={es.color} fontWeight="700"
                                fontFamily="Inter,sans-serif">
                                {edge.label}
                              </text>
                            </g>
                          )}
                        </g>
                      )
                    })}

                    {/* ── NODES ──────────────────────────────────── */}
                    {NODES.map(node => {
                      const state = getState(node.id)
                      const c = stateColors(state)
                      const isSel = selectedNode?.id === node.id
                      const isHov = hoveredNodeId === node.id
                      const isRunning = state === 'running'
                      const nx = colX(node.col)
                      const ny = rowY(node.row)
                      const typeIsHuman = node.agentType === 'human'
                      const typeColor = typeIsHuman ? '#f59e0b' : '#818cf8'

                      // Special colouring for loop/side nodes
                      const isLoopNode = ['jd_optimization', 'repost', 'wait_loop', 'rejection_email', 'renegotiation'].includes(node.id)
                      const loopTint = isLoopNode
                        ? node.col === 0 ? 'rgba(249,115,22,0.06)' : 'rgba(236,72,153,0.06)'
                        : undefined

                      return (
                        <g key={node.id}
                          transform={`translate(${nx},${ny})`}
                          onClick={() => setSelectedNode(p => p?.id === node.id ? null : node)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          style={{ cursor: 'pointer' }}
                          filter={state !== 'idle' ? `url(#${c.filterId})` : ''}
                        >
                          {/* Animated ring for running */}
                          {isRunning && (
                            <rect x={-5} y={-5} width={NW + 10} height={NH + 10} rx={17} fill="none"
                              stroke="#6366f1" strokeWidth={1} strokeDasharray="7 4"
                              strokeDashoffset={dashOffset * 0.5} opacity={0.5} />
                          )}

                          {/* Selection highlight */}
                          {isSel && (
                            <rect x={-2} y={-2} width={NW + 4} height={NH + 4} rx={14} fill="none"
                              stroke={c.border} strokeWidth={2} opacity={0.9} />
                          )}

                          {/* Node body */}
                          <rect x={0} y={0} width={NW} height={NH} rx={11}
                            fill={isSel ? c.bg : isHov ? 'rgba(255,255,255,0.05)' : (loopTint || '#0c0c1c')}
                            stroke={isSel || isHov ? c.border : isLoopNode ? (node.col === 0 ? 'rgba(249,115,22,0.22)' : 'rgba(236,72,153,0.22)') : 'rgba(255,255,255,0.08)'}
                            strokeWidth={isSel ? 1.5 : 1}
                          />

                          {/* Left colour accent */}
                          <rect x={0} y={12} width={3} height={NH - 24} rx={2}
                            fill={c.stroke} opacity={state === 'idle' ? 0.25 : 1} />

                          {/* Status dot */}
                          <circle cx={9} cy={9} r={4} fill={c.stroke} opacity={state === 'idle' ? 0.3 : 1} />
                          {isRunning && <circle cx={9} cy={9} r={8} fill="none" stroke="#6366f1" strokeWidth={1} opacity={0.4} />}

                          {/* Agent type pill */}
                          <rect x={NW - 62} y={7} width={55} height={17} rx={8.5}
                            fill={`${typeColor}18`} stroke={`${typeColor}45`} strokeWidth={0.7} />
                          <text x={NW - 34.5} y={19} textAnchor="middle" fontSize={9} fill={typeColor} fontWeight="700" fontFamily="Inter,sans-serif">
                            {typeIsHuman ? '👤 HUMAN' : '🤖 AI'}
                          </text>

                          {/* Short title */}
                          <text x={20} y={NH / 2 - 6} fontSize={13.5} fontWeight="700"
                            fill={state === 'idle' ? '#374151' : '#e2e8f0'}
                            fontFamily="Inter,sans-serif">{node.shortTitle}</text>
                          {/* Agent name */}
                          <text x={20} y={NH / 2 + 10} fontSize={11} fill={state === 'idle' ? '#1f2937' : '#64748b'}
                            fontFamily="Inter,sans-serif">{node.agentName}</text>
                          {/* Status badge */}
                          <text x={20} y={NH / 2 + 25} fontSize={10} fill={c.text} fontWeight="600"
                            fontFamily="Inter,sans-serif">● {c.badge}</text>
                        </g>
                      )
                    })}

                    {/* ── Decision diamond labels ────────────────── */}
                    {[
                      { nodeId: 'human_approval', x: colX(2) + NW / 2, y: rowY(3) + NH + 10, label: '◆ JD Approved?' },
                      { nodeId: 'monitoring',     x: colX(2) + NW / 2, y: rowY(6) + NH + 10, label: '◆ ≥ 10 Applications?' },
                      { nodeId: 'interviewing',   x: colX(2) + NW / 2, y: rowY(9) + NH + 10, label: '◆ Candidate Selected?' },
                      { nodeId: 'candidate_selected', x: colX(2) + NW / 2, y: rowY(10) + NH + 10, label: '◆ Offer Accepted?' },
                      { nodeId: 'renegotiation',  x: colX(4) + NW / 2, y: rowY(11) + NH + 10, label: '◆ Accepted after nego?' },
                    ].map(dl => {
                      const st = getState(dl.nodeId)
                      const col = st === 'completed' ? '#10b981' : st === 'running' ? '#f59e0b' : '#374151'
                      return (
                        <text key={dl.nodeId} x={dl.x} y={dl.y}
                          textAnchor="middle" fontSize={8.5} fill={col} fontWeight="700"
                          fontFamily="Inter,sans-serif" opacity={0.8}>
                          {dl.label}
                        </text>
                      )
                    })}
                  </svg>

                  {/* Icon overlays */}
                  <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                    {NODES.map(node => {
                      const state = getState(node.id)
                      const c = stateColors(state)
                      const Icon = node.icon
                      const screenX = colX(node.col) + 2
                      const screenY = rowY(node.row) + (NH / 2 - 8)
                      return (
                        <div key={`ico-${node.id}`} style={{ position: 'absolute', left: screenX, top: screenY, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          {state === 'running'
                            ? <Loader2 size={13} color={c.stroke} style={{ animation: 'spin 1s linear infinite' }} />
                            : state === 'completed'
                            ? <CheckCircle2 size={13} color={c.stroke} />
                            : state === 'failed'
                            ? <XCircle size={13} color={c.stroke} />
                            : state === 'waiting_approval'
                            ? <AlertCircle size={13} color={c.stroke} />
                            : <Icon size={13} color={c.stroke} />
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>{/* end transform world */}

                {/* Zoom controls */}
                <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
                  {[{ label: '+', action: () => setZoom(z => Math.min(2.5, z * 1.2)) },
                    { label: '−', action: () => setZoom(z => Math.max(0.2, z / 1.2)) },
                    { label: '⊙', action: () => { setZoom(0.58); setPan({ x: 0, y: 0 }) } },
                  ].map(btn => (
                    <button key={btn.label} onClick={btn.action}
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(12,12,28,0.92)', color: '#94a3b8', fontSize: 16, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(6px)',
                      }}
                    >{btn.label}</button>
                  ))}
                  <div style={{ fontSize: 9, color: '#374151', textAlign: 'center', marginTop: 2 }}>{Math.round(zoom * 100)}%</div>
                </div>
              </div>

              {/* ── DETAIL PANEL ───────────────────────── */}
              {selectedNode && (() => {
                const nd = selectedNode
                const state = getState(nd.id)
                const c = stateColors(state)
                const nodeLogs = getLogs(nd.id)
                const typeColor = nd.agentType === 'human' ? '#f59e0b' : '#818cf8'
                // Find in/out edges
                const outEdges = EDGES.filter(e => e.from === nd.id)
                const inEdges = EDGES.filter(e => e.to === nd.id)
                return (
                  <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,8,18,0.98)', overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'slideIn 0.18s ease-out' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, marginRight: 8 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${c.stroke}18`, border: `1px solid ${c.stroke}40`, padding: '3px 9px', borderRadius: 12, marginBottom: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.stroke }} />
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.badge}</span>
                        </div>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3, marginBottom: 4 }}>{nd.title}</h3>
                        <div style={{ fontSize: 10.5, color: '#374151' }}>
                          Agent: <span style={{ color: typeColor, fontWeight: 600 }}>{nd.agentName}</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedNode(null)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 5px', cursor: 'pointer', color: '#475569' }}>
                        <X size={13} />
                      </button>
                    </div>

                    {/* Description */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 11 }}>
                      <p style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.6 }}>{nd.description}</p>
                    </div>

                    {/* Execution steps */}
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Execution Steps</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {nd.subSteps.map((step, idx) => {
                          const ss = getSubStep(state, idx)
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flexShrink: 0, width: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {ss === 'done'    && <div style={{ width: 17, height: 17, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={11} color="#10b981" /></div>}
                                {ss === 'active'  && <Loader2 size={13} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />}
                                {ss === 'pending' && <div style={{ width: 17, height: 17, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} />}
                                {ss === 'failed'  && <div style={{ width: 17, height: 17, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><XCircle size={11} color="#ef4444" /></div>}
                              </div>
                              <span style={{ fontSize: 11.5, color: ss === 'done' ? '#64748b' : ss === 'active' ? '#e2e8f0' : ss === 'failed' ? '#f87171' : '#1f2937', fontWeight: ss === 'active' ? 500 : 400 }}>{step}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Metrics */}
                    {nodeLogs.length > 0 && (
                      <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Zap size={10} /> Execution Metrics
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <div style={{ flex: 1, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 7, padding: '8px 10px' }}>
                            <div style={{ fontSize: 8.5, color: '#374151', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Latency</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#a5b4fc' }}>{nodeLogs[0].latency_ms}<span style={{ fontSize: 9, color: '#374151' }}>ms</span></div>
                          </div>
                          {nodeLogs[0].token_usage > 0 && (
                            <div style={{ flex: 1, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 7, padding: '8px 10px' }}>
                              <div style={{ fontSize: 8.5, color: '#374151', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Tokens</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#6ee7b7' }}>{nodeLogs[0].token_usage}</div>
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: '#1f2937', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Input Context</div>
                          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, marginBottom: 8 }}>{nodeLogs[0].input_summary}</div>
                          <div style={{ fontSize: 9, color: '#1f2937', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Output</div>
                          <div style={{ fontSize: 11, color: '#a5b4fc', lineHeight: 1.5 }}>{nodeLogs[0].output_summary}</div>
                        </div>
                      </div>
                    )}

                    {/* Human action alerts */}
                    {nd.id === 'human_approval' && currentJob?.status === 'pending_approval' && (
                      <div style={{ padding: 11, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>Recruiter review required. Visit the <strong>Roles</strong> tab to approve the generated JD.</span>
                      </div>
                    )}
                    {nd.id === 'human_review' && getStatus('human_review') === 'waiting_approval' && (
                      <div style={{ padding: 11, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>Shortlist validation required. Go to <strong>Candidates</strong> to review scores.</span>
                      </div>
                    )}
                    {nd.id === 'interviewing' && isStuckInterview && (
                      <div style={{ padding: 11, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <AlertCircle size={13} color="#f87171" />
                          <span style={{ fontSize: 11, color: '#f87171' }}>Interview simulation stuck or failed.</span>
                        </div>
                        <button onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%', background: '#ef4444', padding: '7px 0', borderRadius: 16, border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: retryMutation.isPending ? 'not-allowed' : 'pointer' }}>
                          {retryMutation.isPending ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                          Retry Simulation
                        </button>
                      </div>
                    )}

                    {/* In/Out edges */}
                    <div>
                      {inEdges.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Incoming Edges</div>
                          {inEdges.map((e, i) => {
                            const n = NODES.find(x => x.id === e.from)
                            const typeColors: Record<string, string> = { forward: '#10b981', branch_yes: '#10b981', branch_no: '#f59e0b', loop: '#f97316', feedback: '#ec4899' }
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, marginBottom: 3 }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: typeColors[e.type], flexShrink: 0 }} />
                                <span style={{ fontSize: 10.5, color: '#475569', flex: 1 }}>{n?.shortTitle || e.from}</span>
                                <span style={{ fontSize: 9, color: typeColors[e.type], fontWeight: 600 }}>{e.type.replace('_', ' ')}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {outEdges.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Outgoing Edges</div>
                          {outEdges.map((e, i) => {
                            const n = NODES.find(x => x.id === e.to)
                            const typeColors: Record<string, string> = { forward: '#10b981', branch_yes: '#10b981', branch_no: '#f59e0b', loop: '#f97316', feedback: '#ec4899' }
                            return (
                              <div key={i} onClick={() => { const t = NODES.find(x => x.id === e.to); if (t) setSelectedNode(t) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, marginBottom: 3, cursor: 'pointer' }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: typeColors[e.type], flexShrink: 0 }} />
                                <span style={{ fontSize: 10.5, color: '#64748b', flex: 1 }}>{n?.shortTitle || e.to}</span>
                                {e.label && <span style={{ fontSize: 8.5, color: typeColors[e.type], fontWeight: 600 }}>{e.label}</span>}
                                <ChevronRight size={10} color="#1f2937" />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Legend bar */}
            <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.005)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18, fontSize: 10.5, color: '#374151', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#1f2937' }}>Node State</span>
              {[
                { color: '#10b981', label: 'Completed' },
                { color: '#6366f1', label: 'Running' },
                { color: '#f59e0b', label: 'Awaiting Approval' },
                { color: '#ef4444', label: 'Failed' },
                { color: 'rgba(255,255,255,0.1)', label: 'Pending' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  <span>{l.label}</span>
                </div>
              ))}
              <span style={{ color: '#1f2937', marginLeft: 4 }}>|</span>
              <span style={{ fontWeight: 700, color: '#1f2937' }}>Edges</span>
              {[
                { color: '#10b981', dash: 'none',    label: 'Forward' },
                { color: '#f59e0b', dash: '4px 3px', label: 'Branch' },
                { color: '#f97316', dash: '5px 3px', label: 'Loop' },
                { color: '#ec4899', dash: '7px 3px', label: 'Feedback' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width={20} height={8}>
                    <line x1={1} y1={4} x2={19} y2={4} stroke={l.color} strokeWidth={1.5}
                      strokeDasharray={l.dash === 'none' ? undefined : l.dash} />
                  </svg>
                  <span>{l.label}</span>
                </div>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: '#1f2937' }}>
                <Bot size={11} color="#818cf8" /><span>AI Agent</span>
                <span style={{ color: '#f59e0b' }}>👤</span><span>Human Step</span>
                <span>·</span>
                <span style={{ fontSize: 10 }}>Scroll/drag to navigate · Click node to inspect</span>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
      `}</style>
    </div>
  )
}
