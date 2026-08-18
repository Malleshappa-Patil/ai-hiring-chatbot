import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi, jobsApi } from '@/api'
import {
  GitBranch, Activity, CheckCircle2, XCircle, AlertCircle, Loader2,
  Briefcase, RefreshCw, ClipboardList, FileText, UserCheck, Send,
  Eye, Search, Users, Video, UserPlus, AlertTriangle, ChevronRight,
  X, Zap, Brain, Bot, RotateCcw, ArrowRightLeft, Circle
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
  col: number   // 0 .. 4
  row: number   // 0 .. 3
}

interface EdgeDef {
  from: string
  to: string
  type: 'forward' | 'loop' | 'branch_yes' | 'branch_no' | 'feedback'
  label?: string
}

/* ─────────────────────────────────────────────────────────
   GRAPH LAYOUT STRATEGY (5 Columns × 4 Rows Phase Grid)
   Phase 1 (Row 0): Strategy & JD Drafting -> Approval -> Sourcing
   Phase 2 (Row 1): Wait -> Monitoring -> JD Optimisation Loop
   Phase 3 (Row 2): AI Screening -> Shortlist Review -> Interviews
   Phase 4 (Row 3): Offer Generation -> Onboarding / Renegotiation / Rejection
   ───────────────────────────────────────────────────────── */

const NODES: NodeDef[] = [
  /* Phase 1: Initiation & JD Approval (Row 0) */
  {
    id: 'supervisor', title: 'Workflow Orchestration', shortTitle: 'Supervisor',
    agentName: 'Supervisor Agent', agentType: 'ai', icon: Brain, col: 0, row: 0,
    description: 'Orchestrates the recruitment pipeline, routes tasks & manages session state.',
    subSteps: ['Parse hiring goal & parameters', 'Initialise workflow session', 'Delegate to Planning Agent'],
  },
  {
    id: 'planning', title: 'Recruitment Planning', shortTitle: 'Planning',
    agentName: 'Planning Agent', agentType: 'ai', icon: ClipboardList, col: 1, row: 0,
    description: 'Converts recruiting goals into pipeline milestones & target timelines.',
    subSteps: ['Analyse job requirements & timeline', 'Formulate stage sequence & targets', 'Save plan to memory'],
  },
  {
    id: 'jd_generation', title: 'JD Drafting', shortTitle: 'JD Drafting',
    agentName: 'JD Agent', agentType: 'ai', icon: FileText, col: 2, row: 0,
    description: 'Generates AI-optimised Job Descriptions using LLM chain & skills DB lookup.',
    subSteps: ['Search skills database', 'Invoke generative LLM chain', 'Parse draft into sections'],
  },
  {
    id: 'human_approval', title: 'JD Review & Approval', shortTitle: 'JD Approval',
    agentName: 'Human Recruiter', agentType: 'human', icon: UserCheck, col: 3, row: 0,
    description: 'Recruiter reviews the JD draft. On rejection, JD Agent is re-invoked with feedback.',
    subSteps: ['Notify manager of JD draft', 'Capture edits / feedback', 'Unlock sourcing upon approval'],
  },
  {
    id: 'sourcing', title: 'Job Posting & Sourcing', shortTitle: 'Sourcing',
    agentName: 'Sourcing Agent', agentType: 'ai', icon: Send, col: 4, row: 0,
    description: 'Publishes approved JD to job boards and company portal.',
    subSteps: ['Generate board metadata', 'Submit listings to job board APIs', 'Save initial profile records'],
  },

  /* Phase 2: Sourcing, Monitoring & Loop (Row 1) */
  {
    id: 'wait_primary', title: 'Wait Open Days', shortTitle: 'Wait (Open Days)',
    agentName: 'Scheduler', agentType: 'ai', icon: RotateCcw, col: 4, row: 1,
    description: 'System waits for applications to accumulate before evaluating threshold.',
    subSteps: ['Hold pipeline for open window', 'Monitor application stream passively'],
  },
  {
    id: 'monitoring', title: 'Application Volume Check', shortTitle: 'Monitoring',
    agentName: 'Monitoring Agent', agentType: 'ai', icon: Eye, col: 3, row: 1,
    description: 'Checks if applications ≥ threshold (10). If below threshold, triggers JD optimisation loop.',
    subSteps: ['Track applicant counts vs. target', 'Analyse velocity trends', 'Decide: threshold reached or loop'],
  },
  {
    id: 'jd_optimization', title: 'JD Optimisation', shortTitle: 'JD Optimise',
    agentName: 'JD Optimisation Agent', agentType: 'ai', icon: ArrowRightLeft, col: 2, row: 1,
    description: 'Improves JD with keywords & market benchmark data when volume is low.',
    subSteps: ['Analyse low-response patterns', 'Add SEO keywords', 'Benchmark against market JDs'],
  },
  {
    id: 'repost', title: 'Repost Updated JD', shortTitle: 'Repost JD',
    agentName: 'Sourcing Agent', agentType: 'ai', icon: Send, col: 1, row: 1,
    description: 'Re-publishes optimised JD across all job boards after each cycle.',
    subSteps: ['Push updated JD to all boards', 'Reset collection window'],
  },
  {
    id: 'wait_loop', title: 'Wait 48h (Loop)', shortTitle: 'Wait (48h)',
    agentName: 'Scheduler', agentType: 'ai', icon: RotateCcw, col: 0, row: 1,
    description: 'After reposting, system waits 48 hours before re-evaluating volume.',
    subSteps: ['Hold 48 hours for new applications', 'Trigger monitoring check again'],
  },

  /* Phase 3: AI Screening & Interviews (Row 2) */
  {
    id: 'screening', title: 'Resume Screening', shortTitle: 'Screening',
    agentName: 'Screening Agent', agentType: 'ai', icon: Search, col: 3, row: 2,
    description: 'AI parses and scores all resumes against JD match criteria.',
    subSteps: ['Parse incoming resume PDFs', 'Calculate ATS match scores', 'Generate screening justification'],
  },
  {
    id: 'human_review', title: 'Shortlist Validation', shortTitle: 'Shortlist Review',
    agentName: 'Human Recruiter', agentType: 'human', icon: Users, col: 2, row: 2,
    description: 'Recruiter validates AI shortlist scores & approves candidates for interviews.',
    subSteps: ['Present AI shortlists & reasoning', 'Allow recruiter overrides', 'Trigger calendar scheduling'],
  },
  {
    id: 'interviewing', title: 'Interview Coordination', shortTitle: 'Interviews',
    agentName: 'Interview Agent', agentType: 'ai', icon: Video, col: 1, row: 2,
    description: 'Schedules technical & HR interviews, runs evaluation simulations.',
    subSteps: ['Generate meeting schedules', 'Run evaluation simulations', 'Compile feedback & scores'],
  },

  /* Phase 4: Final Selection, Offers & Onboarding (Row 3) */
  {
    id: 'candidate_selected', title: 'Offer Letter Generation', shortTitle: 'Send Offer',
    agentName: 'Offer Agent', agentType: 'ai', icon: FileText, col: 1, row: 3,
    description: 'Generates personalised offer letter & sends to candidate.',
    subSteps: ['Compose offer letter with LLM', 'Attach comp & benefits', 'Send via email service'],
  },
  {
    id: 'offer_accepted', title: 'Onboarding Initiation', shortTitle: 'Onboarding',
    agentName: 'Onboarding Agent', agentType: 'ai', icon: UserPlus, col: 0, row: 3,
    description: 'Prepares welcome package, employee record, IT accounts, and welcome kit.',
    subSteps: ['Collect verification docs', 'Create employee record', 'Trigger IT asset allocation'],
  },
  {
    id: 'renegotiation', title: 'Offer Renegotiation', shortTitle: 'Renegotiation',
    agentName: 'Renegotiation Agent', agentType: 'ai', icon: ArrowRightLeft, col: 2, row: 3,
    description: 'Negotiates salary & benefits with candidate on counter-offer.',
    subSteps: ['Initiate negotiation', 'Loop until decision', 'Route to Onboarding or Close'],
  },
  {
    id: 'rejection_email', title: 'Rejection Notification', shortTitle: 'Rejection Email',
    agentName: 'Comms Agent', agentType: 'ai', icon: XCircle, col: 3, row: 3,
    description: 'Sends personalised regret email to non-selected candidates.',
    subSteps: ['Generate regret email', 'Send via email service', 'Update candidate status'],
  },
]

