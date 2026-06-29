import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi, jobsApi } from '@/api'
import { 
  GitBranch, 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Briefcase, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Lock, 
  Play, 
  ClipboardList, 
  FileText, 
  UserCheck, 
  Send, 
  Eye, 
  Search, 
  Users, 
  Video, 
  UserPlus,
  AlertTriangle
} from 'lucide-react'
import type { JobStatus, AgentLog } from '@/types'
import toast from 'react-hot-toast'

const jobStatusColor: Record<JobStatus, string> = {
  draft: '#64748b',
  generating_jd: '#6366f1',
  pending_approval: '#f59e0b',
  approved: '#10b981',
  published: '#3b82f6',
  monitoring: '#8b5cf6',
  screening: '#ec4899',
  interviewing: '#14b8a6',
  onboarding: '#a855f7',
  closed: '#ef4444',
}

const jobStatusLabel: Record<JobStatus, string> = {
  draft: 'Draft',
  generating_jd: 'JD Generation',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  published: 'Published',
  monitoring: 'Monitoring',
  screening: 'Screening',
  interviewing: 'Interviewing',
  onboarding: 'Onboarding',
  closed: 'Closed',
}

interface StageConfig {
  id: string
  title: string
  agentName: string
  description: string
  icon: any
  subSteps: string[]
}

const STAGES: StageConfig[] = [
  {
    id: 'supervisor',
    title: 'Workflow Initiation & Orchestration',
    agentName: 'Supervisor Agent',
    description: 'Orchestrates the recruitment flow and delegates tasks based on hiring goals.',
    icon: Play,
    subSteps: [
      'Parse hiring goal and parameters',
      'Initialize workflow session and database entry',
      'Delegate execution planning to Planning Agent'
    ]
  },
  {
    id: 'planning',
    title: 'Recruitment Planning',
    agentName: 'Planning Agent',
    description: 'Converts recruiting goals into structured pipeline milestones.',
    icon: ClipboardList,
    subSteps: [
      'Analyze job requirements and timeline constraints',
      'Formulate recruitment stage sequence and candidate targets',
      'Save plan topology to short-term memory'
    ]
  },
  {
    id: 'jd_generation',
    title: 'Job Description Drafting',
    agentName: 'JD Agent',
    description: 'Generates professional, AI-optimized Job Descriptions matching constraints.',
    icon: FileText,
    subSteps: [
      'Search skills database and align industry taxonomies',
      'Invoke generative LLM chain to draft JD content',
      'Parse draft into standard sections (responsibilities, requirements)'
    ]
  },
  {
    id: 'human_approval',
    title: 'JD Review & Approval',
    agentName: 'Human Recruiter',
    description: 'Awaiting review and approval from recruiter before role publication.',
    icon: UserCheck,
    subSteps: [
      'Notify hiring manager of pending JD draft',
      'Capture edits, corrections, or feedback inputs',
      'Unlock sourcing process upon approval verification'
    ]
  },
  {
    id: 'sourcing',
    title: 'Candidate Sourcing & Job Posting',
    agentName: 'Sourcing Agent',
    description: 'Publishes approved roles to major boards like LinkedIn, Indeed, and Naukri.',
    icon: Send,
    subSteps: [
      'Generate board-specific metadata structures',
      'Submit listings to external job board APIs',
      'Listen for candidate applications and save initial profile records'
    ]
  },
  {
    id: 'monitoring',
    title: 'Application Volume Monitoring',
    agentName: 'Monitoring Agent',
    description: 'Monitors incoming traffic and runs optimization loops if application counts are low.',
    icon: Eye,
    subSteps: [
      'Track applicant counts against target candidate volume (threshold: 10)',
      'Analyze application velocity trends',
      'Trigger JD optimization loop if traffic falls below target threshold'
    ]
  },
  {
    id: 'screening',
    title: 'Resume Parsing & Screening',
    agentName: 'Resume Screening Agent',
    description: 'Evaluates candidate resumes using AI matching algorithms.',
    icon: Search,
    subSteps: [
      'Parse incoming resume PDFs into plain text data',
      'Calculate match scores and classify fit categories',
      'Generate key skills comparison and screening justification'
    ]
  },
  {
    id: 'human_review',
    title: 'Shortlist Validation',
    agentName: 'Human Recruiter',
    description: 'Recruiter verifies matching scores and approves the candidate shortlist.',
    icon: Users,
    subSteps: [
      'Present AI shortlists and evaluation reasoning',
      'Allow recruiter to override candidate classifications',
      'Trigger calendar scheduling for approved candidates'
    ]
  },
  {
    id: 'interviewing',
    title: 'Interview Coordination & Simulation',
    agentName: 'Interview Agent',
    description: 'Schedules and runs technical/HR evaluation simulations.',
    icon: Video,
    subSteps: [
      'Generate meeting schedules and coordinate calendar invites',
      'Simulate technical and behavioral interactive evaluation chats',
      'Compile interview feedback summaries and composite score sheets'
    ]
  },
  {
    id: 'onboarding',
    title: 'Offer Generation & Onboarding',
    agentName: 'Onboarding Agent',
    description: 'Prepares welcome package, offer letters, and corporate accounts.',
    icon: UserPlus,
    subSteps: [
      'Compose customized formal offer letters',
      'Set up enterprise communication accounts (email, Slack)',
      'Disseminate IT tasks and onboarding checklists to new hire'
    ]
  }
]

