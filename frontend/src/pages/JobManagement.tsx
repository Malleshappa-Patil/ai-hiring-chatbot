import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, workflowApi } from '@/api'
import { Briefcase, CheckCircle, XCircle, Edit3, Play, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Job } from '@/types'

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
}


export default function JobManagement() {
  const qc = useQueryClient()
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ page_size: 20 }),
  })

  const { data: jd } = useQuery({
    queryKey: ['jd', selectedJob?.id],
    queryFn: () => jobsApi.getJD(selectedJob!.id),
    enabled: !!selectedJob,
  })

  const startWorkflowMutation = useMutation({
    mutationFn: ({ jobId, goal }: { jobId: string; goal: string }) => workflowApi.start(jobId, goal),
    onSuccess: () => {
      toast.success('AI workflow started!')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['jd', selectedJob?.id] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to start workflow'),
  })

  const approveMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.approveJD(jobId),
    onSuccess: () => {
      toast.success('JD approved! Job posting started.')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['jd', selectedJob?.id] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) => jobsApi.rejectJD(jobId, reason),
    onSuccess: () => {
      toast.success('JD rejected. Agent will regenerate.')
      qc.invalidateQueries({ queryKey: ['jd', selectedJob?.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.delete(jobId),
    onSuccess: (_, jobId) => {
      toast.success('Job deleted')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      if (selectedJob?.id === jobId) setSelectedJob(null)
    },
    onError: () => toast.error('Failed to delete job'),
  })

  const statusBadge: Record<string, string> = {
    draft: 'neutral', generating_jd: 'info', pending_approval: 'warning',
    approved: 'success', published: 'success', closed: 'neutral',
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', fontFamily: "'General Sans','Inter',sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', paddingBottom: '22px', borderBottom: `1px solid ${C.divider}` }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: C.text, fontFamily: "'Clash Grotesk','General Sans',sans-serif", letterSpacing: '-0.01em' }}>
            Job Management
          </h1>
          <p style={{ fontSize: '12px', color: C.faint, marginTop: '2px', letterSpacing: '0.01em' }}>
            Review and manage AI-generated jobs — use the chatbot to create new ones
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1fr 1fr' : '1fr', gap: '18px' }}>

        {/* ── Job List ──────────────────────────────────────── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '20px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: C.faint, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '14px' }}>
            All Jobs ({jobs?.total ?? 0})
          </h2>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '64px' }} />)}
            </div>
          ) : !jobs?.items.length ? (
            <div style={{ textAlign: 'center', padding: '48px', color: C.faint }}>
              <Briefcase size={36} style={{ marginBottom: '12px', opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px' }}>No jobs yet. Create your first hiring campaign.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {jobs.items.map(job => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  style={{
                    padding: '12px 14px',
                    background: selectedJob?.id === job.id ? `rgba(220,159,133,0.08)` : C.panelAlt,
                    border: `1px solid ${selectedJob?.id === job.id ? C.border : C.divider}`,
                    borderRadius: '4px', cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => { if (selectedJob?.id !== job.id) (e.currentTarget as HTMLDivElement).style.borderColor = C.border }}
                  onMouseLeave={e => { if (selectedJob?.id !== job.id) (e.currentTarget as HTMLDivElement).style.borderColor = C.divider }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: selectedJob?.id === job.id ? C.text : C.muted }}>{job.title}</div>
                    <div style={{ fontSize: '11px', color: C.faint, marginTop: '2px' }}>
                      {job.department} · {job.location} · {job.job_type.replace(/_/g,' ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge badge-${statusBadge[job.status] ?? 'neutral'}`}>
                      {job.status.replace(/_/g,' ')}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (confirm('Delete this job?')) deleteMutation.mutate(job.id)
                      }}
                      style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                      title="Delete Job"
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = C.accent}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = C.faint}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── JD Panel ──────────────────────────────────────── */}
        {selectedJob && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '11px', fontWeight: 700, color: C.faint, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Job Description — {selectedJob.title}
              </h2>
              <button
                onClick={() => setSelectedJob(null)}
                style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
              >✕</button>
            </div>

            {!jd ? (
              <div style={{ textAlign: 'center', padding: '40px', color: C.faint }}>
                <Edit3 size={28} style={{ marginBottom: '12px', opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', marginBottom: '18px' }}>JD not yet generated for this job.</p>
                <button
                  onClick={() => startWorkflowMutation.mutate({ jobId: selectedJob.id, goal: selectedJob.hiring_goal || `Hire a ${selectedJob.title}` })}
                  disabled={startWorkflowMutation.isPending}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px',
                    background: startWorkflowMutation.isPending ? C.divider : C.accent,
                    border: 'none', borderRadius: '4px',
                    color: C.bg, fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: startWorkflowMutation.isPending ? 'not-allowed' : 'pointer',
                    fontFamily: "'General Sans','Inter',sans-serif",
                  }}
                >
                  {startWorkflowMutation.isPending
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Starting...</>
                    : <><Play size={14} /> Start AI Workflow</>}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <span className={`badge badge-${jd.status === 'approved' ? 'success' : jd.status === 'pending_approval' ? 'warning' : 'neutral'}`}>
                    v{jd.version} · {jd.status.replace(/_/g,' ')}
                  </span>
                </div>
                <div style={{
                  background: C.panelAlt,
                  border: `1px solid ${C.divider}`,
                  borderRadius: '4px', padding: '16px',
                  maxHeight: '320px', overflowY: 'auto',
                  fontSize: '13px', color: C.muted, lineHeight: 1.75,
                  marginBottom: '16px',
                }}>
                  <div className="jd-markdown">
                    <ReactMarkdown>{jd.content}</ReactMarkdown>
                  </div>
                </div>

                {jd.status === 'pending_approval' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      id="approve-jd-btn"
                      onClick={() => approveMutation.mutate(selectedJob.id)}
                      disabled={approveMutation.isPending}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                        padding: '10px',
                        background: 'rgba(107,158,126,0.1)',
                        border: '1px solid rgba(107,158,126,0.3)',
                        borderRadius: '4px', color: '#8ab4a0',
                        fontSize: '11px', fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: 'pointer', fontFamily: "'General Sans','Inter',sans-serif",
                      }}
                    >
                      {approveMutation.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                      Approve JD
                    </button>
                    <button
                      id="reject-jd-btn"
                      onClick={() => {
                        const feedback = window.prompt('Enter revision feedback for AI regeneration:', 'Please make requirements more detailed.')
                        if (feedback !== null) rejectMutation.mutate({ jobId: selectedJob.id, reason: feedback })
                      }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                        padding: '10px',
                        background: 'rgba(182,165,150,0.08)',
                        border: `1px solid ${C.border}`,
                        borderRadius: '4px', color: C.muted,
                        fontSize: '11px', fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: 'pointer', fontFamily: "'General Sans','Inter',sans-serif",
                      }}
                    >
                      <XCircle size={14} /> Reject & Revise
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>


      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .jd-markdown p { margin: 0 0 8px 0; color: ${C.muted}; }
        .jd-markdown p:last-child { margin-bottom: 0; }
        .jd-markdown h1,.jd-markdown h2,.jd-markdown h3,.jd-markdown h4 {
          color: ${C.text}; font-size: 13px; font-weight: 700;
          margin: 12px 0 5px 0; padding-bottom: 4px;
          border-bottom: 1px solid ${C.divider};
        }
        .jd-markdown ul,.jd-markdown ol { margin: 5px 0 9px 16px; padding: 0; }
        .jd-markdown li { margin-bottom: 3px; color: ${C.muted}; }
        .jd-markdown strong { color: ${C.text}; font-weight: 600; }
        .jd-markdown em { color: ${C.muted}; }
        .jd-markdown hr { border: none; border-top: 1px solid ${C.divider}; margin: 9px 0; }
        .jd-markdown code { background: rgba(220,159,133,0.1); padding: 1px 5px; border-radius: 4px; font-size: 11px; color: ${C.accent}; }
        .jd-markdown blockquote { border-left: 3px solid ${C.border}; padding-left: 10px; margin: 7px 0; color: ${C.faint}; }
      `}</style>
    </div>
  )
}