/* ─── Edges (directed, typed) ────────────────────────────── */
const EDGES: EdgeDef[] = [
  // Row 0: Phase 1 Forward Pipeline
  { from: 'supervisor',       to: 'planning',           type: 'forward' },
  { from: 'planning',         to: 'jd_generation',      type: 'forward' },
  { from: 'jd_generation',    to: 'human_approval',     type: 'forward' },
  { from: 'human_approval',   to: 'jd_generation',      type: 'loop',        label: 'Rejected' },
  { from: 'human_approval',   to: 'sourcing',           type: 'branch_yes',   label: 'Approved ✓' },

  // Phase 1 -> Phase 2 Transition
  { from: 'sourcing',         to: 'wait_primary',       type: 'forward' },

  // Row 1: Phase 2 Monitoring & Loop
  { from: 'wait_primary',     to: 'monitoring',         type: 'forward' },
  { from: 'monitoring',       to: 'screening',          type: 'branch_yes',   label: '≥ Threshold ✓' },
  { from: 'monitoring',       to: 'jd_optimization',   type: 'branch_no',    label: '< Threshold ✗' },
  { from: 'jd_optimization',  to: 'repost',             type: 'loop' },
  { from: 'repost',           to: 'wait_loop',          type: 'loop' },
  { from: 'wait_loop',        to: 'monitoring',         type: 'feedback',     label: 'Re-check' },

  // Phase 2 -> Phase 3 Pipeline
  { from: 'screening',        to: 'human_review',       type: 'forward' },
  { from: 'human_review',     to: 'interviewing',       type: 'forward' },

  // Phase 3 -> Phase 4 Decisions
  { from: 'interviewing',     to: 'candidate_selected', type: 'branch_yes',   label: 'Selected ✓' },
  { from: 'interviewing',     to: 'rejection_email',    type: 'branch_no',    label: 'Rejected ✗' },
  { from: 'candidate_selected', to: 'offer_accepted',  type: 'branch_yes',   label: 'Accepted ✓' },
  { from: 'candidate_selected', to: 'renegotiation',   type: 'branch_no',    label: 'Counter ✗' },
  { from: 'renegotiation',    to: 'offer_accepted',     type: 'branch_yes',   label: 'Accepted ✓' },
  { from: 'renegotiation',    to: 'candidate_selected', type: 'feedback',     label: 'Loop back' },
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
  draft: '#7A6A5E', generating_jd: '#DC9F85', pending_approval: '#DC9F85',
  approved: '#8ab4a0', published: '#B6A596', monitoring: '#B6A596',
  screening: '#DC9F85', interviewing: '#8ab4a0', onboarding: '#B6A596', closed: '#7A6A5E',
}
const jobStatusLabel: Record<JobStatus, string> = {
  draft: 'Draft', generating_jd: 'JD Generation', pending_approval: 'Pending Approval',
  approved: 'Approved', published: 'Published', monitoring: 'Monitoring',
  screening: 'Screening', interviewing: 'Interviewing', onboarding: 'Onboarding', closed: 'Closed',
}

/* ─── Layout constants ───────────────────────────────────── */
const NW = 200    // node width
const NH = 84     // node height
const COL_W = 300 // column pitch (more breathing room)
const ROW_H = 200 // row pitch (room for edges)
const PAD_X = 80
const PAD_Y = 80