const STAGE_ORDER = [
  'supervisor',
  'planning',
  'jd_generation',
  'human_approval',
  'sourcing',
  'monitoring',
  'screening',
  'human_review',
  'interviewing',
  'onboarding'
]

export default function WorkflowMonitor() {
  const [selectedJobId, setSelectedJobId] = useState('')
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})
  const qc = useQueryClient()

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ page_size: 50 }),
  })

  // Auto-select first job
  useEffect(() => {
    if (jobs?.items && jobs.items.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs.items[0].id)
    }
  }, [jobs, selectedJobId])

  const { data: workflowState } = useQuery({
    queryKey: ['workflow-status', selectedJobId],
    queryFn: () => workflowApi.status(selectedJobId),
    enabled: !!selectedJobId,
    refetchInterval: 5000, // Poll every 5s when a job is selected
  })

  const { data: logs } = useQuery<AgentLog[]>({
    queryKey: ['workflow-logs', selectedJobId],
    queryFn: () => workflowApi.logs(selectedJobId),
    enabled: !!selectedJobId,
    refetchInterval: 5000,
  })

  const retryInterviewMutation = useMutation({
    mutationFn: () => workflowApi.retryInterview(selectedJobId),
    onSuccess: () => {
      toast.success('Interview simulation re-triggered!')
      qc.invalidateQueries({ queryKey: ['workflow-status', selectedJobId] })
      qc.invalidateQueries({ queryKey: ['workflow-logs', selectedJobId] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to retry interview'
      toast.error(msg)
    },
  })

  // Auto-expand current active stage when it updates
  useEffect(() => {
    if (workflowState?.current_stage) {
      setExpandedStages(prev => ({
        ...prev,
        [workflowState.current_stage]: true
      }))
    }
  }, [workflowState?.current_stage])

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }))
  }

  const handleExpandAll = () => {
    const allExpanded = STAGES.reduce((acc, stage) => {
      acc[stage.id] = true
      return acc
    }, {} as Record<string, boolean>)
    setExpandedStages(allExpanded)
  }

  const handleCollapseAll = () => {
    setExpandedStages({})
  }

  const isStuckAtInterview = workflowState?.current_stage === 'interviewing' &&
    workflowState?.agent_statuses?.['interview'] === 'running'

  const currentJob = jobs?.items?.find(j => j.id === selectedJobId)

  // Status mapping for a stage based on backend state
  const getStageStatus = (stageId: string): 'idle' | 'running' | 'completed' | 'failed' | 'waiting_approval' => {
    if (!workflowState) return 'idle'

    const isFailed = workflowState.current_stage === 'failed'
    
    // If workflow is failed and this stage was the active one when it failed
    if (isFailed && workflowState.current_stage === stageId) {
      return 'failed'
    }

    const agentKeyMap: Record<string, string> = {
      supervisor: 'supervisor',
      planning: 'planning',
      jd_generation: 'jd_generation',
      human_approval: 'human_approval',
      sourcing: 'sourcing',
      monitoring: 'monitoring',
      screening: 'screening',
      human_review: 'human_review',
      interviewing: 'interview',
      onboarding: 'onboarding',
    }

    const key = agentKeyMap[stageId]
    if (!key) return 'idle'

    return (workflowState.agent_statuses?.[key] || 'idle') as any
  }

  // Composite state evaluation for display
  const getStageState = (stageId: string): 'completed' | 'running' | 'waiting_approval' | 'failed' | 'idle' => {
    if (!workflowState) return 'idle'

    const currentStage = workflowState.current_stage
    const isFinished = currentStage === 'completed'
    const isFailed = currentStage === 'failed'

    const status = getStageStatus(stageId)
    if (status === 'completed' || status === 'threshold_reached' as any || status === 'below_threshold' as any) {
      return 'completed'
    }
    if (status === 'failed') return 'failed'
    if (status === 'waiting_approval') return 'waiting_approval'
    if (status === 'running') return 'running'

    if (isFinished) return 'completed'
    if (isFailed && stageId === workflowState.current_stage) return 'failed'

    // Fallback checks using linear progression indices
    const currentIdx = STAGE_ORDER.indexOf(currentStage)
    const stageIdx = STAGE_ORDER.indexOf(stageId)

    if (currentIdx !== -1 && stageIdx !== -1) {
      if (stageIdx < currentIdx) return 'completed'
      if (stageIdx === currentIdx) return 'running'
    }

    return 'idle'
  }

  const getLineBg = (stageId: string) => {
    const state = getStageState(stageId)
    if (state === 'completed') return '#10b981'
    return 'rgba(255, 255, 255, 0.08)'
  }

  const getSubStepState = (stageState: 'completed' | 'running' | 'waiting_approval' | 'failed' | 'idle', stepIdx: number) => {
    if (stageState === 'completed') return 'completed'
    if (stageState === 'idle') return 'pending'
    if (stageState === 'failed') return 'failed'
    if (stageState === 'running') {
      if (stepIdx === 0) return 'completed'
      if (stepIdx === 1) return 'active'
      return 'pending'
    }
    if (stageState === 'waiting_approval') {
      if (stepIdx === 0) return 'completed'
      return 'active'
    }
    return 'pending'
  }

  const getStageLogs = (stageId: string): AgentLog[] => {
    if (!logs) return []
    return logs.filter(log => {
      switch (stageId) {
        case 'supervisor':
          return log.agent_name === 'Supervisor Agent' && 
            (log.action === 'workflow_initiated' || log.action === 'workflow_completed')
        case 'planning':
          return log.agent_name === 'Planning Agent'
        case 'jd_generation':
          return log.agent_name === 'JD Agent' && 
            (log.action === 'generate_job_description' || log.action === 'regenerate_job_description')
        case 'human_approval':
          return false // Recruiter touchpoint
        case 'sourcing':
          return log.agent_name === 'Sourcing Agent'
        case 'monitoring':
          return log.agent_name === 'Monitoring Agent'
        case 'screening':
          return log.agent_name === 'Resume Screening Agent'
        case 'human_review':
          return log.agent_name === 'Supervisor Agent' && log.action === 'human_review_completed'
        case 'interviewing':
          return log.agent_name === 'Interview Agent'
        case 'onboarding':
          return log.agent_name === 'Onboarding Agent'
        default:
          return false
      }
    })
  }

  return (
    <div style={{ padding: '24px', width: '100%', maxWidth: '1800px', margin: '0 auto', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitBranch size={22} color="#6366f1" /> Workflow Monitor
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Real-time agent execution status and detailed stage-by-stage pipelines</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {workflowState && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="pulse-dot" style={{ background: '#10b981', width: '8px', height: '8px', borderRadius: '50%' }} />
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 500 }}>Live updates active</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0, height: '100%', width: '100%' }}>
        {/* Left Column: Interactive Jobs List */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          height: '100%',
          width: '320px',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', padding: '0 8px 8px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Active Roles</span>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '10px', color: '#64748b' }}>{jobs?.items.length || 0} total</span>
          </h2>

          {!jobs?.items.length ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b', fontSize: '13px' }}>
              <Briefcase size={32} style={{ marginBottom: '10px', color: '#374151', display: 'block', margin: '0 auto 10px' }} />
              No jobs found.
            </div>
          ) : (
            jobs.items.map(j => {
              const isSelected = j.id === selectedJobId
              const statusColor = jobStatusColor[j.status] || '#64748b'
              return (
                <div
                  key={j.id}
                  onClick={() => setSelectedJobId(j.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.06)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    }
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? '#a5b4fc' : '#e2e8f0', marginBottom: '4px' }}>
                    {j.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    {j.department} · {j.location}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: statusColor,
                      boxShadow: `0 0 6px ${statusColor}`,
                    }} />
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                      {jobStatusLabel[j.status] || j.status}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right Column: Redesigned Workflow Stage Monitor */}
        <div style={{
          background: '#0a0a14',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flex: 1,
          minWidth: 0,
        }}>
          {!selectedJobId ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px',
            }}>
              <Activity size={48} style={{ marginBottom: '16px', color: '#374151' }} />
              <p style={{ color: '#64748b', fontSize: '15px' }}>Select a job from the list to monitor its workflow</p>
            </div>
          ) : (
            <>
              {/* Header banner */}
              <div style={{
                background: '#0e0e1c',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                zIndex: 10,
                position: 'relative',
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>
                    Active Workflow Pipeline
                  </div>
                  {currentJob && (
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>
                      {currentJob.title} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 400 }}>({currentJob.department})</span>
                    </div>
                  )}
                  {currentJob && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      Goal: <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>"{currentJob.hiring_goal}"</span>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={handleExpandAll}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontSize: '11px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Expand All
                  </button>
                  <button
                    onClick={handleCollapseAll}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontSize: '11px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Collapse All
                  </button>
                  
                  {workflowState && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      background: workflowState.current_stage === 'completed' 
                        ? 'rgba(16,185,129,0.1)' 
                        : workflowState.current_stage === 'failed'
                        ? 'rgba(239,68,68,0.1)'
                        : 'rgba(99,102,241,0.1)',
                      borderRadius: '20px',
                      border: `1px solid ${
                        workflowState.current_stage === 'completed'
                          ? 'rgba(16,185,129,0.2)'
                          : workflowState.current_stage === 'failed'
                          ? 'rgba(239,68,68,0.2)'
                          : 'rgba(99,102,241,0.2)'
                      }`
                    }}>
                      <span className="pulse-dot" style={{
                        background: workflowState.current_stage === 'completed' 
                          ? '#10b981' 
                          : workflowState.current_stage === 'failed'
                          ? '#ef4444'
                          : '#6366f1',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%'
                      }} />
                      <span style={{
                        fontSize: '11px',
                        color: workflowState.current_stage === 'completed' 
                          ? '#10b981' 
                          : workflowState.current_stage === 'failed'
                          ? '#ef4444'
                          : '#818cf8',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {workflowState.current_stage === 'completed' 
                          ? 'Completed' 
                          : workflowState.current_stage === 'failed'
                          ? 'Failed'
                          : `Active: ${workflowState.current_stage.replace(/_/g, ' ')}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable list of workflow stages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {STAGES.map((stage, index) => {
                    const stageState = getStageState(stage.id)
                    const isCurrent = workflowState?.current_stage === stage.id
                    const isExpanded = !!expandedStages[stage.id]
                    const IconComponent = stage.icon
                    
                    // State configurations for styles
                    const config = {
                      completed: {
                        circleBg: 'rgba(16, 185, 129, 0.12)',
                        circleBorder: '#10b981',
                        circleColor: '#10b981',
                        badgeClass: 'badge-success',
                        badgeText: 'Completed'
                      },
                      running: {
                        circleBg: 'rgba(99, 102, 241, 0.15)',
                        circleBorder: '#6366f1',
                        circleColor: '#ffffff',
                        badgeClass: 'badge-info',
                        badgeText: 'Running'
                      },
                      waiting_approval: {
                        circleBg: 'rgba(245, 158, 11, 0.15)',
                        circleBorder: '#f59e0b',
                        circleColor: '#f59e0b',
                        badgeClass: 'badge-warning',
                        badgeText: 'Awaiting Recruiter'
                      },
                      failed: {
                        circleBg: 'rgba(239, 68, 68, 0.15)',
                        circleBorder: '#ef4444',
                        circleColor: '#ef4444',
                        badgeClass: 'badge-danger',
                        badgeText: 'Failed'
                      },
                      idle: {
                        circleBg: 'rgba(255, 255, 255, 0.02)',
                        circleBorder: 'rgba(255, 255, 255, 0.08)',
                        circleColor: '#64748b',
                        badgeClass: 'badge-neutral',
                        badgeText: 'Pending'
                      }
                    }[stageState] || {
                      circleBg: 'rgba(255, 255, 255, 0.02)',
                      circleBorder: 'rgba(255, 255, 255, 0.08)',
                      circleColor: '#64748b',
                      badgeClass: 'badge-neutral',
                      badgeText: 'Pending'
                    }

                    const stageLogs = getStageLogs(stage.id)

                    return (
                      <div key={stage.id} style={{ display: 'flex', gap: '20px' }}>
                        {/* Left stepper connector */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '40px' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: config.circleBg, border: `2px solid ${isCurrent ? '#6366f1' : config.circleBorder}`,
                            color: config.circleColor, zIndex: 2, transition: 'all 0.3s ease',
                            boxShadow: isCurrent ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none',
                            cursor: 'pointer'
                          }}
                          onClick={() => toggleStage(stage.id)}
                          >
                            <IconComponent size={18} style={{ animation: isCurrent && stageState === 'running' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none' }} />
                          </div>
                          {index < STAGES.length - 1 && (
                            <div style={{
                              width: '2px',
                              flexGrow: 1,
                              background: getLineBg(stage.id),
                              margin: '6px 0',
                              minHeight: '40px',
                              transition: 'all 0.3s ease'
                            }} />
                          )}
                        </div>

                        {/* Card Container */}
                        <div style={{
                          flex: 1,
                          background: isCurrent 
                            ? 'rgba(99, 102, 241, 0.04)' 
                            : 'rgba(255, 255, 255, 0.01)',
                          border: isCurrent 
                            ? '1px solid rgba(99, 102, 241, 0.25)' 
                            : '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: isCurrent ? '20px 24px' : '16px 20px',
                          marginBottom: '24px',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isCurrent ? '0 4px 20px rgba(99, 102, 241, 0.08)' : 'none',
                        }}>
                          {/* Card Header */}
                          <div 
                            onClick={() => toggleStage(stage.id)}
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ 
                                  fontSize: '13px', 
                                  fontWeight: 500, 
                                  color: '#64748b' 
                                }}>
                                  Step {(index + 1).toString().padStart(2, '0')} ·
                                </span>
                                <h3 style={{ 
                                  fontSize: isCurrent ? '16px' : '15px', 
                                  fontWeight: 600, 
                                  color: isCurrent ? '#ffffff' : '#cbd5e1',
                                  transition: 'color 0.2s ease'
                                }}>
                                  {stage.title}
                                </h3>
                              </div>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>
                                Executing Agent: <span style={{ color: '#818cf8', fontWeight: 500 }}>{stage.agentName}</span>
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span className={`badge ${config.badgeClass}`} style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                                {config.badgeText}
                              </span>
                              {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div style={{ 
                              marginTop: '16px', 
                              borderTop: '1px solid rgba(255, 255, 255, 0.04)', 
                              paddingTop: '16px',
                              animation: 'fadeIn 0.2s ease-out'
                            }}>
                              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', marginBottom: '16px' }}>
                                {stage.description}
                              </p>

                              {/* Checklist steps */}
                              <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                  Process Execution Steps
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {stage.subSteps.map((subStep, subIdx) => {
                                    const subStepState = getSubStepState(stageState, subIdx)
                                    
                                    return (
                                      <div key={subIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {subStepState === 'completed' && (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}>
                                            <Check size={10} color="#10b981" strokeWidth={3} />
                                          </div>
                                        )}
                                        {subStepState === 'active' && (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px' }}>
                                            <Loader2 size={12} color="#6366f1" className="animate-spin" />
                                          </div>
                                        )}
                                        {subStepState === 'pending' && (
                                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)' }} />
                                        )}
                                        {subStepState === 'failed' && (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)' }}>
                                            <XCircle size={12} color="#ef4444" />
                                          </div>
                                        )}
                                        <span style={{ 
                                          fontSize: '12px', 
                                          color: subStepState === 'completed' 
                                            ? '#94a3b8' 
                                            : subStepState === 'active'
                                            ? '#e2e8f0'
                                            : '#4b5563',
                                          fontWeight: subStepState === 'active' ? 500 : 400
                                        }}>
                                          {subStep}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Specific log info */}
                              {stageLogs.length > 0 && (
                                <div style={{ 
                                  background: 'rgba(0,0,0,0.2)', 
                                  border: '1px solid rgba(255, 255, 255, 0.04)',
                                  borderRadius: '8px', 
                                  padding: '12px 16px' 
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px', marginBottom: '8px' }}>
                                    <h4 style={{ fontSize: '11px', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      Execution Metrics
                                    </h4>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                                        Latency: <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{stageLogs[0].latency_ms}ms</span>
                                      </span>
                                      {stageLogs[0].token_usage > 0 && (
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                          Tokens: <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{stageLogs[0].token_usage}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: 600, textTransform: 'uppercase' }}>Input Context</div>
                                      <div style={{ fontSize: '12px', color: '#8892b0', marginTop: '2px' }}>{stageLogs[0].input_summary}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: 600, textTransform: 'uppercase' }}>Output Process Detail</div>
                                      <div style={{ fontSize: '12px', color: '#a5b4fc', marginTop: '2px', fontWeight: 400 }}>{stageLogs[0].output_summary}</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Special helper notes for Recruiter Approval / Review */}
                              {stage.id === 'human_approval' && currentJob?.status === 'pending_approval' && (
                                <div style={{ 
                                  marginTop: '12px', padding: '12px', 
                                  background: 'rgba(245, 158, 11, 0.08)', 
                                  border: '1px solid rgba(245, 158, 11, 0.2)', 
                                  borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' 
                                }}>
                                  <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                                  <span style={{ fontSize: '11px', color: '#f59e0b' }}>
                                    Recruiter review required. Please visit the **Roles** tab to review, edit, or approve the generated Job Description.
                                  </span>
                                </div>
                              )}

                              {stage.id === 'human_review' && getStageStatus('human_review') === 'waiting_approval' && (
                                <div style={{ 
                                  marginTop: '12px', padding: '12px', 
                                  background: 'rgba(245, 158, 11, 0.08)', 
                                  border: '1px solid rgba(245, 158, 11, 0.2)', 
                                  borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' 
                                }}>
                                  <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                                  <span style={{ fontSize: '11px', color: '#f59e0b' }}>
                                    Recruiter shortlist validation required. Please navigate to the **Candidates** page to review scores and shortlist/reject applicants.
                                  </span>
                                </div>
                              )}

                              {/* Stuck at interview action */}
                              {stage.id === 'interviewing' && isStuckAtInterview && (
                                <div style={{ 
                                  marginTop: '12px', padding: '12px', 
                                  background: 'rgba(239, 68, 68, 0.08)', 
                                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                                  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
                                }}>
                                  <span style={{ fontSize: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={14} style={{ flexShrink: 0 }} /> Interview simulation got stuck or failed.
                                  </span>
                                  <button
                                    onClick={() => retryInterviewMutation.mutate()}
                                    disabled={retryInterviewMutation.isPending}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '6px',
                                      background: '#ef4444', padding: '6px 12px',
                                      borderRadius: '16px', border: 'none',
                                      color: '#ffffff', fontSize: '11px', fontWeight: 600,
                                      cursor: retryInterviewMutation.isPending ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    {retryInterviewMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Retry Simulation
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
