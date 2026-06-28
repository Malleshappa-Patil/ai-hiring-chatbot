import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi, jobsApi } from '@/api'
import { GitBranch, Activity, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Briefcase, RefreshCw } from 'lucide-react'
import type { JobStatus } from '@/types'
import toast from 'react-hot-toast'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
} from 'reactflow'
import type { Node, Edge, NodeProps } from 'reactflow'
import 'reactflow/dist/style.css'

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

interface AgentNodeData {
  label: string
  description?: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting_approval' | 'below_threshold' | 'threshold_reached' | 'max_retries' | 'no_candidates_selected'
  isCurrent: boolean
  hasLeftSource?: boolean
  hasLeftTarget?: boolean
  hasRightSource?: boolean
  hasRightTarget?: boolean
}

function AgentNode({ data }: NodeProps<AgentNodeData>) {
  const isStart = data.label === 'START'
  const isEnd = data.label === 'END'

  if (isStart) {
    return (
      <div style={{
        background: 'rgba(16, 185, 129, 0.1)',
        backdropFilter: 'blur(12px)',
        border: '2px solid #10b981',
        borderRadius: '20px',
        padding: '6px 20px',
        color: '#10b981',
        fontWeight: 700,
        fontSize: '11px',
        textAlign: 'center',
        minWidth: '80px',
        boxShadow: data.isCurrent ? '0 0 12px #10b981' : 'none',
      }}>
        <Handle type="source" position={Position.Bottom} style={{ background: '#10b981', width: '6px', height: '6px' }} />
        START
      </div>
    )
  }

  if (isEnd) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        backdropFilter: 'blur(12px)',
        border: '2px solid #ef4444',
        borderRadius: '20px',
        padding: '6px 20px',
        color: '#ef4444',
        fontWeight: 700,
        fontSize: '11px',
        textAlign: 'center',
        minWidth: '80px',
        boxShadow: data.isCurrent ? '0 0 12px #ef4444' : 'none',
      }}>
        <Handle type="target" position={Position.Top} style={{ background: '#ef4444', width: '6px', height: '6px' }} />
        END
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    idle: '#475569',
    running: '#6366f1',
    completed: '#10b981',
    threshold_reached: '#10b981',
    below_threshold: '#f59e0b',
    waiting_approval: '#f59e0b',
    max_retries: '#94a3b8',
    no_candidates_selected: '#ef4444',
    failed: '#ef4444',
  }

  const statusBg: Record<string, string> = {
    idle: 'rgba(71, 85, 105, 0.1)',
    running: 'rgba(99, 102, 241, 0.15)',
    completed: 'rgba(16, 185, 129, 0.15)',
    threshold_reached: 'rgba(16, 185, 129, 0.15)',
    below_threshold: 'rgba(245, 158, 10, 0.15)',
    waiting_approval: 'rgba(245, 158, 10, 0.15)',
    max_retries: 'rgba(148, 163, 184, 0.1)',
    no_candidates_selected: 'rgba(239, 68, 68, 0.15)',
    failed: 'rgba(239, 68, 68, 0.15)',
  }

  const borderGlow = data.isCurrent 
    ? `0 0 16px ${statusColor[data.status] || '#6366f1'}` 
    : 'none'

  return (
    <div style={{
      background: 'rgba(20, 20, 35, 0.85)',
      backdropFilter: 'blur(16px)',
      border: `2px solid ${data.isCurrent ? (statusColor[data.status] || '#6366f1') : 'rgba(255, 255, 255, 0.08)'}`,
      borderRadius: '12px',
      padding: '12px 16px',
      color: '#e2e8f0',
      minWidth: '220px',
      boxShadow: borderGlow,
      transition: 'all 0.3s ease',
      fontSize: '13px',
      position: 'relative',
    }}>
      {/* Target handle at the top */}
      <Handle type="target" position={Position.Top} style={{ background: '#475569', width: '6px', height: '6px' }} />

      {/* Source handle at the bottom */}
      <Handle type="source" position={Position.Bottom} style={{ background: '#475569', width: '6px', height: '6px' }} />
      
      {/* Left handle for loops */}
      {data.hasLeftSource && (
        <Handle type="source" position={Position.Left} id="left-source" style={{ background: '#94a3b8', width: '6px', height: '6px' }} />
      )}
      {data.hasLeftTarget && (
        <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#94a3b8', width: '6px', height: '6px' }} />
      )}

      {/* Right handle for loops */}
      {data.hasRightSource && (
        <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#94a3b8', width: '6px', height: '6px' }} />
      )}
      {data.hasRightTarget && (
        <Handle type="target" position={Position.Right} id="right-target" style={{ background: '#94a3b8', width: '6px', height: '6px' }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: data.isCurrent ? '#ffffff' : '#cbd5e1' }}>{data.label}</span>
          <span style={{
            fontSize: '9px',
            textTransform: 'uppercase',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '10px',
            background: statusBg[data.status] || 'rgba(255,255,255,0.05)',
            color: statusColor[data.status] || '#cbd5e1',
            border: `1px solid ${statusColor[data.status]}33`,
            letterSpacing: '0.5px',
          }}>
            {data.status === 'waiting_approval' ? 'approval' : data.status.replace(/_/g, ' ')}
          </span>
        </div>
        {data.description && (
          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>
            {data.description}
          </span>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  agent: AgentNode,
}

export default function WorkflowMonitor() {
  const [selectedJobId, setSelectedJobId] = useState('')
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

  const { data: logs } = useQuery({
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

  const isStuckAtInterview = workflowState?.current_stage === 'interviewing' &&
    workflowState?.agent_statuses?.['interview'] === 'running'

  const currentJob = jobs?.items?.find(j => j.id === selectedJobId)

  // Memoized nodes for React Flow
  const nodes: Node[] = useMemo(() => {
    if (!workflowState) return []

    const isFinished = workflowState.current_stage === 'completed'
    const isFailed = workflowState.current_stage === 'failed'

    const getStatus = (nodeId: string): AgentNodeData['status'] => {
      if (isFailed && workflowState.current_stage === nodeId) return 'failed'

      const statusKeyMap: Record<string, string> = {
        supervisor: 'supervisor',
        planning: 'planning',
        jd_agent: 'jd_generation',
        human_approval: 'human_approval',
        sourcing_agent: 'sourcing',
        monitoring_agent: 'monitoring',
        jd_optimization: 'jd_optimization',
        screening_agent: 'screening',
        human_review: 'human_review',
        interview_agent: 'interview',
        onboarding_agent: 'onboarding',
      }

      const key = statusKeyMap[nodeId]
      if (!key) return 'idle'
      return (workflowState.agent_statuses?.[key] || 'idle') as any
    }

    const isCurrentNode = (nodeId: string): boolean => {
      if (isFinished || isFailed) return false

      const currentStage = workflowState.current_stage
      const stageMap: Record<string, string> = {
        supervisor: 'supervisor',
        planning: 'planning',
        jd_agent: 'jd_generation',
        human_approval: 'human_approval',
        sourcing_agent: 'sourcing',
        monitoring_agent: 'monitoring',
        jd_optimization: 'jd_optimization',
        screening_agent: 'screening',
        human_review: 'human_review',
        interview_agent: 'interviewing',
        onboarding_agent: 'onboarding',
      }

      return stageMap[nodeId] === currentStage
    }

    return [
      {
        id: 'start',
        type: 'agent',
        position: { x: 350, y: 70 },
        data: { label: 'START', isCurrent: false, status: 'completed' },
      },
      {
        id: 'supervisor',
        type: 'agent',
        position: { x: 350, y: 150 },
        data: {
          label: 'Supervisor Agent',
          description: 'Orchestrates the recruitment flow, decides next action.',
          isCurrent: isCurrentNode('supervisor'),
          status: getStatus('supervisor'),
        },
      },
      {
        id: 'planning',
        type: 'agent',
        position: { x: 350, y: 270 },
        data: {
          label: 'Planning Agent',
          description: 'Converts goals into executable recruitment sub-tasks.',
          isCurrent: isCurrentNode('planning'),
          status: getStatus('planning'),
        },
      },
      {
        id: 'jd_agent',
        type: 'agent',
        position: { x: 350, y: 390 },
        data: {
          label: 'JD Agent',
          description: 'Generates customized Job Descriptions using AI models.',
          isCurrent: isCurrentNode('jd_agent'),
          status: getStatus('jd_agent'),
          hasLeftTarget: true,
        },
      },
      {
        id: 'human_approval',
        type: 'agent',
        position: { x: 350, y: 510 },
        data: {
          label: 'Human Approval',
          description: 'Recruiter approves, edits, or rejects generated JD.',
          isCurrent: isCurrentNode('human_approval'),
          status: getStatus('human_approval'),
          hasLeftSource: true,
        },
      },
      {
        id: 'sourcing_agent',
        type: 'agent',
        position: { x: 350, y: 630 },
        data: {
          label: 'Sourcing Agent',
          description: 'Publishes approved roles to LinkedIn, Indeed, Naukri.',
          isCurrent: isCurrentNode('sourcing_agent'),
          status: getStatus('sourcing_agent'),
          hasLeftTarget: true,
        },
      },
      {
        id: 'monitoring_agent',
        type: 'agent',
        position: { x: 350, y: 750 },
        data: {
          label: 'Monitoring Agent',
          description: 'Monitors application flow vs threshold (10 applicants).',
          isCurrent: isCurrentNode('monitoring_agent'),
          status: getStatus('monitoring_agent'),
          hasLeftSource: true,
        },
      },
      {
        id: 'jd_optimization',
        type: 'agent',
        position: { x: 90, y: 690 },
        data: {
          label: 'Trigger Improvement Actions',
          description: 'Optimizes and reposts JD to boost application count.',
          isCurrent: isCurrentNode('jd_optimization'),
          status: getStatus('jd_optimization'),
          hasLeftSource: true,
        },
      },
      {
        id: 'screening_agent',
        type: 'agent',
        position: { x: 350, y: 870 },
        data: {
          label: 'Resume Screening Agent',
          description: 'Parses and matches candidate profiles against JD.',
          isCurrent: isCurrentNode('screening_agent'),
          status: getStatus('screening_agent'),
          hasRightTarget: true,
        },
      },
      {
        id: 'human_review',
        type: 'agent',
        position: { x: 350, y: 990 },
        data: {
          label: 'Human Review',
          description: 'Recruiter reviews AI-shortlisted candidate scores.',
          isCurrent: isCurrentNode('human_review'),
          status: getStatus('human_review'),
        },
      },
      {
        id: 'interview_agent',
        type: 'agent',
        position: { x: 350, y: 1110 },
        data: {
          label: 'Interview Agent',
          description: 'Schedules and coordinates candidate evaluations.',
          isCurrent: isCurrentNode('interview_agent'),
          status: getStatus('interview_agent'),
          hasRightSource: true,
        },
      },
      {
        id: 'onboarding_agent',
        type: 'agent',
        position: { x: 350, y: 1230 },
        data: {
          label: 'Onboarding Agent',
          description: 'Dispatches welcome packet, sets up IT accounts.',
          isCurrent: isCurrentNode('onboarding_agent'),
          status: getStatus('onboarding_agent'),
        },
      },
      {
        id: 'end',
        type: 'agent',
        position: { x: 350, y: 1340 },
        data: {
          label: 'END',
          isCurrent: isFinished,
          status: isFinished ? 'completed' : 'idle',
        },
      },
    ]
  }, [workflowState])

  // Memoized edges for React Flow
  const edges: Edge[] = useMemo(() => {
    if (!workflowState) return []

    const edgeStyle = (isActive: boolean) => ({
      stroke: isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
      strokeWidth: isActive ? 2.5 : 1.5,
      animation: isActive ? 'dash 1.5s linear infinite' : 'none',
      strokeDasharray: isActive ? '6,6' : 'none',
    })

    const isNodeCompleted = (nodeId: string): boolean => {
      const getStatus = (id: string) => {
        const statusKeyMap: Record<string, string> = {
          supervisor: 'supervisor',
          planning: 'planning',
          jd_agent: 'jd_generation',
          human_approval: 'human_approval',
          sourcing_agent: 'sourcing',
          monitoring_agent: 'monitoring',
          jd_optimization: 'jd_optimization',
          screening_agent: 'screening',
          human_review: 'human_review',
          interview_agent: 'interview',
          onboarding_agent: 'onboarding',
        }
        return workflowState?.agent_statuses?.[statusKeyMap[id] || ''] || 'idle'
      }
      const s = getStatus(nodeId)
      return s === 'completed' || s === 'threshold_reached' || s === 'below_threshold'
    }

    return [
      {
        id: 'start-to-supervisor',
        source: 'start',
        target: 'supervisor',
        type: 'smoothstep',
        style: edgeStyle(true),
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      },
      {
        id: 'supervisor-to-planning',
        source: 'supervisor',
        target: 'planning',
        type: 'smoothstep',
        style: edgeStyle(isNodeCompleted('supervisor')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('supervisor') ? '#10b981' : '#475569' },
      },
      {
        id: 'planning-to-jd',
        source: 'planning',
        target: 'jd_agent',
        type: 'smoothstep',
        style: edgeStyle(isNodeCompleted('planning')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('planning') ? '#10b981' : '#475569' },
      },
      {
        id: 'jd-to-approval',
        source: 'jd_agent',
        target: 'human_approval',
        type: 'smoothstep',
        style: edgeStyle(isNodeCompleted('jd_agent')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('jd_agent') ? '#10b981' : '#475569' },
      },
      {
        id: 'approval-to-jd-reject',
        source: 'human_approval',
        sourceHandle: 'left-source',
        target: 'jd_agent',
        targetHandle: 'left-target',
        type: 'smoothstep',
        label: 'Rejected',
        style: {
          stroke: workflowState.agent_statuses?.['human_approval'] === 'idle' && workflowState.current_stage === 'jd_generation' ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
          strokeWidth: 2,
          strokeDasharray: '4,4',
        },
        labelStyle: { fill: '#ef4444', fontSize: '10px', fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
      },
      {
        id: 'approval-to-sourcing',
        source: 'human_approval',
        target: 'sourcing_agent',
        type: 'smoothstep',
        label: 'Approved',
        labelStyle: { fill: '#10b981', fontSize: '10px', fontWeight: 600 },
        style: edgeStyle(isNodeCompleted('human_approval')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('human_approval') ? '#10b981' : '#475569' },
      },
      {
        id: 'sourcing-to-monitoring',
        source: 'sourcing_agent',
        target: 'monitoring_agent',
        type: 'smoothstep',
        style: edgeStyle(isNodeCompleted('sourcing_agent')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('sourcing_agent') ? '#10b981' : '#475569' },
      },
      // Low Volume loop: monitoring_agent -> jd_optimization -> sourcing_agent
      {
        id: 'monitoring-to-optimization',
        source: 'monitoring_agent',
        sourceHandle: 'left-source',
        target: 'jd_optimization',
        type: 'smoothstep',
        label: 'Count Low',
        labelStyle: { fill: '#f59e0b', fontSize: '10px', fontWeight: 600 },
        style: {
          stroke: workflowState.agent_statuses?.['monitoring'] === 'below_threshold' ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)',
          strokeWidth: 2,
          strokeDasharray: '4,4',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
      },
      {
        id: 'optimization-to-sourcing',
        source: 'jd_optimization',
        sourceHandle: 'left-source',
        target: 'sourcing_agent',
        targetHandle: 'left-target',
        type: 'smoothstep',
        style: {
          stroke: isNodeCompleted('jd_optimization') ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
          strokeWidth: isNodeCompleted('jd_optimization') ? 2 : 1.5,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('jd_optimization') ? '#10b981' : '#475569' },
      },
      {
        id: 'monitoring-to-screening',
        source: 'monitoring_agent',
        target: 'screening_agent',
        type: 'smoothstep',
        label: 'Sufficient',
        labelStyle: { fill: '#10b981', fontSize: '10px', fontWeight: 600 },
        style: edgeStyle(workflowState.agent_statuses?.['monitoring'] === 'threshold_reached' || isNodeCompleted('monitoring_agent')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('monitoring_agent') ? '#10b981' : '#475569' },
      },
      {
        id: 'screening-to-review',
        source: 'screening_agent',
        target: 'human_review',
        type: 'smoothstep',
        style: edgeStyle(isNodeCompleted('screening_agent')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('screening_agent') ? '#10b981' : '#475569' },
      },
      {
        id: 'review-to-interview',
        source: 'human_review',
        target: 'interview_agent',
        type: 'smoothstep',
        style: edgeStyle(isNodeCompleted('human_review')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('human_review') ? '#10b981' : '#475569' },
      },
      // Interview reject loop back to screening
      {
        id: 'interview-to-screening-reject',
        source: 'interview_agent',
        sourceHandle: 'right-source',
        target: 'screening_agent',
        targetHandle: 'right-target',
        type: 'smoothstep',
        label: 'Rejected',
        labelStyle: { fill: '#ef4444', fontSize: '10px', fontWeight: 600 },
        style: {
          stroke: workflowState.agent_statuses?.['interview'] === 'failed' ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
          strokeWidth: 2,
          strokeDasharray: '4,4',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
      },
      {
        id: 'interview-to-onboarding',
        source: 'interview_agent',
        target: 'onboarding_agent',
        type: 'smoothstep',
        label: 'Selected',
        labelStyle: { fill: '#10b981', fontSize: '10px', fontWeight: 600 },
        style: edgeStyle(isNodeCompleted('interview_agent')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('interview_agent') ? '#10b981' : '#475569' },
      },
      {
        id: 'onboarding-to-end',
        source: 'onboarding_agent',
        target: 'end',
        type: 'smoothstep',
        style: edgeStyle(isNodeCompleted('onboarding_agent')),
        markerEnd: { type: MarkerType.ArrowClosed, color: isNodeCompleted('onboarding_agent') ? '#10b981' : '#475569' },
      },
    ]
  }, [workflowState])

  return (
    <div style={{ padding: '24px', width: '100%', maxWidth: '1800px', margin: '0 auto', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitBranch size={22} color="#6366f1" /> Workflow Monitor
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Real-time agent execution status and interactive workflow visualization</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isStuckAtInterview && (
            <button
              onClick={() => retryInterviewMutation.mutate()}
              disabled={retryInterviewMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(99,102,241,0.12)', padding: '7px 14px',
                borderRadius: '20px', border: '1px solid rgba(99,102,241,0.35)',
                color: '#818cf8', fontSize: '12px', fontWeight: 600,
                cursor: retryInterviewMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {retryInterviewMutation.isPending
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <RefreshCw size={14} />}
              Retry Interview
            </button>
          )}
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

        {/* Center Column: React Flow Workflow Visualizer */}
        <div style={{
          background: '#0a0a14',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
          overflow: 'hidden',
          position: 'relative',
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
              {workflowState && (
                <div style={{
                  background: '#0a0a14',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  padding: '12px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                  zIndex: 10,
                  position: 'relative',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                      Current Workflow Stage
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                      {workflowState.current_stage.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                  {currentJob && (
                    <div style={{ fontSize: '12px', color: '#8f9bb3', textAlign: 'right' }}>
                      Goal: "{currentJob.hiring_goal}"
                    </div>
                  )}
                </div>
              )}

              <div style={{ width: '100%', height: 'calc(100vh - 200px)', minHeight: '500px' }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  minZoom={0.2}
                  maxZoom={1.5}
                  nodesDraggable={false}
                  panOnDrag={true}
                  zoomOnScroll={true}
                  attributionPosition="bottom-left"
                  style={{ width: '100%', height: '100%' }}
                >
                  <Background color="rgba(255, 255, 255, 0.03)" gap={16} size={1} />
                  <Controls showInteractive={true} style={{ background: 'rgba(15, 15, 26, 0.8)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', borderRadius: '8px' }} />
                </ReactFlow>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Execution Logs */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '100%',
          width: '380px',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', flexShrink: 0 }}>
            <Clock size={15} /> Execution Logs
          </h2>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!logs?.length ? (
              <p style={{ color: '#4a5568', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
                No logs yet. Start the workflow to see agent activity.
              </p>
            ) : (
              logs.map(log => (
                <div key={log.id} style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${log.status === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                  borderRadius: '8px', padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#818cf8' }}>{log.agent_name}</span>
                    <span style={{ fontSize: '11px', color: '#475569' }}>{log.latency_ms}ms</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#8892b0' }}>{log.action}</div>
                  <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>{log.output_summary}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .react-flow__edge-path {
          transition: stroke 0.3s ease, stroke-width 0.3s ease;
        }
        .react-flow__handle {
          transition: background-color 0.2s ease;
        }
        .react-flow__handle:hover {
          background-color: #6366f1 !important;
        }
      `}</style>
    </div>
  )
}