const COLS = 5
const ROWS = 4

const colX = (c: number) => PAD_X + c * COL_W
const rowY = (r: number) => PAD_Y + r * ROW_H
const CANVAS_W = COLS * COL_W + PAD_X * 2
const CANVAS_H = ROWS * ROW_H + PAD_Y * 2

/* ─── Edge colours per type ──────────────────────────────── */
function edgeStyle(type: EdgeDef['type'], fromState: StageState) {
  const active = ['completed', 'running'].includes(fromState)
  switch (type) {
    case 'forward':     return { color: active ? '#DC9F85' : 'rgba(102,71,59,0.5)', dash: 'none',      width: active ? 2   : 1.2, marker: active ? 'arr-accent' : 'arr-idle' }
    case 'branch_yes':  return { color: active ? '#8ab4a0' : 'rgba(102,71,59,0.5)', dash: 'none',      width: active ? 2   : 1.2, marker: active ? 'arr-green'  : 'arr-idle' }
    case 'branch_no':   return { color: active ? '#DC9F85' : 'rgba(102,71,59,0.4)', dash: '6 4',      width: active ? 1.5 : 1.2, marker: active ? 'arr-accent' : 'arr-idle' }
    case 'loop':        return { color: active ? '#B6A596' : 'rgba(102,71,59,0.4)', dash: '6 4',      width: active ? 1.5 : 1.2, marker: active ? 'arr-muted'  : 'arr-idle' }
    case 'feedback':    return { color: active ? '#DC9F85' : 'rgba(102,71,59,0.4)', dash: '8 4 2 4', width: active ? 1.5 : 1.2, marker: active ? 'arr-accent' : 'arr-idle' }
    default:            return { color: 'rgba(102,71,59,0.5)', dash: 'none', width: 1.2, marker: 'arr-idle' }
  }
}

/* ─── Edge path routing (orthogonal with rounded corners) ── */
function buildEdgePath(from: NodeDef, to: NodeDef, type: EdgeDef['type']): string {
  const R = 14 // corner radius

  // Special: wait_loop → monitoring (long arc above the row)
  if (from.id === 'wait_loop' && to.id === 'monitoring') {
    const x1 = colX(from.col) + NW / 2
    const y1 = rowY(from.row)
    const x2 = colX(to.col) + NW / 2
    const y2 = rowY(to.row)
    const arcY = y1 - 60
    return `M ${x1} ${y1} C ${x1} ${arcY}, ${x2} ${arcY}, ${x2} ${y2}`
  }

  // Same row — horizontal
  if (from.row === to.row) {
    const y = rowY(from.row) + NH / 2
    if (from.col < to.col) {
      return `M ${colX(from.col) + NW} ${y} L ${colX(to.col)} ${y}`
    } else {
      // Backward same-row: route below the row with U-bend
      if (Math.abs(from.col - to.col) > 1) {
        const x1 = colX(from.col) + NW / 2
        const y1 = rowY(from.row) + NH
        const x2 = colX(to.col) + NW / 2
        const belowY = y1 + 36
        return [
          `M ${x1} ${y1}`,
          `L ${x1} ${belowY - R}`,
          `Q ${x1} ${belowY} ${x1 - R} ${belowY}`,
          `L ${x2 + R} ${belowY}`,
          `Q ${x2} ${belowY} ${x2} ${belowY - R}`,
          `L ${x2} ${y1}`,
        ].join(' ')
      }
      return `M ${colX(from.col)} ${y} L ${colX(to.col) + NW} ${y}`
    }
  }

  // Same column — vertical
  if (from.col === to.col) {
    const x = colX(from.col) + NW / 2
    if (from.row < to.row) {
      return `M ${x} ${rowY(from.row) + NH} L ${x} ${rowY(to.row)}`
    } else {
      return `M ${x} ${rowY(from.row)} L ${x} ${rowY(to.row) + NH}`
    }
  }

  // Cross-row, cross-column → orthogonal L-path with rounded corner
  if (from.row < to.row) {
    const x1 = colX(from.col) + NW / 2
    const y1 = rowY(from.row) + NH
    const x2 = colX(to.col) + NW / 2
    const y2 = rowY(to.row)
    const midY = (y1 + y2) / 2
    const dx = x2 > x1 ? R : -R
    return [
      `M ${x1} ${y1}`,
      `L ${x1} ${midY - R}`,
      `Q ${x1} ${midY} ${x1 + dx} ${midY}`,
      `L ${x2 - dx} ${midY}`,
      `Q ${x2} ${midY} ${x2} ${midY + R}`,
      `L ${x2} ${y2}`,
    ].join(' ')
  } else {
    const x1 = colX(from.col) + NW / 2
    const y1 = rowY(from.row)
    const x2 = colX(to.col) + NW / 2
    const y2 = rowY(to.row) + NH
    const midY = (y1 + y2) / 2
    const dx = x2 > x1 ? R : -R
    return [
      `M ${x1} ${y1}`,
      `L ${x1} ${midY + R}`,
      `Q ${x1} ${midY} ${x1 + dx} ${midY}`,
      `L ${x2 - dx} ${midY}`,
      `Q ${x2} ${midY} ${x2} ${midY - R}`,
      `L ${x2} ${y2}`,
    ].join(' ')
  }
}

