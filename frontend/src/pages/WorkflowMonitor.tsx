import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi, jobsApi } from '@/api'
import {
  GitBranch,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Briefcase,
  RefreshCw,
  ClipboardList,
  FileText,
  UserCheck,
  Send,
  Eye,
  Search,
  Users,
  Video,
  UserPlus,
  AlertTriangle,
  ChevronRight,
  X,
  Zap,
  Brain,
  Bot
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
  col: number
  row: number
  connects: string[]
}

/* ─── Node / Graph Topology ──────────────────────────────── */
const NODES: NodeDef[] = [
  { id: 'supervisor', title: 'Workflow Initiation & Orchestration', shortTitle: 'Supervisor', agentName: 'Supervisor Agent', agentType: 'ai', description: 'Orchestrates the recruitment flow and delegates tasks based on hiring goals.', icon: Brain, col: 2, row: 0, connects: ['planning'], subSteps: ['Parse hiring goal and parameters', 'Initialize workflow session', 'Delegate to Planning Agent'] },
  { id: 'planning', title: 'Recruitment Planning', shortTitle: 'Planning', agentName: 'Planning Agent', agentType: 'ai', description: 'Converts recruiting goals into structured pipeline milestones.', icon: ClipboardList, col: 2, row: 1, connects: ['jd_generation'], subSteps: ['Analyze job requirements & timeline', 'Formulate stage sequence & targets', 'Save plan to short-term memory'] },
  { id: 'jd_generation', title: 'Job Description Drafting', shortTitle: 'JD Drafting', agentName: 'JD Agent', agentType: 'ai', description: 'Generates professional, AI-optimized Job Descriptions.', icon: FileText, col: 2, row: 2, connects: ['human_approval'], subSteps: ['Search skills database', 'Invoke generative LLM chain', 'Parse draft into standard sections'] },
  { id: 'human_approval', title: 'JD Review & Approval', shortTitle: 'JD Approval', agentName: 'Human Recruiter', agentType: 'human', description: 'Awaiting review and approval from recruiter before role publication.', icon: UserCheck, col: 2, row: 3, connects: ['sourcing'], subSteps: ['Notify hiring manager of JD draft', 'Capture edits / feedback', 'Unlock sourcing upon approval'] },
  { id: 'sourcing', title: 'Candidate Sourcing & Job Posting', shortTitle: 'Sourcing', agentName: 'Sourcing Agent', agentType: 'ai', description: 'Publishes approved roles to LinkedIn, Indeed, Naukri, and more.', icon: Send, col: 1, row: 4, connects: ['monitoring'], subSteps: ['Generate board-specific metadata', 'Submit listings to job board APIs', 'Save initial candidate profile records'] },
  { id: 'monitoring', title: 'Application Volume Monitoring', shortTitle: 'Monitoring', agentName: 'Monitoring Agent', agentType: 'ai', description: 'Monitors incoming traffic and triggers optimization loops if needed.', icon: Eye, col: 1, row: 5, connects: ['screening'], subSteps: ['Track applicant counts vs. target', 'Analyze application velocity trends', 'Trigger JD optimization if needed'] },
  { id: 'screening', title: 'Resume Parsing & Screening', shortTitle: 'Screening', agentName: 'Resume Screening Agent', agentType: 'ai', description: 'Evaluates candidate resumes using AI matching algorithms.', icon: Search, col: 2, row: 5, connects: ['human_review'], subSteps: ['Parse incoming resume PDFs', 'Calculate match scores', 'Generate screening justification'] },
  { id: 'human_review', title: 'Shortlist Validation', shortTitle: 'Shortlist Review', agentName: 'Human Recruiter', agentType: 'human', description: 'Recruiter verifies AI scoring and approves shortlisted candidates.', icon: Users, col: 3, row: 5, connects: ['interviewing'], subSteps: ['Present AI shortlists & reasoning', 'Allow recruiter overrides', 'Trigger calendar scheduling'] },
  { id: 'interviewing', title: 'Interview Coordination & Simulation', shortTitle: 'Interviews', agentName: 'Interview Agent', agentType: 'ai', description: 'Schedules and runs technical/HR evaluation simulations.', icon: Video, col: 2, row: 6, connects: ['onboarding'], subSteps: ['Generate meeting schedules', 'Run evaluation simulations', 'Compile feedback & scores'] },
  { id: 'onboarding', title: 'Offer Generation & Onboarding', shortTitle: 'Onboarding', agentName: 'Onboarding Agent', agentType: 'ai', description: 'Prepares welcome package, offer letters, and corporate accounts.', icon: UserPlus, col: 2, row: 7, connects: [], subSteps: ['Compose custom offer letters', 'Setup enterprise accounts', 'Disseminate IT onboarding tasks'] },
]

