import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { onboardingApi, candidatesApi } from '@/api'
import { ClipboardCheck, CheckCircle2, Clock, Circle, User } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OnboardingTracker() {
  const qc = useQueryClient()
  const [selectedCandidateId, setSelectedCandidateId] = useState('')

  const { data: candidates, isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['candidates-onboarding'],
    queryFn: () => candidatesApi.list({ status: 'onboarding' }),
  })

  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['onboarding-tasks', selectedCandidateId],
    queryFn: () => onboardingApi.tasks(selectedCandidateId),
    enabled: !!selectedCandidateId,
  })

  const updateMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      onboardingApi.updateTask(taskId, status),
    onSuccess: () => {
      toast.success('Task status updated')
      qc.invalidateQueries({ queryKey: ['onboarding-tasks', selectedCandidateId] })
    },
  })

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 size={18} color="#10b981" />
    if (status === 'in_progress') return <Clock size={18} color="#f59e0b" />
    return <Circle size={18} color="#475569" />
  }

  const statusColor = (status: string) =>
    status === 'completed' ? '#10b981' : status === 'in_progress' ? '#f59e0b' : '#475569'

  const completedCount = tasks?.filter(t => t.status === 'completed').length ?? 0
  const totalCount = tasks?.length ?? 0

  const selectedCandidate = candidates?.items.find(c => c.id === selectedCandidateId)

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardCheck size={22} color="#6366f1" /> Onboarding Tracker
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>Track onboarding tasks for newly hired candidates</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column - Candidate List */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '20px',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '16px' }}>
            Hired Candidates ({candidates?.total ?? 0})
          </h2>

          {isLoadingCandidates ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '70px', borderRadius: '10px' }} />)}
            </div>
          ) : !candidates?.items.length ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '10px',
            }}>
              <User size={32} style={{ marginBottom: '12px', color: '#475569', opacity: 0.5 }} />
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                No candidates currently in onboarding. Selected hires will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {candidates.items.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCandidateId(c.id)}
                  style={{
                    padding: '14px 16px',
                    background: selectedCandidateId === c.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedCandidateId === c.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '10px', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: selectedCandidateId === c.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: selectedCandidateId === c.id ? '#818cf8' : '#94a3b8',
                    fontWeight: 600, fontSize: '14px',
                  }}>
                    {c.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Task Checklist */}
        <div style={{ height: '100%' }}>
          {!selectedCandidateId ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '100px 40px', minHeight: '340px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px', boxSizing: 'border-box',
            }}>
              <ClipboardCheck size={48} style={{ marginBottom: '16px', color: '#475569', opacity: 0.5 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>No Candidate Selected</h3>
              <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '360px', margin: '0 auto', lineHeight: 1.5 }}>
                Select a candidate from the left panel to view and track their onboarding checklist and tasks.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px', padding: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
                    Onboarding Checklist — {selectedCandidate?.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{selectedCandidate?.email}</p>
                </div>
                <button
                  onClick={() => setSelectedCandidateId('')}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', padding: '4px 10px', color: '#94a3b8', fontSize: '12px',
                    cursor: 'pointer', outline: 'none'
                  }}
                >
                  Close Panel
                </button>
              </div>

              {/* Progress header */}
              {tasks && (
                <div style={{ marginBottom: '24px', background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
                      Completion Progress
                    </span>
                    <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 700 }}>
                      {completedCount}/{totalCount} tasks ({totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: totalCount ? `${(completedCount / totalCount) * 100}%` : '0%',
                      height: '100%', borderRadius: '4px',
                      background: 'linear-gradient(90deg, #6366f1, #10b981)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )}

              {isLoadingTasks ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '70px', borderRadius: '10px' }} />)}
                </div>
              ) : !tasks?.length ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568' }}>
                  <p style={{ fontSize: '14px', color: '#64748b' }}>No onboarding tasks generated yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tasks.map(task => (
                    <div key={task.id} style={{
                      padding: '14px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${task.status === 'completed' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '10px',
                      display: 'flex', alignItems: 'center', gap: '14px',
                      opacity: task.status === 'completed' ? 0.7 : 1,
                      transition: 'all 0.15s',
                    }}>
                      {statusIcon(task.status)}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 600, fontSize: '14px',
                          color: statusColor(task.status),
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        }}>
                          {task.task_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Assigned to: {task.assigned_to} · Due: {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <select
                        value={task.status}
                        onChange={e => updateMutation.mutate({ taskId: task.id, status: e.target.value })}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px', color: '#94a3b8', fontSize: '12px',
                          outline: 'none', cursor: 'pointer',
                        }}
                      >
                        <option value="pending" style={{ background: '#1a1a2e' }}>Pending</option>
                        <option value="in_progress" style={{ background: '#1a1a2e' }}>In Progress</option>
                        <option value="completed" style={{ background: '#1a1a2e' }}>Completed</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