function edgeMid(from: NodeDef, to: NodeDef, _type: EdgeDef['type']): { x: number; y: number } {
  if (from.id === 'wait_loop' && to.id === 'monitoring') {
    return { x: (colX(from.col) + colX(to.col)) / 2 + NW / 2, y: rowY(from.row) - 60 }
  }

  // Same row
  if (from.row === to.row) {
    const y = rowY(from.row) + NH / 2
    if (from.col < to.col) {
      return { x: (colX(from.col) + NW + colX(to.col)) / 2, y }
    } else {
      if (Math.abs(from.col - to.col) > 1) {
        // U-bend below: label at bottom of the arc
        return { x: (colX(from.col) + colX(to.col) + NW) / 2, y: rowY(from.row) + NH + 36 }
      }
      return { x: (colX(from.col) + colX(to.col) + NW) / 2, y }
    }
  }

  // Same column
  if (from.col === to.col) {
    const x = colX(from.col) + NW / 2
    if (from.row < to.row) {
      return { x, y: (rowY(from.row) + NH + rowY(to.row)) / 2 }
    } else {
      return { x, y: (rowY(from.row) + rowY(to.row) + NH) / 2 }
    }
  }

  // Cross-row diagonal: midpoint at the bend
  if (from.row < to.row) {
    const midY = (rowY(from.row) + NH + rowY(to.row)) / 2
    return { x: (colX(from.col) + colX(to.col)) / 2 + NW / 2, y: midY }
  } else {
    const midY = (rowY(from.row) + rowY(to.row) + NH) / 2
    return { x: (colX(from.col) + colX(to.col)) / 2 + NW / 2, y: midY }
  }
}

function stateColors(state: StageState) {
  switch (state) {
    case 'completed':        return { stroke: '#8ab4a0', bg: 'rgba(107,158,126,0.1)',  border: 'rgba(107,158,126,0.4)', text: '#8ab4a0', badge: 'Completed'        }
    case 'running':          return { stroke: '#DC9F85', bg: 'rgba(220,159,133,0.12)', border: '#DC9F85',             text: '#DC9F85', badge: 'Running'          }
    case 'waiting_approval': return { stroke: '#DC9F85', bg: 'rgba(220,159,133,0.1)',  border: 'rgba(220,159,133,0.4)',text: '#EBDCC4', badge: 'Awaiting Approval' }
    case 'failed':           return { stroke: '#B6A596', bg: 'rgba(182,165,150,0.08)', border: '#66473B',             text: '#B6A596', badge: 'Failed'            }
    default:                 return { stroke: '#7A6A5E', bg: '#1E1A18',               border: '#35211A',             text: '#7A6A5E', badge: 'Pending'           }
  }
}

