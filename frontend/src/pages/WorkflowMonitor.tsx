import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi, jobsApi } from '@/api'
import { GitBranch, Activity, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Briefcase, RefreshCw } from 'lucide-react'
import type { AgentStatus, WorkflowStage, JobStatus } from '@/types'
import toast from 'react-hot-toast'

const STAGES: WorkflowStage[] = [
  'supervisor', 'planning', 'jd_generation', 'human_approval',
  'sourcing', 'monitoring', 'screening', 'human_review',
  'interviewing', 'onboarding', 'completed',
]

const stageLabel: Record<WorkflowStage, string> = {
  not_started: 'Not Started', supervisor: 'Supervisor', planning: 'Planning',
  jd_generation: 'JD Generation', human_approval: 'Human Approval',
  sourcing: 'Sourcing', monitoring: 'Monitoring', screening: 'Screening',
  human_review: 'Human Review', interviewing: 'Interviewing',
  onboarding: 'Onboarding', completed: 'Completed', failed: 'Failed',
}

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

function statusIcon(status: string) {
  if (status === 'running') return <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
  if (status === 'completed') return <CheckCircle2 size={14} color="#10b981" />
  if (status === 'failed') return <XCircle size={14} color="#ef4444" />
  if (status === 'waiting_approval') return <AlertCircle size={14} color="#f59e0b" />
  if (status === 'no_candidates_selected' || status?.includes('no candidates selected')) return <AlertCircle size={14} color="#64748b" />
  return <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#334155' }} />
}

function agentStatusLabel(status: string) {
  if (status === 'no_candidates_selected') return 'no candidates selected for the interview round'
  return status.replace(/_/g, ' ')
}

function getStageAgentStatus(stage: WorkflowStage, agentStatuses?: Record<string, any>): string {
  if (!agentStatuses) return 'idle'
  if (stage === 'interviewing') return agentStatuses['interview'] || 'idle'
  return agentStatuses[stage] || 'idle'
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

  const currentStageIdx = workflowState
    ? STAGES.indexOf(workflowState.current_stage)
    : -1

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitBranch size={22} color="#6366f1" /> Workflow Monitor
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Real-time agent execution status and workflow traces</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '28px', alignItems: 'start' }}>
        {/* Left Column: Interactive Jobs List */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
          padding: '16px',
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
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

        {/* Right Column: Active Workflow Details & Logs */}
        <div style={{ flex: 1 }}>
          {!selectedJobId ? (
            <div style={{
              textAlign: 'center', padding: '100px 40px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
            }}>
              <Activity size={48} style={{ marginBottom: '16px', color: '#374151', display: 'block', margin: '0 auto 16px' }} />
              <p style={{ color: '#64748b', fontSize: '15px' }}>Select a job from the list to monitor its workflow</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
              {/* Pipeline visualization */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px', padding: '24px',
              }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                  Workflow Pipeline
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {STAGES.map((stage, idx) => {
                    const isWorkflowFinished = workflowState?.current_stage === 'completed'
                    const isWorkflowFailed = workflowState?.current_stage === 'failed'
                    
                    const agentStatus = getStageAgentStatus(stage, workflowState?.agent_statuses)
                    
                    const isSkipped = agentStatus === 'no_candidates_selected' || agentStatus?.includes('no candidates selected')
                    
                    const isCompleted = (idx < currentStageIdx || isWorkflowFinished || agentStatus === 'completed') && !isSkipped
                    
                    const isCurrent = (idx === currentStageIdx && !isWorkflowFinished && !isWorkflowFailed && !isSkipped) || agentStatus === 'running'
                    
                    const isFailed = (agentStatus === 'failed' || (isWorkflowFailed && (
                      (stage === 'interviewing' && workflowState?.agent_statuses?.['interview'] === 'failed') ||
                      (stage === 'completed' && workflowState?.agent_statuses?.['completed'] === 'failed') ||
                      (stage !== 'interviewing' && stage !== 'completed' && workflowState?.agent_statuses?.[stage] === 'failed')
                    ))) && !isSkipped

                    return (
                      <div key={stage} style={{ display: 'flex', alignItems: 'stretch', gap: '16px' }}>
                        {/* Line + circle */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', flexShrink: 0 }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: isCompleted ? 'rgba(16,185,129,0.15)' : isFailed ? 'rgba(239,68,68,0.15)' : isSkipped ? 'rgba(100,116,139,0.1)' : isCurrent ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.02)',
                            border: `2px solid ${isCompleted ? '#10b981' : isFailed ? '#ef4444' : isSkipped ? '#64748b' : isCurrent ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: isCurrent ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
                          }}>
                            {isCompleted ? <CheckCircle2 size={14} color="#10b981" /> :
                             isFailed ? <XCircle size={14} color="#ef4444" /> :
                             isSkipped ? <AlertCircle size={14} color="#64748b" /> :
                             isCurrent ? <Loader2 size={14} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} /> :
                             <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
                          </div>
                          {idx < STAGES.length - 1 && (
                            <div style={{
                              width: '2px', flex: 1, minHeight: '24px',
                              background: isCompleted ? '#10b981' : isFailed ? '#ef4444' : isSkipped ? '#64748b' : 'rgba(255,255,255,0.06)',
                            }} />
                          )}
                        </div>

                        {/* Stage label */}
                        <div style={{ padding: '6px 0 24px', flex: 1 }}>
                          <div style={{
                            fontWeight: isCurrent ? 700 : 500,
                            fontSize: '14px',
                            color: isCompleted ? '#10b981' : isFailed ? '#ef4444' : isSkipped ? '#64748b' : isCurrent ? '#818cf8' : '#475569',
                          }}>
                            {stageLabel[stage]}
                          </div>
                          {agentStatus && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              {statusIcon(agentStatus)}
                              <span style={{ fontSize: '11px', color: '#64748b' }}>{agentStatusLabel(agentStatus)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Agent Logs */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px', padding: '20px',
                display: 'flex', flexDirection: 'column',
                height: 'fit-content',
              }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                  <Clock size={15} /> Execution Logs
                </h2>
                <div style={{ overflowY: 'auto', maxHeight: '550px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