const STAGE_ORDER = ['supervisor','planning','jd_generation','human_approval','sourcing','monitoring','screening','human_review','interviewing','onboarding']

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
const NW = 186
const NH = 76
const COL_GAP = 230
const ROW_GAP = 116
const PAD_X = 60
const PAD_Y = 48

const colX = (c: number) => PAD_X + c * COL_GAP
const rowY = (r: number) => PAD_Y + r * ROW_GAP
const CANVAS_W = 5 * COL_GAP + PAD_X * 2
const MAX_ROW = Math.max(...NODES.map(n => n.row))
const CANVAS_H = rowY(MAX_ROW) + NH + PAD_Y * 2

function edgePath(from: NodeDef, to: NodeDef): string {
  const x1 = colX(from.col) + NW / 2
  const y1 = rowY(from.row) + NH
  const x2 = colX(to.col) + NW / 2
  const y2 = rowY(to.row)
  const cy = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`
}

function stateColors(state: StageState) {
  switch (state) {
    case 'completed':        return { stroke: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: '#10b981', text: '#10b981', badge: 'Completed',        filterId: 'glow-green'  }
    case 'running':          return { stroke: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: '#6366f1', text: '#a5b4fc', badge: 'Running',           filterId: 'glow-indigo' }
    case 'waiting_approval': return { stroke: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', text: '#f59e0b', badge: 'Awaiting Approval',  filterId: 'glow-amber'  }
    case 'failed':           return { stroke: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: '#ef4444', text: '#ef4444', badge: 'Failed',             filterId: 'glow-red'    }
    default:                 return { stroke: 'rgba(255,255,255,0.09)', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.09)', text: '#4b5563', badge: 'Pending', filterId: '' }
  }
}

/* ─── Component ──────────────────────────────────────────── */
export default function WorkflowMonitor() {
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [dashOffset, setDashOffset] = useState(0)
  const [zoom, setZoom] = useState(0.85)
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
      const next = Math.min(2.5, Math.max(0.25, z * delta))
      // Adjust pan so zoom is centred on mouse
      const scale = next / z
      setPan(p => ({
        x: mx - scale * (mx - p.x),
        y: my - scale * (my - p.y),
      }))
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
      screening: 'screening', human_review: 'human_review', interviewing: 'interview', onboarding: 'onboarding',
    }
    const raw = workflowState.agent_statuses?.[keyMap[id]] || 'idle'
    if (raw === 'threshold_reached' || raw === 'below_threshold') return 'completed'
    return raw as StageState
  }

  const getState = (id: string): StageState => {
    if (!workflowState) return 'idle'
    const cs = workflowState.current_stage
    const s = getStatus(id)
    if (['completed','failed','waiting_approval','running'].includes(s)) return s
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
      interviewing: 'Interview Agent', onboarding: 'Onboarding Agent',
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

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', overflow: 'hidden', background: '#06060f', fontFamily: 'Inter, sans-serif' }}>

      {/* ── LEFT SIDEBAR ───────────────────────────────── */}
      <div style={{ width: 272, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <GitBranch size={17} color="#6366f1" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Workflow Monitor</span>
          </div>
          <p style={{ fontSize: 11.5, color: '#475569' }}>Real-time agent graph execution</p>
        </div>

        {workflowState && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="pulse-dot" style={{ background: '#10b981', width: 6, height: 6 }} />
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>Live · updates every 5s</span>
            </div>
          </div>
        )}

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
            <div style={{ padding: '13px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: '#374151', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>
                  Graph Workflow · {currentJob?.title}
                </div>
                {currentJob?.hiring_goal && (
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    Goal: <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>"{currentJob.hiring_goal}"</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Progress */}
                <div>
                  <div style={{ fontSize: 10.5, color: '#374151', marginBottom: 4, textAlign: 'right' }}>Pipeline Progress</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 140, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
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
              </div>
            </div>

            {/* Canvas + Detail panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

              {/* SVG canvas — ONLY this area zooms/pans */}
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
                    {/* Glow filters for nodes */}
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
                    {/* Edge glow filter — wider blur applied to edge paths */}
                    <filter id="edge-glow-green" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.06  0 0 0 0 0.73  0 0 0 0 0.51  0 0 0 0.7 0" result="c" />
                      <feMerge><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="edge-glow-indigo" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.39  0 0 0 0 0.40  0 0 0 0 0.95  0 0 0 0.7 0" result="c" />
                      <feMerge><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    {/* Arrow markers — solid colors work everywhere */}
                    {[
                      { id: 'arr-done', fill: '#10b981' },
                      { id: 'arr-run',  fill: '#6366f1' },
                      { id: 'arr-idle', fill: 'rgba(255,255,255,0.18)' },
                    ].map(m => (
                      <marker key={m.id} id={m.id} markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L8,3 z" fill={m.fill} />
                      </marker>
                    ))}
                  </defs>

                  {/* Dot grid */}
                  {Array.from({ length: Math.ceil(CANVAS_H / 28) }, (_, ri) =>
                    Array.from({ length: Math.ceil(CANVAS_W / 28) }, (_, ci) => (
                      <circle key={`d${ri}-${ci}`} cx={ci * 28 + 14} cy={ri * 28 + 14} r={0.9} fill="rgba(255,255,255,0.035)" />
                    ))
                  )}

                  {/* Edges — solid colors (gradient url() silently breaks on diagonal/horizontal paths) */}
                  {NODES.flatMap(from =>
                    from.connects.map(tid => {
                      const to = NODES.find(n => n.id === tid)
                      if (!to) return null
                      const fs = getState(from.id)
                      const isDone = fs === 'completed'
                      const isRun = fs === 'running'
                      const edgeColor = isDone ? '#10b981' : isRun ? '#6366f1' : 'rgba(255,255,255,0.13)'
                      return (
                        <g key={`e-${from.id}-${tid}`}>
                          {/* Blurred glow underneath — works on any path direction */}
                          {(isDone || isRun) && (
                            <path
                              d={edgePath(from, to)}
                              fill="none"
                              stroke={isDone ? '#10b981' : '#6366f1'}
                              strokeWidth={8}
                              opacity={0.2}
                              filter={isDone ? 'url(#edge-glow-green)' : 'url(#edge-glow-indigo)'}
                            />
                          )}
                          {/* Solid stroke — always visible regardless of path direction */}
                          <path
                            d={edgePath(from, to)}
                            fill="none"
                            stroke={edgeColor}
                            strokeWidth={isDone ? 2.2 : isRun ? 2.2 : 1.5}
                            strokeOpacity={isDone ? 0.85 : isRun ? 0.9 : 1}
                            strokeDasharray={isRun ? '8 5' : 'none'}
                            strokeDashoffset={isRun ? dashOffset : 0}
                            markerEnd={isDone ? 'url(#arr-done)' : isRun ? 'url(#arr-run)' : 'url(#arr-idle)'}
                          />
                        </g>
                      )
                    })
                  )}

                  {/* Nodes */}
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

                    return (
                      <g key={node.id}
                        transform={`translate(${nx},${ny})`}
                        onClick={() => setSelectedNode(p => p?.id === node.id ? null : node)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        style={{ cursor: 'pointer' }}
                        filter={state !== 'idle' && (isSel || isHov || isRunning) ? `url(#${c.filterId})` : state !== 'idle' ? `url(#${c.filterId})` : ''}
                      >
                        {/* Animated ring for running */}
                        {isRunning && (
                          <rect x={-5} y={-5} width={NW + 10} height={NH + 10} rx={17} fill="none"
                            stroke="#6366f1" strokeWidth={1} strokeDasharray="7 4"
                            strokeDashoffset={dashOffset * 0.5} opacity={0.4} />
                        )}

                        {/* Selection highlight */}
                        {isSel && (
                          <rect x={-2} y={-2} width={NW + 4} height={NH + 4} rx={14} fill="none"
                            stroke={c.border} strokeWidth={2} opacity={0.9} />
                        )}

                        {/* Node body */}
                        <rect x={0} y={0} width={NW} height={NH} rx={12}
                          fill={isSel ? c.bg : isHov ? 'rgba(255,255,255,0.05)' : '#0c0c1c'}
                          stroke={isSel || isHov ? c.border : 'rgba(255,255,255,0.08)'}
                          strokeWidth={isSel ? 1.5 : 1}
                        />

                        {/* Left color accent */}
                        <rect x={0} y={14} width={3} height={NH - 28} rx={2}
                          fill={c.stroke} opacity={state === 'idle' ? 0.25 : 1} />

                        {/* Status dot */}
                        <circle cx={9} cy={9} r={4} fill={c.stroke} opacity={state === 'idle' ? 0.3 : 1} />
                        {isRunning && <circle cx={9} cy={9} r={7} fill="none" stroke="#6366f1" strokeWidth={1} opacity={0.4} />}

                        {/* Agent type pill */}
                        <rect x={NW - 56} y={7} width={49} height={15} rx={7.5}
                          fill={`${typeColor}18`} stroke={`${typeColor}45`} strokeWidth={0.5} />
                        <text x={NW - 31.5} y={18} textAnchor="middle" fontSize={7.5} fill={typeColor} fontWeight="700" fontFamily="Inter,sans-serif">
                          {typeIsHuman ? '👤 HUMAN' : '🤖 AI'}
                        </text>

                        {/* Short title */}
                        <text x={20} y={NH / 2 - 5} fontSize={11.5} fontWeight="700" fill={state === 'idle' ? '#374151' : '#e2e8f0'} fontFamily="Inter,sans-serif">{node.shortTitle}</text>
                        {/* Agent name */}
                        <text x={20} y={NH / 2 + 9} fontSize={9.5} fill={state === 'idle' ? '#1f2937' : '#64748b'} fontFamily="Inter,sans-serif">{node.agentName}</text>
                        {/* Status badge text */}
                        <text x={20} y={NH / 2 + 22} fontSize={8.5} fill={c.text} fontWeight="600" fontFamily="Inter,sans-serif">● {c.badge}</text>
                      </g>
                    )
                  })}
                </svg>
                </div>{/* end transform world */}

                {/* Icon overlays positioned over SVG nodes */}
                <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                  {NODES.map(node => {
                    const state = getState(node.id)
                    const c = stateColors(state)
                    const Icon = node.icon
                    const screenX = pan.x + colX(node.col) * zoom + 2 * zoom
                    const screenY = pan.y + rowY(node.row) * zoom + (NH / 2 - 8) * zoom
                    return (
                      <div key={`ico-${node.id}`} style={{ position: 'absolute', left: screenX, top: screenY, width: 16 * zoom, height: 16 * zoom, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        {state === 'running'
                          ? <Loader2 size={13 * zoom} color={c.stroke} style={{ animation: 'spin 1s linear infinite' }} />
                          : state === 'completed'
                          ? <CheckCircle2 size={13 * zoom} color={c.stroke} />
                          : state === 'failed'
                          ? <XCircle size={13 * zoom} color={c.stroke} />
                          : state === 'waiting_approval'
                          ? <AlertCircle size={13 * zoom} color={c.stroke} />
                          : <Icon size={13 * zoom} color={c.stroke} />
                        }
                      </div>
                    )
                  })}
                </div>

                {/* Zoom controls */}
                <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
                  {[{ label: '+', action: () => setZoom(z => Math.min(2.5, z * 1.2)) },
                    { label: '−', action: () => setZoom(z => Math.max(0.25, z / 1.2)) },
                    { label: '⊙', action: () => { setZoom(0.85); setPan({ x: 0, y: 0 }) } },
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
                return (
                  <div style={{ width: 310, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,8,18,0.98)', overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideIn 0.18s ease-out' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, marginRight: 8 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${c.stroke}18`, border: `1px solid ${c.stroke}40`, padding: '3px 9px', borderRadius: 12, marginBottom: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.stroke }} />
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.badge}</span>
                        </div>
                        <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3, marginBottom: 4 }}>{nd.title}</h3>
                        <div style={{ fontSize: 11, color: '#374151' }}>
                          Agent: <span style={{ color: typeColor, fontWeight: 600 }}>{nd.agentName}</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedNode(null)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 5px', cursor: 'pointer', color: '#475569' }}>
                        <X size={13} />
                      </button>
                    </div>

                    {/* Description */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 12 }}>
                      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{nd.description}</p>
                    </div>

                    {/* Sub-steps */}
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
                      <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 13 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Zap size={10} /> Execution Metrics
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 9, color: '#1f2937', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Input Context</div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{nodeLogs[0].input_summary}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: '#1f2937', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Output</div>
                            <div style={{ fontSize: 11, color: '#a5b4fc', lineHeight: 1.5 }}>{nodeLogs[0].output_summary}</div>
                          </div>
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
                        <span style={{ fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>Shortlist validation required. Go to <strong>Candidates</strong> to review scores and shortlist applicants.</span>
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

                    {/* Connects to */}
                    {nd.connects.length > 0 && (
                      <div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>Connects To</div>
                        {nd.connects.map(cid => {
                          const cn = NODES.find(n => n.id === cid)
                          if (!cn) return null
                          const cc = stateColors(getState(cn.id))
                          return (
                            <div key={cid} onClick={() => setSelectedNode(cn)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cc.stroke, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>{cn.shortTitle}</span>
                              <ChevronRight size={11} color="#1f2937" />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Legend */}
            <div style={{ padding: '9px 22px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.005)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 20, fontSize: 11, color: '#374151', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#1f2937' }}>Legend</span>
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
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: '#1f2937' }}>
                <Bot size={11} color="#818cf8" /><span>AI Agent</span>
                <span style={{ color: '#f59e0b' }}>👤</span><span>Human Step</span>
                <span>·</span>
                <span style={{ fontSize: 10 }}>Click any node to inspect</span>
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

