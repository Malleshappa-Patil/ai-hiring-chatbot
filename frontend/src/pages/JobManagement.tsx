import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, workflowApi } from '@/api'
import { Plus, Briefcase, CheckCircle, XCircle, Edit3, Play, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CreateJobRequest, Job } from '@/types'

export default function JobManagement() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [form, setForm] = useState<CreateJobRequest>({
    title: '', department: '', location: '', job_type: 'full_time',
    experience_level: '', hiring_goal: '', target_candidate_count: 3,
  })

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ page_size: 20 }),
  })

  const { data: jd } = useQuery({
    queryKey: ['jd', selectedJob?.id],
    queryFn: () => jobsApi.getJD(selectedJob!.id),
    enabled: !!selectedJob,
  })

  const createMutation = useMutation({
    mutationFn: jobsApi.create,
    onSuccess: () => {
      toast.success('Job created! AI workflow starting...')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setShowCreate(false)
      setForm({ title: '', department: '', location: '', job_type: 'full_time', experience_level: '', hiring_goal: '', target_candidate_count: 3 })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to create job'
      toast.error(msg)
    },
  })

  const startWorkflowMutation = useMutation({
    mutationFn: ({ jobId, goal }: { jobId: string; goal: string }) =>
      workflowApi.start(jobId, goal),
    onSuccess: () => {
      toast.success('AI workflow started! Generating job description...')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['jd', selectedJob?.id] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to start workflow'
      toast.error(msg)
    },
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
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) =>
      jobsApi.rejectJD(jobId, reason),
    onSuccess: () => {
      toast.success('JD rejected. Agent will regenerate.')
      qc.invalidateQueries({ queryKey: ['jd', selectedJob?.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.delete(jobId),
    onSuccess: (_, jobId) => {
      toast.success('Job deleted successfully')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      if (selectedJob?.id === jobId) {
        setSelectedJob(null)
      }
    },
    onError: () => toast.error('Failed to delete job'),
  })

  const statusColor: Record<string, string> = {
    draft: 'neutral', generating_jd: 'info', pending_approval: 'warning',
    approved: 'success', published: 'success', closed: 'neutral',
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0' }}>Job Management</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Create jobs and review AI-generated job descriptions</p>
        </div>
        <button
          id="create-job-btn"
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            border: 'none', borderRadius: '10px',
            color: 'white', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
          }}
        >
          <Plus size={18} /> Create Job
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1fr 1fr' : '1fr', gap: '20px' }}>
        {/* Job List */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '20px',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '16px' }}>
            All Jobs ({jobs?.total ?? 0})
          </h2>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '70px', borderRadius: '10px' }} />)}
            </div>
          ) : !jobs?.items.length ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#4a5568' }}>
              <Briefcase size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p style={{ fontSize: '14px' }}>No jobs yet. Create your first hiring campaign.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {jobs.items.map(job => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  style={{
                    padding: '14px 16px',
                    background: selectedJob?.id === job.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedJob?.id === job.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '10px', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0' }}>{job.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {job.department} · {job.location} · {job.job_type.replace(/_/g,' ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge badge-${statusColor[job.status] ?? 'neutral'}`}>
                      {job.status.replace(/_/g,' ')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this job?')) {
                          deleteMutation.mutate(job.id);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      title="Delete Job"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* JD Panel */}
        {selectedJob && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8' }}>
                Job Description — {selectedJob.title}
              </h2>
              <button onClick={() => setSelectedJob(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>✕</button>
            </div>

            {!jd ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568' }}>
                <Edit3 size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px' }}>JD not yet generated for this job.</p>
                <button
                  onClick={() => startWorkflowMutation.mutate({
                    jobId: selectedJob.id,
                    goal: selectedJob.hiring_goal || `Hire a ${selectedJob.title}`
                  })}
                  disabled={startWorkflowMutation.isPending}
                  style={{
                    marginTop: '16px',
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px',
                    background: startWorkflowMutation.isPending
                      ? 'rgba(99,102,241,0.4)'
                      : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    border: 'none', borderRadius: '10px',
                    color: 'white', fontSize: '13px', fontWeight: 600,
                    cursor: startWorkflowMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {startWorkflowMutation.isPending
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Starting...</>  
                    : <><Play size={16} /> Start AI Workflow</>}
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
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px', padding: '16px',
                  maxHeight: '320px', overflowY: 'auto',
                  fontSize: '13px', color: '#cbd5e1', lineHeight: 1.7,
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
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '11px', background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.4)',
                        borderRadius: '10px', color: '#10b981',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {approveMutation.isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                      Approve JD
                    </button>
                    <button
                      id="reject-jd-btn"
                      onClick={() => {
                        const feedback = window.prompt("Enter revision feedback for AI regeneration:", "Please make the requirements more detailed and add ML/AI pipeline experience.");
                        if (feedback !== null) {
                          rejectMutation.mutate({ jobId: selectedJob.id, reason: feedback });
                        }
                      }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '11px', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '10px', color: '#ef4444',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <XCircle size={16} /> Reject & Revise
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100, padding: '24px',
        }}>
          <div style={{
            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', marginBottom: '24px' }}>
              Create New Job
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Job Title', field: 'title', placeholder: 'e.g. Senior Backend Engineer' },
                { label: 'Department', field: 'department', placeholder: 'e.g. Engineering' },
                { label: 'Location', field: 'location', placeholder: 'e.g. Remote / Bangalore' },
                { label: 'Experience Level', field: 'experience_level', placeholder: 'e.g. 5+ years' },
                { label: 'Hiring Goal', field: 'hiring_goal', placeholder: 'e.g. Hire a Senior Backend Engineer for our platform team' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>{label}</label>
                  {field === 'hiring_goal' ? (
                    <textarea
                      value={(form[field as keyof CreateJobRequest] || '') as string}
                      onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={placeholder}
                      rows={3}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', color: '#e2e8f0', fontSize: '14px',
                        outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={(form[field as keyof CreateJobRequest] || '') as string}
                      onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={placeholder}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', color: '#e2e8f0', fontSize: '14px',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>
                  How many candidates do you want for this role?
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.target_candidate_count ?? 3}
                  onChange={e => setForm(p => ({ ...p, target_candidate_count: parseInt(e.target.value) || 1 }))}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', color: '#e2e8f0', fontSize: '14px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  flex: 1, padding: '11px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                id="submit-create-job-btn"
                onClick={() => {
                  if (!form.title || !form.department || !form.location || !form.experience_level || !form.hiring_goal) {
                    toast.error('Please fill in all details')
                    return
                  }
                  createMutation.mutate(form)
                }}
                disabled={createMutation.isPending}
                style={{
                  flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '11px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none', borderRadius: '10px',
                  color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {createMutation.isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={16} />}
                Create & Start Workflow
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .jd-markdown p { margin: 0 0 8px 0; color: #cbd5e1; }
        .jd-markdown p:last-child { margin-bottom: 0; }
        .jd-markdown h1, .jd-markdown h2, .jd-markdown h3, .jd-markdown h4 {
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 700;
          margin: 14px 0 6px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .jd-markdown ul, .jd-markdown ol { margin: 6px 0 10px 18px; padding: 0; }
        .jd-markdown li { margin-bottom: 4px; color: #cbd5e1; }
        .jd-markdown strong { color: #c4b5fd; font-weight: 600; }
        .jd-markdown em { color: #a5b4fc; }
        .jd-markdown hr { border: none; border-top: 1px solid rgba(99,102,241,0.2); margin: 10px 0; }
        .jd-markdown code {
          background: rgba(99,102,241,0.15);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
          color: #a5b4fc;
        }
        .jd-markdown blockquote {
          border-left: 3px solid rgba(99,102,241,0.5);
          padding-left: 10px;
          margin: 8px 0;
          color: #94a3b8;
        }
      `}</style>
    </div>
  )
}
