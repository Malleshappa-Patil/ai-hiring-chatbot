import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { candidatesApi, jobsApi } from '@/api'
import { Users, Star, CheckCircle, XCircle, Search, Briefcase, Loader2, UserCheck, UserX, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { MatchCategory, JobStatus } from '@/types'
import toast from 'react-hot-toast'

const categoryColor: Record<MatchCategory, string> = {
  strong_match: '#10b981',
  partial_match: '#f59e0b',
  weak_match: '#ef4444',
}

const categoryLabel: Record<MatchCategory, string> = {
  strong_match: 'Strong Match',
  partial_match: 'Partial Match',
  weak_match: 'Weak Match',
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

const candidateStatusLabel: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed',
  selected: 'Selected',
  onboarding: 'Onboarding',
  rejected: 'Rejected',
}

const candidateStatusColor: Record<string, string> = {
  applied: '#64748b',
  screening: '#8b5cf6',
  shortlisted: '#6366f1',
  interview_scheduled: '#0ea5e9',
  interviewed: '#10b981',
  selected: '#14b8a6',
  onboarding: '#a855f7',
  rejected: '#ef4444',
}

function StatusBadge({ status }: { status: string }) {
  const color = candidateStatusColor[status] || '#64748b'
  return (
    <span style={{
      fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
      background: `${color}18`, color, border: `1px solid ${color}30`,
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {candidateStatusLabel[status] || status}
    </span>
  )
}

export default function CandidateList() {
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'shortlisted' | 'rejected'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['candidates-ranked', selectedJobId],
    queryFn: () => candidatesApi.ranked(selectedJobId),
    enabled: !!selectedJobId,
    refetchInterval: 8000,
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.approve(id),
    onSuccess: () => {
      toast.success('Candidate shortlisted successfully!')
      qc.invalidateQueries({ queryKey: ['candidates-ranked', selectedJobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to shortlist candidate'
      toast.error(msg)
    }
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => candidatesApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Candidate rejected.')
      qc.invalidateQueries({ queryKey: ['candidates-ranked', selectedJobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to reject candidate'
      toast.error(msg)
    }
  })

  const allCandidates = candidates ?? []

  // Compute stats
  const totalApplied = allCandidates.length
  const pendingCount = allCandidates.filter(c => c.status === 'applied' || c.status === 'screening').length
  const shortlistedCount = allCandidates.filter(c =>
    ['shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'onboarding'].includes(c.status)
  ).length
  const rejectedCount = allCandidates.filter(c => c.status === 'rejected').length
  const hiredCount = allCandidates.filter(c => c.status === 'selected' || c.status === 'onboarding').length

  const filtered = allCandidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.email.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    if (activeTab === 'pending') {
      return c.status === 'applied' || c.status === 'screening'
    } else if (activeTab === 'shortlisted') {
      return c.status === 'shortlisted' ||
             c.status === 'interview_scheduled' ||
             c.status === 'interviewed' ||
             c.status === 'selected' ||
             c.status === 'onboarding'
    } else if (activeTab === 'rejected') {
      return c.status === 'rejected'
    }
    return true // 'all' tab
  })

  const selectedJob = jobs?.items.find(j => j.id === selectedJobId)

  const TABS: { key: typeof activeTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: totalApplied, color: '#6366f1' },
    { key: 'pending', label: 'Pending Review', count: pendingCount, color: '#f59e0b' },
    { key: 'shortlisted', label: 'Shortlisted', count: shortlistedCount, color: '#10b981' },
    { key: 'rejected', label: 'Rejected', count: rejectedCount, color: '#ef4444' },
  ]

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0' }}>Candidate Management</h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>AI-ranked candidates with match scores and explanations</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '28px', alignItems: 'start' }}>
        {/* Left Column: Roles list */}
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
                  onClick={() => { setSelectedJobId(j.id); setSearch(''); setActiveTab('all') }}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: statusColor,
                      boxShadow: `0 0 6px ${statusColor}`,
                    }} />
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                      {j.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  {/* Hired / Rejected counts */}
                  {((j.hired_count ?? 0) > 0 || (j.rejected_count ?? 0) > 0) && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(j.hired_count ?? 0) > 0 && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'rgba(20,184,166,0.12)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.25)', fontWeight: 600 }}>
                          ✓ Hired: {j.hired_count}
                        </span>
                      )}
                      {(j.rejected_count ?? 0) > 0 && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}>
                          ✗ Rejected: {j.rejected_count}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Right Column: Candidate Management */}
        <div style={{ flex: 1 }}>
          {!selectedJobId ? (
            <div style={{
              textAlign: 'center', padding: '100px 40px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
            }}>
              <Users size={48} style={{ marginBottom: '16px', color: '#374151', display: 'block', margin: '0 auto 16px' }} />
              <p style={{ color: '#64748b', fontSize: '15px' }}>Select a role from the list to view ranked candidates</p>
            </div>
          ) : (
            <>
              {/* Header and Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                    {selectedJob?.title} Candidates
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                    {selectedJob?.department} · {selectedJob?.location}
                  </p>
                </div>
                <div style={{ position: 'relative', minWidth: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4a5568' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    style={{
                      width: '100%', padding: '10px 14px 10px 38px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px', color: '#e2e8f0', fontSize: '14px',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Summary Stats Strip */}
              {!isLoading && allCandidates.length > 0 && (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px',
                }}>
                  {[
                    { label: 'Total Applied', value: totalApplied, icon: <Users size={16} />, color: '#6366f1' },
                    { label: 'Pending Review', value: pendingCount, icon: <Clock size={16} />, color: '#f59e0b' },
                    { label: 'Shortlisted / Hired', value: shortlistedCount, icon: <UserCheck size={16} />, color: '#10b981' },
                    { label: 'Rejected', value: rejectedCount, icon: <UserX size={16} />, color: '#ef4444' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${stat.color}20`,
                      borderRadius: '12px', padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: `${stat.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: stat.color, flexShrink: 0,
                      }}>
                        {stat.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: activeTab === tab.key ? 600 : 400,
                      background: activeTab === tab.key ? `${tab.color}20` : 'transparent',
                      color: activeTab === tab.key ? tab.color : '#64748b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                    <span style={{
                      fontSize: '11px', padding: '1px 6px', borderRadius: '8px',
                      background: activeTab === tab.key ? `${tab.color}30` : 'rgba(255,255,255,0.06)',
                      color: activeTab === tab.key ? tab.color : '#475569',
                      fontWeight: 700,
                    }}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Candidate Cards */}
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: '100px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
              ) : allCandidates.length === 0 ? (
                /* No candidates at all yet */
                <div style={{
                  textAlign: 'center', padding: '60px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '14px',
                }}>
                  <Users size={40} style={{ marginBottom: '12px', color: '#374151', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '8px' }}>No candidates yet for this role</p>
                  <p style={{ color: '#475569', fontSize: '13px' }}>Candidates will appear here once the AI sourcing and screening stage is complete.</p>
                </div>
              ) : filtered.length === 0 ? (
                /* Tab is empty - show message + link to other tabs */
                <div style={{
                  textAlign: 'center', padding: '48px 40px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '14px',
                }}>
                  <Users size={36} style={{ marginBottom: '12px', color: '#374151', display: 'block', margin: '0 auto 14px' }} />
                  <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '6px', fontWeight: 500 }}>
                    No candidates in this view
                  </p>
                  <p style={{ color: '#475569', fontSize: '13px', marginBottom: '20px' }}>
                    {activeTab === 'pending'
                      ? `All ${totalApplied} candidate(s) have been reviewed.`
                      : activeTab === 'shortlisted'
                      ? 'No candidates have been shortlisted yet.'
                      : 'No candidates have been rejected.'}
                  </p>
                  {/* Quick switchers */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {shortlistedCount > 0 && activeTab !== 'shortlisted' && (
                      <button onClick={() => setActiveTab('shortlisted')} style={{
                        padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)',
                        background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                      }}>
                        <UserCheck size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        View {shortlistedCount} Shortlisted
                      </button>
                    )}
                    {rejectedCount > 0 && activeTab !== 'rejected' && (
                      <button onClick={() => setActiveTab('rejected')} style={{
                        padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)',
                        background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                      }}>
                        <UserX size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        View {rejectedCount} Rejected
                      </button>
                    )}
                    {pendingCount > 0 && activeTab !== 'pending' && (
                      <button onClick={() => setActiveTab('pending')} style={{
                        padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.3)',
                        background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                      }}>
                        <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        View {pendingCount} Pending
                      </button>
                    )}
                    <button onClick={() => setActiveTab('all')} style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)',
                      background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                    }}>
                      View All {totalApplied}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filtered.map((c, idx) => {
                    const cat = c.score?.category ?? 'weak_match'
                    const color = categoryColor[cat]
                    const isPending = approveMutation.isPending || rejectMutation.isPending
                    const isExpanded = expandedId === c.id
                    const isPendingReview = c.status === 'applied' || c.status === 'screening'
                    return (
                      <div key={c.id} style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid rgba(255,255,255,0.06)`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'all 0.15s',
                      }}>
                        {/* Main row */}
                        <div
                          style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          onMouseEnter={e => {
                            (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = `${color}30`
                            ;(e.currentTarget.parentElement as HTMLDivElement).style.boxShadow = `0 0 15px ${color}08`
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'
                            ;(e.currentTarget.parentElement as HTMLDivElement).style.boxShadow = 'none'
                          }}
                        >
                          {/* Rank */}
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: idx < 3 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '13px', color: idx < 3 ? 'white' : '#64748b',
                            flexShrink: 0,
                          }}>
                            {idx + 1}
                          </div>

                          {/* Avatar */}
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px', fontWeight: 700, color,
                            flexShrink: 0,
                          }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0' }}>{c.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{c.email}</div>
                          </div>

                          {/* Score */}
                          {c.score && (
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{
                                fontSize: '20px', fontWeight: 800, color,
                                display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end',
                              }}>
                                <Star size={14} fill={color} /> {c.score.score}
                              </div>
                              <span style={{
                                fontSize: '10px', padding: '2px 7px', borderRadius: '999px',
                                background: `${color}18`, color, border: `1px solid ${color}30`,
                              }}>
                                {categoryLabel[cat]}
                              </span>
                            </div>
                          )}

                          {/* Status badge */}
                          <div style={{ flexShrink: 0 }}>
                            <StatusBadge status={c.status} />
                          </div>

                          {/* Actions for pending-review candidates */}
                          {isPendingReview && (
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button
                                title="Shortlist"
                                disabled={isPending}
                                onClick={() => approveMutation.mutate(c.id)}
                                style={{
                                  padding: '7px', background: 'rgba(16,185,129,0.12)',
                                  border: '1px solid rgba(16,185,129,0.3)',
                                  borderRadius: '8px', color: '#10b981', cursor: isPending ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center',
                                }}
                              >
                                {approveMutation.isPending && approveMutation.variables === c.id ? (
                                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                  <CheckCircle size={15} />
                                )}
                              </button>
                              <button
                                title="Reject"
                                disabled={isPending}
                                onClick={() => {
                                  const reason = window.prompt('Please enter the reason for rejection:', 'Does not match requirements');
                                  if (reason !== null) {
                                    rejectMutation.mutate({ id: c.id, reason });
                                  }
                                }}
                                style={{
                                  padding: '7px', background: 'rgba(239,68,68,0.1)',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                  borderRadius: '8px', color: '#ef4444', cursor: isPending ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center',
                                }}
                              >
                                {rejectMutation.isPending && rejectMutation.variables?.id === c.id ? (
                                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                  <XCircle size={15} />
                                )}
                              </button>
                            </div>
                          )}

                          {/* Expand toggle */}
                          <div style={{ color: '#475569', flexShrink: 0 }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>

                        {/* Expanded detail panel */}
                        {isExpanded && c.score && (
                          <div style={{
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            padding: '16px 20px',
                            background: 'rgba(0,0,0,0.15)',
                          }}>
                            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px', lineHeight: 1.6 }}>
                              {c.score.explanation}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              {c.score.skills_matched.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginBottom: '6px' }}>✓ SKILLS MATCHED</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {c.score.skills_matched.map(skill => (
                                      <span key={skill} style={{
                                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                        background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)',
                                      }}>{skill}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {c.score.skills_missing.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginBottom: '6px' }}>✗ SKILLS MISSING</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {c.score.skills_missing.map(skill => (
                                      <span key={skill} style={{
                                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                        background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
                                      }}>{skill}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