/* ─── Component ──────────────────────────────────────────── */
export default function WorkflowMonitor() {
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [dashOffset, setDashOffset] = useState(0)
  const [zoom, setZoom] = useState(0.72)
  const [pan, setPan] = useState({ x: 10, y: 10 })
  const [hasFit, setHasFit] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [activeTab, setActiveTab] = useState<'graph' | 'logs'>('graph')
  const [logSearch, setLogSearch] = useState('')
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'failure'>('all')
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: jobs } = useQuery({ queryKey: ['jobs'], queryFn: () => jobsApi.list({ page_size: 50 }) })

  useEffect(() => {
    if (jobs?.items?.length && !selectedJobId) setSelectedJobId(jobs.items[0].id)
  }, [jobs, selectedJobId])

  const { data: workflowState, isError: workflowError } = useQuery({
    queryKey: ['workflow-status', selectedJobId],
    queryFn: () => workflowApi.status(selectedJobId),
    enabled: !!selectedJobId,
    refetchInterval: 5000,
    retry: false,
  })

  const { data: logs } = useQuery<AgentLog[]>({
    queryKey: ['workflow-logs', selectedJobId],
    queryFn: () => workflowApi.logs(selectedJobId),
    enabled: !!selectedJobId,
    refetchInterval: 5000,
    retry: false,
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

  useEffect(() => {
    const id = setInterval(() => setDashOffset(v => (v - 1) % 24), 50)
    return () => clearInterval(id)
  }, [])

  /* Auto-fit graph to viewport on first job selection */
  useEffect(() => {
    if (!canvasRef.current || !selectedJobId) return
    // Small delay so DOM layout settles
    const timer = setTimeout(() => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const scaleX = rect.width / CANVAS_W
      const scaleY = rect.height / CANVAS_H
      const fitZoom = Math.min(scaleX, scaleY) * 0.90
      setZoom(fitZoom)
      setPan({
        x: (rect.width - CANVAS_W * fitZoom) / 2,
        y: (rect.height - CANVAS_H * fitZoom) / 2,
      })
      setHasFit(true)
    }, 80)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, hasFit])

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => {
      const next = Math.min(2.5, Math.max(0.3, z * delta))
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
  const openDays = currentJob?.application_open_days ?? workflowState?.state_data?.application_open_days ?? 7

  const mappedNodes = NODES.map((node, index) => {
    const stepNum = index + 1
    if (node.id === 'wait_primary') {
      return {
        ...node,
        stepNum,
        title: `Wait ${openDays} Days`,
        shortTitle: `Wait (${openDays}d)`,
        description: `System waits ${openDays} days for applications to accumulate before evaluating threshold.`,
        subSteps: [`Hold pipeline for ${openDays} days`, 'Monitor application stream passively']
      }
    }
    return { ...node, stepNum }
  })

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
    const s = getStatus(id)
    if (s !== 'idle') return s

    const idx = STAGE_ORDER.indexOf(id)
    if (idx !== -1) {
      for (let i = idx + 1; i < STAGE_ORDER.length; i++) {
        const nextId = STAGE_ORDER[i]
        const nextStatus = getStatus(nextId)
        if (['completed', 'running', 'waiting_approval', 'failed'].includes(nextStatus)) {
          return 'completed'
        }
      }
    }
    return 'idle'
  }

  const LOG_NAME_MAP: Record<string, string> = {
    'Supervisor Agent': 'supervisor',
    'Planning Agent': 'planning',
    'JD Agent': 'jd_generation',
    'Sourcing Agent': 'sourcing',
    'Monitoring Agent': 'monitoring',
    'Resume Screening Agent': 'screening',
    'Interview Agent': 'interviewing',
    'Onboarding Agent': 'offer_accepted',
    'JD Optimisation Agent': 'jd_optimization',
    'Renegotiation Agent': 'renegotiation',
    'Comms Agent': 'rejection_email',
    'Offer Agent': 'candidate_selected',
  }

  const getLogs = (id: string): AgentLog[] => {
    if (!logs) return []
    if (id === 'human_approval') return []
    if (id === 'human_review') {
      return logs.filter(l =>
        (l.agent_name === 'Supervisor Agent' && l.action === 'human_review_completed') ||
        l.action.includes('human_review')
      )
    }
    const agentName = Object.entries(LOG_NAME_MAP).find(([, nodeId]) => nodeId === id)?.[0]
    if (!agentName) return []
    return logs.filter(l => l.agent_name === agentName)
  }

  const getSubStep = (state: StageState, nodeLogs: AgentLog[], idx: number) => {
    if (state === 'completed') return 'done'
    if (state === 'idle') return 'pending'
    if (state === 'failed') return idx === 0 ? 'done' : idx === 1 ? 'failed' : 'pending'
    if (state === 'running') return idx === 0 ? 'done' : idx === 1 ? 'active' : 'pending'
    if (state === 'waiting_approval') return idx === 0 ? 'done' : 'active'
    return 'pending'
  }

  const completedCount = mappedNodes.filter(n => getState(n.id) === 'completed').length
  const progress = mappedNodes.length ? Math.round((completedCount / mappedNodes.length) * 100) : 0
  const isStuckInterview = workflowState?.current_stage === 'interviewing' && workflowState?.agent_statuses?.['interview'] === 'running'

  const allLogs: AgentLog[] = logs ? [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []

  const filteredLogs = allLogs.filter(l => {
    if (logFilter !== 'all' && l.status !== logFilter) return false
    if (logSearch) {
      const q = logSearch.toLowerCase()
      const matchAgent = l.agent_name?.toLowerCase().includes(q)
      const matchAction = l.action?.toLowerCase().includes(q)
      const matchInput = l.input_summary?.toLowerCase().includes(q)
      const matchOutput = l.output_summary?.toLowerCase().includes(q)
      const matchMsg = (l as any).message?.toLowerCase().includes(q)
      return matchAgent || matchAction || matchInput || matchOutput || matchMsg
    }
    return true
  })

  const formatTs = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch { return ts }
  }

  const EDGE_LEGEND = [
    { color: '#DC9F85', dash: 'none',     label: 'Forward flow' },
    { color: '#8ab4a0', dash: 'none',     label: 'Conditional branch' },
    { color: '#B6A596', dash: '6px 4px',  label: 'Optimisation loop' },
    { color: '#DC9F85', dash: '8px 4px',  label: 'Feedback / re-check' },
  ]

  const PHASES = [
    { row: 0, title: 'PHASE 1 — STRATEGY & JD APPROVAL' },
    { row: 1, title: 'PHASE 2 — SOURCING & MONITORING LOOP' },
    { row: 2, title: 'PHASE 3 — AI SCREENING & INTERVIEWS' },
    { row: 3, title: 'PHASE 4 — SELECTION, OFFERS & ONBOARDING' },
  ]

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', overflow: 'hidden', background: '#181818', fontFamily: "'General Sans','Inter',sans-serif", color: '#EBDCC4' }}>

      {/* ── LEFT SIDEBAR ───────────────────────────────── */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #35211A', display: 'flex', flexDirection: 'column', background: '#1E1A18' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #35211A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <GitBranch size={16} color="#DC9F85" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#EBDCC4', fontFamily: "'Clash Grotesk',sans-serif" }}>Workflow Monitor</span>
          </div>
          <p style={{ fontSize: 11, color: '#7A6A5E' }}>Multi-agent execution graph</p>
        </div>

        {workflowState && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #35211A' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(220,159,133,0.1)', padding: '4px 10px', borderRadius: 4, border: '1px solid #66473B' }}>
              <span style={{ background: '#DC9F85', width: 6, height: 6, borderRadius: '50%' }} />
              <span style={{ fontSize: 10, color: '#DC9F85', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live · updates 5s</span>
            </div>
          </div>
        )}

        {/* Edge Types Legend */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #35211A' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#7A6A5E', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Edge Types</div>
          {EDGE_LEGEND.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <svg width={26} height={10} style={{ flexShrink: 0 }}>
                <line x1={2} y1={5} x2={24} y2={5} stroke={l.color} strokeWidth={1.8}
                  strokeDasharray={l.dash === 'none' ? undefined : l.dash} />
              </svg>
              <span style={{ fontSize: 11, color: '#B6A596' }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Active Roles */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#7A6A5E', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '0 4px', marginBottom: 8 }}>
            Active Roles ({jobs?.items?.length || 0})
          </div>
          {!jobs?.items?.length ? (
            <div style={{ textAlign: 'center', padding: '36px 10px', color: '#7A6A5E' }}>
              <Briefcase size={26} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.2 }} />
              <span style={{ fontSize: 12 }}>No jobs found</span>
            </div>
          ) : jobs.items.map(j => {
            const isSel = j.id === selectedJobId
            return (
              <div key={j.id} onClick={() => { setSelectedJobId(j.id); setSelectedNode(null) }}
                style={{
                  padding: '11px 12px', borderRadius: 4, marginBottom: 6, cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: isSel ? 'rgba(220,159,133,0.08)' : '#221D1A',
                  border: `1px solid ${isSel ? '#66473B' : '#35211A'}`,
                }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.borderColor = '#66473B' }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.borderColor = '#35211A' }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: isSel ? '#EBDCC4' : '#B6A596', marginBottom: 2 }}>{j.title}</div>
                <div style={{ fontSize: 11, color: '#7A6A5E', marginBottom: 6 }}>{j.department} · {j.location}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: jobStatusColor[j.status] || '#7A6A5E' }} />
                  <span style={{ fontSize: 10, color: '#7A6A5E', fontWeight: 600 }}>{jobStatusLabel[j.status] || j.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── MAIN GRAPH AREA ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {!selectedJobId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#7A6A5E' }}>
            <Activity size={44} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: '#B6A596' }}>Select a job to view its workflow graph</p>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #35211A', background: '#1E1A18', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 9, color: '#7A6A5E', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.14em' }}>
                  Multi-Agent Workflow Graph · {currentJob?.title}
                </div>
                {currentJob?.hiring_goal && (
                  <div style={{ fontSize: 11, color: '#B6A596', marginTop: 2 }}>
                    Goal: <span style={{ color: '#EBDCC4', fontStyle: 'italic' }}>"{currentJob.hiring_goal}"</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Tab toggles */}
                <div style={{ display: 'flex', background: '#221D1A', borderRadius: 4, border: '1px solid #66473B', overflow: 'hidden' }}>
                  {(['graph', 'logs'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      style={{
                        padding: '6px 12px', background: activeTab === tab ? '#DC9F85' : 'transparent',
                        border: 'none', color: activeTab === tab ? '#181818' : '#B6A596',
                        fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase',
                        letterSpacing: '0.08em', transition: 'all 0.15s',
                        fontFamily: "'General Sans','Inter',sans-serif",
                      }}>
                      {tab === 'logs' ? `📋 Exec Logs${allLogs.length > 0 ? ` (${allLogs.length})` : ''}` : '🗺 Node Graph'}
                    </button>
                  ))}
                </div>

                {/* Pipeline Progress */}
                <div>
                  <div style={{ fontSize: 9, color: '#7A6A5E', marginBottom: 3, textAlign: 'right', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pipeline Progress</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 120, height: 4, background: '#35211A', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: '#DC9F85', borderRadius: 2, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#EBDCC4', fontFamily: "'Clash Grotesk',sans-serif" }}>{progress}%</span>
                  </div>
                </div>

                {workflowState ? (() => {
                  const cs = workflowState.current_stage
                  const label = cs === 'completed' ? 'Completed' : cs === 'failed' ? 'Failed' : `Active: ${cs.replace(/_/g, ' ')}`
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(107,158,126,0.1)', borderRadius: 4, border: '1px solid rgba(107,158,126,0.3)' }}>
                      <span className="pulse-dot" style={{ background: '#8ab4a0', width: 6, height: 6 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#8ab4a0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
                    </div>
                  )
                })() : workflowError ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(182,165,150,0.08)', borderRadius: 4, border: '1px solid #35211A' }}>
                    <AlertTriangle size={11} color="#7A6A5E" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#7A6A5E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Workflow Pending</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Canvas + Detail panel OR Execution Log Timeline */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

              {activeTab === 'logs' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#181818', padding: '20px' }}>
                  {/* Filter bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: 400, background: '#1E1A18', border: '1px solid #66473B', borderRadius: 4, padding: '6px 12px' }}>
                      <Search size={14} color="#7A6A5E" />
                      <input
                        type="text"
                        placeholder="Filter logs by agent, action, or payload..."
                        value={logSearch}
                        onChange={e => setLogSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#EBDCC4', fontSize: '12px', outline: 'none', width: '100%', fontFamily: "'General Sans', sans-serif" }}
                      />
                      {logSearch && (
                        <button onClick={() => setLogSearch('')} style={{ background: 'none', border: 'none', color: '#7A6A5E', cursor: 'pointer', padding: 0 }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#7A6A5E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status:</div>
                      {(['all', 'success', 'failure'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => setLogFilter(st)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            background: logFilter === st ? '#DC9F85' : '#221D1A',
                            color: logFilter === st ? '#181818' : '#B6A596',
                            border: logFilter === st ? 'none' : '1px solid #35211A',
                            transition: 'all 0.15s',
                            fontFamily: "'General Sans', sans-serif",
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Log list */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                    {filteredLogs.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#7A6A5E', padding: '40px' }}>
                        <ClipboardList size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                        <p style={{ fontSize: 13, color: '#B6A596', margin: 0 }}>
                          {allLogs.length === 0 ? 'No execution logs recorded yet for this workflow.' : 'No logs match your filter criteria.'}
                        </p>
                      </div>
                    ) : (
                      filteredLogs.map(log => {
                        const isSuccess = log.status === 'success' || !log.status
                        return (
                          <div key={log.id} style={{ background: '#1E1A18', border: `1px solid ${isSuccess ? '#35211A' : 'rgba(176,112,112,0.3)'}`, borderRadius: 4, padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC9F85', background: 'rgba(220,159,133,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid #66473B' }}>
                                  🤖 {log.agent_name || 'Agent'}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#EBDCC4' }}>
                                  {log.action}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {log.latency_ms > 0 && (
                                  <span style={{ fontSize: '10px', color: '#7A6A5E' }}>
                                    ⚡ {log.latency_ms}ms
                                  </span>
                                )}
                                {log.token_usage > 0 && (
                                  <span style={{ fontSize: '10px', color: '#7A6A5E' }}>
                                    🪙 {log.token_usage} tokens
                                  </span>
                                )}
                                <span style={{
                                  fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em',
                                  background: isSuccess ? 'rgba(138,180,160,0.1)' : 'rgba(176,112,112,0.1)',
                                  color: isSuccess ? '#8ab4a0' : '#b07070',
                                  border: `1px solid ${isSuccess ? 'rgba(138,180,160,0.3)' : 'rgba(176,112,112,0.3)'}`
                                }}>
                                  {isSuccess ? 'SUCCESS' : 'FAILURE'}
                                </span>
                                <span style={{ fontSize: '11px', color: '#7A6A5E' }}>
                                  {formatTs(log.created_at)}
                                </span>
                              </div>
                            </div>

                            {/* Payload details if present */}
                            {(log.input_summary || log.output_summary || (log as any).message) && (
                              <div style={{ display: 'grid', gridTemplateColumns: (log.input_summary && (log.output_summary || (log as any).message)) ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '10px' }}>
                                {log.input_summary && (
                                  <div style={{ background: '#221D1A', border: '1px solid #35211A', padding: '8px 12px', borderRadius: 4 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#7A6A5E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Input Summary</div>
                                    <div style={{ fontSize: 11, color: '#B6A596', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                                      {log.input_summary}
                                    </div>
                                  </div>
                                )}
                                {(log.output_summary || (log as any).message) && (
                                  <div style={{ background: '#221D1A', border: '1px solid #35211A', padding: '8px 12px', borderRadius: 4 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#7A6A5E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Output / Message</div>
                                    <div style={{ fontSize: 11, color: '#EBDCC4', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                                      {log.output_summary || (log as any).message}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* SVG Canvas */}
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
                {/* Transformed Graph World */}
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
                      <marker id="arr-accent" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
                        <path d="M0,0 L0,7 L8,3.5 z" fill="#DC9F85" />
                      </marker>
                      <marker id="arr-green" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
                        <path d="M0,0 L0,7 L8,3.5 z" fill="#8ab4a0" />
                      </marker>
                      <marker id="arr-muted" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
                        <path d="M0,0 L0,7 L8,3.5 z" fill="#B6A596" />
                      </marker>
                      <marker id="arr-idle" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
                        <path d="M0,0 L0,7 L8,3.5 z" fill="#66473B" />
                      </marker>
                    </defs>

                    {/* Subtle dot grid */}
                    {Array.from({ length: Math.ceil(CANVAS_H / 36) }, (_, ri) =>
                      Array.from({ length: Math.ceil(CANVAS_W / 36) }, (_, ci) => (
                        <circle key={`d${ri}-${ci}`} cx={ci * 36 + 18} cy={ri * 36 + 18} r={0.6} fill="#2A2320" />
                      ))
                    )}

                    {/* ── Phase Swimlane Bands ──────────────────── */}
                    {PHASES.map(p => {
                      const bandY = rowY(p.row) - 30
                      const bandH = ROW_H + 10
                      return (
                        <g key={p.title}>
                          {/* Full-width tinted band */}
                          <rect x={0} y={bandY} width={CANVAS_W} height={bandH} rx={0}
                            fill={p.row % 2 === 0 ? 'rgba(235,220,196,0.018)' : 'rgba(220,159,133,0.012)'} />
                          {/* Top separator line */}
                          <line x1={PAD_X - 30} y1={bandY} x2={CANVAS_W - PAD_X + 30} y2={bandY}
                            stroke="#35211A" strokeWidth={0.8} />
                          {/* Phase label — top left of band */}
                          <text x={PAD_X - 20} y={bandY + 16} fontSize={9.5} fill="#7A6A5E" fontWeight="700"
                            fontFamily="General Sans,sans-serif" letterSpacing="1.5" opacity={0.85}>
                            {p.title}
                          </text>
                        </g>
                      )
                    })}

                    {/* ── EDGES ──────────────────────────────────── */}
                    {EDGES.map((edge, ei) => {
                      const fromNode = mappedNodes.find(n => n.id === edge.from)
                      const toNode = mappedNodes.find(n => n.id === edge.to)
                      if (!fromNode || !toNode) return null
                      const fromState = getState(edge.from)
                      const es = edgeStyle(edge.type, fromState)
                      const isActive = ['completed', 'running'].includes(fromState)
                      const d = buildEdgePath(fromNode, toNode, edge.type)
                      const mid = edgeMid(fromNode, toNode, edge.type)

                      return (
                        <g key={`e-${ei}`}>
                          <path d={d} fill="none"
                            stroke={es.color}
                            strokeWidth={es.width}
                            strokeDasharray={es.dash === 'none' ? undefined : es.dash}
                            strokeDashoffset={isActive ? dashOffset : 0}
                            markerEnd={`url(#${es.marker})`}
                            opacity={isActive ? 0.95 : 0.45}
                          />
                          {edge.label && (
                            <g>
                              <rect
                                x={mid.x - 42} y={mid.y - 10}
                                width={84} height={20} rx={4}
                                fill="#1E1A18"
                                stroke="#66473B"
                                strokeWidth={0.8}
                              />
                              <text x={mid.x} y={mid.y + 3} textAnchor="middle"
                                fontSize={9} fill="#EBDCC4" fontWeight="600"
                                fontFamily="General Sans,sans-serif">
                                {edge.label}
                              </text>
                            </g>
                          )}
                        </g>
                      )
                    })}

                    {/* ── NODES ──────────────────────────────────── */}
                    {mappedNodes.map(node => {
                      const state = getState(node.id)
                      const c = stateColors(state)
                      const isSel = selectedNode?.id === node.id
                      const isHov = hoveredNodeId === node.id
                      const nx = colX(node.col)
                      const ny = rowY(node.row)
                      const typeIsHuman = node.agentType === 'human'
                      const isRunning = state === 'running'

                      return (
                        <g key={node.id}
                          transform={`translate(${nx},${ny})`}
                          onClick={() => setSelectedNode(p => p?.id === node.id ? null : node)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Animated dashed glow for running nodes */}
                          {isRunning && (
                            <rect x={-5} y={-5} width={NW + 10} height={NH + 10} rx={9}
                              fill="none" stroke="#DC9F85" strokeWidth={1.2} opacity={0.35}
                              strokeDasharray="6 4" strokeDashoffset={dashOffset} />
                          )}

                          {/* Selection outline */}
                          {isSel && (
                            <rect x={-3} y={-3} width={NW + 6} height={NH + 6} rx={8} fill="none"
                              stroke="#DC9F85" strokeWidth={2} opacity={0.8} />
                          )}

                          {/* Node background */}
                          <rect x={0} y={0} width={NW} height={NH} rx={6}
                            fill={isSel ? '#252018' : isHov ? '#241F1B' : '#1E1A18'}
                            stroke={isSel ? '#DC9F85' : isHov ? '#66473B' : c.border}
                            strokeWidth={isSel ? 1.5 : 1}
                          />

                          {/* Left accent bar */}
                          <rect x={1} y={8} width={3} height={NH - 16} rx={1.5}
                            fill={c.stroke} opacity={state === 'idle' ? 0.25 : 1} />

                          {/* Step number circle */}
                          <circle cx={24} cy={18} r={11} fill="rgba(235,220,196,0.05)" stroke={c.border} strokeWidth={0.7} />
                          <text x={24} y={22} textAnchor="middle" fontSize={9.5} fontWeight="700"
                            fill={state === 'idle' ? '#5A4E44' : '#EBDCC4'} fontFamily="General Sans,sans-serif">
                            {node.stepNum}
                          </text>

                          {/* Agent type pill */}
                          <rect x={NW - 50} y={9} width={40} height={18} rx={9}
                            fill={typeIsHuman ? 'rgba(182,165,150,0.1)' : 'rgba(220,159,133,0.08)'}
                            stroke={typeIsHuman ? 'rgba(182,165,150,0.25)' : 'rgba(102,71,59,0.6)'} strokeWidth={0.6} />
                          <text x={NW - 30} y={21} textAnchor="middle" fontSize={7.5}
                            fill={typeIsHuman ? '#B6A596' : '#DC9F85'} fontWeight="700"
                            fontFamily="General Sans,sans-serif" letterSpacing="0.6">
                            {typeIsHuman ? 'HUMAN' : 'AI'}
                          </text>

                          {/* Title */}
                          <text x={14} y={NH / 2 + 2} fontSize={12.5} fontWeight="700"
                            fill={state === 'idle' ? '#7A6A5E' : '#EBDCC4'}
                            fontFamily="'Clash Grotesk','General Sans',sans-serif">{node.shortTitle}</text>

                          {/* Agent name */}
                          <text x={14} y={NH / 2 + 16} fontSize={10} fill={state === 'idle' ? '#5A4E44' : '#B6A596'}
                            fontFamily="General Sans,sans-serif">{node.agentName}</text>

                          {/* Status dot + badge */}
                          <circle cx={18} cy={NH - 13} r={3.5}
                            fill={c.stroke} opacity={state === 'idle' ? 0.25 : 1} />
                          <text x={26} y={NH - 9.5} fontSize={9.5} fill={c.text} fontWeight="600"
                            fontFamily="General Sans,sans-serif">{c.badge}</text>
                        </g>
                      )
                    })}
                  </svg>
                </div>

                {/* Controls overlay */}
                <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
                  <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))}
                    style={{ width: 28, height: 28, borderRadius: 4, background: '#1E1A18', border: '1px solid #66473B', color: '#EBDCC4', cursor: 'pointer', fontWeight: 700 }}>+</button>
                  <button onClick={() => setZoom(z => Math.max(0.3, z * 0.85))}
                    style={{ width: 28, height: 28, borderRadius: 4, background: '#1E1A18', border: '1px solid #66473B', color: '#EBDCC4', cursor: 'pointer', fontWeight: 700 }}>-</button>
                  <button onClick={() => { setHasFit(false) }}
                    style={{ width: 28, height: 28, borderRadius: 4, background: '#1E1A18', border: '1px solid #66473B', color: '#EBDCC4', cursor: 'pointer', fontSize: 11 }} title="Fit to view">⟲</button>
                </div>
              </div>

              {/* ── RIGHT DETAIL PANEL (When a node is selected) ──────── */}
              {selectedNode && (
                <div style={{
                  width: 320, flexShrink: 0, borderLeft: '1px solid #35211A',
                  background: '#1E1A18', padding: '20px', overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#DC9F85', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        NODE {selectedNode.stepNum} DETAILS
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#EBDCC4', fontFamily: "'Clash Grotesk',sans-serif", marginTop: 2 }}>
                        {selectedNode.title}
                      </h3>
                    </div>
                    <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', color: '#7A6A5E', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7A6A5E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Agent</div>
                    <div style={{ fontSize: 13, color: '#EBDCC4', fontWeight: 600 }}>{selectedNode.agentName} ({selectedNode.agentType.toUpperCase()})</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7A6A5E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
                    <div style={{ fontSize: 12, color: '#B6A596', lineHeight: 1.6 }}>{selectedNode.description}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7A6A5E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Sub-steps</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedNode.subSteps.map((step, idx) => {
                        const st = getState(selectedNode.id)
                        const subSt = getSubStep(st, getLogs(selectedNode.id), idx)
                        return (
                          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: subSt === 'done' ? '#8ab4a0' : subSt === 'active' ? '#DC9F85' : '#7A6A5E' }}>
                            {subSt === 'done' ? <CheckCircle2 size={13} color="#8ab4a0" /> : subSt === 'active' ? <Loader2 size={13} color="#DC9F85" style={{ animation: 'spin 1s linear infinite' }} /> : <Circle size={13} color="#35211A" />}
                            <span>{step}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Logs for this node */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7A6A5E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Agent Logs</div>
                    {getLogs(selectedNode.id).length === 0 ? (
                      <div style={{ fontSize: 11, color: '#7A6A5E' }}>No execution logs recorded yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {getLogs(selectedNode.id).map(log => (
                          <div key={log.id} style={{ padding: '8px 10px', background: '#221D1A', border: '1px solid #35211A', borderRadius: 4, fontSize: 11 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7A6A5E', fontSize: 9.5, marginBottom: 2 }}>
                              <span>{log.action}</span>
                              <span>{formatTs(log.created_at)}</span>
                            </div>
                            <div style={{ color: '#B6A596' }}>{log.output_summary || (log as any).message || log.action}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </>
    )}
  </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
