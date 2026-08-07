import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { onboardingApi, candidatesApi } from '@/api'
import { ClipboardCheck, CheckCircle2, Clock, Circle, User } from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Editorial colour tokens ─────────────────────────────────── */
const C = {
  bg:       '#181818',
  panel:    '#1E1A18',
  panelAlt: '#221D1A',
  text:     '#EBDCC4',
  muted:    '#B6A596',
  faint:    '#7A6A5E',
  accent:   '#DC9F85',
  border:   '#66473B',
  divider:  '#35211A',
  green:    '#8ab4a0',
  greenBg:  'rgba(107,158,126,0.1)',
  greenBdr: 'rgba(107,158,126,0.25)',
}

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
    if (status === 'completed') return <CheckCircle2 size={16} color={C.green} />
    if (status === 'in_progress') return <Clock size={16} color={C.accent} />
    return <Circle size={16} color={C.faint} />
  }

  const statusTextColor = (status: string) =>
    status === 'completed' ? C.green : status === 'in_progress' ? C.accent : C.muted

  const completedCount = tasks?.filter(t => t.status === 'completed').length ?? 0
  const totalCount = tasks?.length ?? 0
  const selectedCandidate = candidates?.items.find(c => c.id === selectedCandidateId)

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', fontFamily: "'General Sans','Inter',sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ marginBottom: '28px', paddingBottom: '22px', borderBottom: `1px solid ${C.divider}` }}>
        <h1 style={{
          fontSize: '20px', fontWeight: 700, color: C.text,
          fontFamily: "'Clash Grotesk','General Sans',sans-serif",
          letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <ClipboardCheck size={18} color={C.accent} /> Onboarding Tracker
        </h1>
        <p style={{ fontSize: '12px', color: C.faint, marginTop: '3px' }}>
          Track onboarding tasks for newly hired candidates
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '18px', alignItems: 'start' }}>

        {/* ── Left: Candidate List ────────────────────────── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '18px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: C.faint, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Hired Candidates ({candidates?.total ?? 0})
          </h2>

          {isLoadingCandidates ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '64px' }} />)}
            </div>
          ) : !candidates?.items.length ? (
            <div style={{
              textAlign: 'center', padding: '32px 16px',
              background: C.panelAlt, border: `1px dashed ${C.divider}`,
              borderRadius: '4px',
            }}>
              <User size={28} style={{ marginBottom: '10px', color: C.faint, opacity: 0.4, display: 'block', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '12px', color: C.faint, lineHeight: 1.6 }}>
                No candidates currently in onboarding. Selected hires will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {candidates.items.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCandidateId(c.id)}
                  style={{
                    padding: '12px 14px',
                    background: selectedCandidateId === c.id ? `rgba(220,159,133,0.08)` : C.panelAlt,
                    border: `1px solid ${selectedCandidateId === c.id ? C.border : C.divider}`,
                    borderRadius: '4px', cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                  onMouseEnter={e => { if (selectedCandidateId !== c.id) (e.currentTarget as HTMLDivElement).style.borderColor = C.border }}
                  onMouseLeave={e => { if (selectedCandidateId !== c.id) (e.currentTarget as HTMLDivElement).style.borderColor = C.divider }}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '4px',
                    background: selectedCandidateId === c.id ? `rgba(220,159,133,0.15)` : `rgba(235,220,196,0.05)`,
                    border: `1px solid ${selectedCandidateId === c.id ? C.border : C.divider}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: selectedCandidateId === c.id ? C.accent : C.faint,
                    fontWeight: 700, fontSize: '12px', flexShrink: 0,
                  }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: '13px',
                      color: selectedCandidateId === c.id ? C.text : C.muted,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: C.faint, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Task Checklist ───────────────────────── */}
        <div>
          {!selectedCandidateId ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '80px 40px', minHeight: '300px',
              background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: '4px',
            }}>
              <ClipboardCheck size={40} style={{ marginBottom: '14px', color: C.faint, opacity: 0.25 }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: C.muted, marginBottom: '7px', fontFamily: "'Clash Grotesk','General Sans',sans-serif" }}>
                No Candidate Selected
              </h3>
              <p style={{ color: C.faint, fontSize: '13px', maxWidth: '320px', margin: '0 auto', lineHeight: 1.6 }}>
                Select a candidate from the left panel to view and track their onboarding checklist.
              </p>
            </div>
          ) : (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div>
                  <h3 style={{
                    fontSize: '14px', fontWeight: 700, color: C.text,
                    fontFamily: "'Clash Grotesk','General Sans',sans-serif",
                  }}>
                    Onboarding Checklist — {selectedCandidate?.name}
                  </h3>
                  <p style={{ fontSize: '11px', color: C.faint, marginTop: '2px' }}>{selectedCandidate?.email}</p>
                </div>
                <button
                  onClick={() => setSelectedCandidateId('')}
                  style={{
                    background: C.panelAlt, border: `1px solid ${C.divider}`,
                    borderRadius: '4px', padding: '5px 10px', color: C.faint, fontSize: '10px',
                    cursor: 'pointer', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    fontFamily: "'General Sans','Inter',sans-serif",
                  }}
                >Close</button>
              </div>

              {/* Progress bar */}
              {tasks && (
                <div style={{ marginBottom: '20px', background: C.panelAlt, padding: '14px', borderRadius: '4px', border: `1px solid ${C.divider}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: C.faint, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      Completion Progress
                    </span>
                    <span style={{ fontSize: '11px', color: C.text, fontWeight: 700 }}>
                      {completedCount}/{totalCount} ({totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%)
                    </span>
                  </div>
                  <div style={{ height: '5px', background: C.divider, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: totalCount ? `${(completedCount / totalCount) * 100}%` : '0%',
                      height: '100%', borderRadius: '2px',
                      background: C.accent, transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )}

              {isLoadingTasks ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '64px' }} />)}
                </div>
              ) : !tasks?.length ? (
                <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '13px' }}>
                  No onboarding tasks generated yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tasks.map(task => (
                    <div key={task.id} style={{
                      padding: '12px 14px',
                      background: task.status === 'completed' ? C.panelAlt : C.panelAlt,
                      border: `1px solid ${task.status === 'completed' ? C.divider : C.divider}`,
                      borderRadius: '4px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      opacity: task.status === 'completed' ? 0.65 : 1,
                      transition: 'all 0.15s',
                    }}>
                      {statusIcon(task.status)}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 600, fontSize: '13px',
                          color: statusTextColor(task.status),
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        }}>
                          {task.task_name}
                        </div>
                        <div style={{ fontSize: '11px', color: C.faint, marginTop: '1px' }}>
                          Assigned to: {task.assigned_to} · Due: {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <select
                        value={task.status}
                        onChange={e => updateMutation.mutate({ taskId: task.id, status: e.target.value })}
                        style={{
                          padding: '5px 9px',
                          background: C.bg, border: `1px solid ${C.border}`,
                          borderRadius: '4px', color: C.muted, fontSize: '11px',
                          outline: 'none', cursor: 'pointer',
                          fontFamily: "'General Sans','Inter',sans-serif",
                        }}
                      >
                        <option value="pending" style={{ background: C.panel }}>Pending</option>
                        <option value="in_progress" style={{ background: C.panel }}>In Progress</option>
                        <option value="completed" style={{ background: C.panel }}>Completed</option>
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
