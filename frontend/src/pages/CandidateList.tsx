import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { candidatesApi, interviewsApi, jobsApi } from '@/api'
import {
  Users, Star, CheckCircle, XCircle, Search, Briefcase, Loader2,
  UserCheck, UserX, Clock, ChevronDown, ChevronUp, CalendarPlus, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import type { MatchCategory, JobStatus } from '@/types'
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

/* ── Category colours (replaced neons with earthy) ─────────── */
const categoryColor: Record<MatchCategory, string> = {
  strong_match: C.green,
  partial_match: C.accent,
  weak_match: C.muted,
}

const categoryLabel: Record<MatchCategory, string> = {
  strong_match: 'Strong Match',
  partial_match: 'Partial Match',
  weak_match: 'Weak Match',
}

const jobStatusColor: Record<JobStatus, string> = {
  draft:            C.faint,
  generating_jd:    C.muted,
  pending_approval: C.accent,
  approved:         C.green,
  published:        C.muted,
  monitoring:       C.accent,
  screening:        C.muted,
  interviewing:     C.green,
  onboarding:       C.accent,
  closed:           C.faint,
}

const candidateStatusLabel: Record<string, string> = {
  applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled', interviewed: 'Interviewed',
  selected: 'Selected', onboarding: 'Onboarding', rejected: 'Rejected',
}

function StatusBadge({ status }: { status: string }) {
  const isRejected = status === 'rejected'
  const isSelected = status === 'selected' || status === 'onboarding'
  return (
    <span style={{
      fontSize: '9px', padding: '3px 8px', borderRadius: '4px',
      background: isRejected ? 'rgba(182,165,150,0.08)' : isSelected ? C.greenBg : `rgba(220,159,133,0.1)`,
      color: isRejected ? C.faint : isSelected ? C.green : C.accent,
      border: `1px solid ${isRejected ? C.divider : isSelected ? C.greenBdr : C.border}`,
      fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap' as const,
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
  const [interviewModal, setInterviewModal] = useState<{ candidateId: string; candidateName: string } | null>(null)
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewTime, setInterviewTime] = useState('10:00')
  const [interviewerName, setInterviewerName] = useState('')
  const [interviewDuration, setInterviewDuration] = useState(60)
  const qc = useQueryClient()

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ page_size: 50 }),
  })

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
      toast.success('Candidate shortlisted!')
      qc.invalidateQueries({ queryKey: ['candidates-ranked', selectedJobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to shortlist'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => candidatesApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Candidate rejected.')
      qc.invalidateQueries({ queryKey: ['candidates-ranked', selectedJobId] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to reject'),
  })

  const scheduleMutation = useMutation({
    mutationFn: (payload: Parameters<typeof interviewsApi.schedule>[0]) => interviewsApi.schedule(payload),
    onSuccess: (data) => {
      toast.success(`Interview invite sent! Meet link: ${data.meeting_link}`)
      setInterviewModal(null)
      setInterviewDate(''); setInterviewTime('10:00'); setInterviewerName(''); setInterviewDuration(60)
      qc.invalidateQueries({ queryKey: ['candidates-ranked', selectedJobId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to schedule'),
  })

  const selectMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.select(id),
    onSuccess: () => {
      toast.success('Candidate selected! Offer email sent. 🎉')
      qc.invalidateQueries({ queryKey: ['candidates-ranked', selectedJobId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to select'),
  })

  const rejectFinalMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.rejectFinal(id),
    onSuccess: () => {
      toast.success('Candidate rejected. Rejection email sent.')
      qc.invalidateQueries({ queryKey: ['candidates-ranked', selectedJobId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to reject'),
  })

  const allCandidates = candidates ?? []
  const totalApplied = allCandidates.length
  const pendingCount = allCandidates.filter(c => c.status === 'applied' || c.status === 'screening').length
  const shortlistedCount = allCandidates.filter(c =>
    ['shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'onboarding'].includes(c.status)
  ).length
  const rejectedCount = allCandidates.filter(c => c.status === 'rejected').length

  const filtered = allCandidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.email.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (activeTab === 'pending')     return c.status === 'applied' || c.status === 'screening'
    if (activeTab === 'shortlisted') return ['shortlisted','interview_scheduled','interviewed','selected','onboarding'].includes(c.status)
    if (activeTab === 'rejected')    return c.status === 'rejected'
    return true
  })

  const selectedJob = jobs?.items.find(j => j.id === selectedJobId)

  const TABS = [
    { key: 'all'        as const, label: 'All',            count: totalApplied    },
    { key: 'pending'    as const, label: 'Pending Review', count: pendingCount    },
    { key: 'shortlisted'as const, label: 'Shortlisted',    count: shortlistedCount },
    { key: 'rejected'   as const, label: 'Rejected',       count: rejectedCount   },
  ]

  const inputBaseStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: 'rgba(235,220,196,0.04)',
    border: `1px solid ${C.border}`,
    borderRadius: '4px', color: C.text, fontSize: '13px',
    fontFamily: "'General Sans','Inter',sans-serif",
    outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' as any,
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', fontFamily: "'General Sans','Inter',sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ marginBottom: '28px', paddingBottom: '22px', borderBottom: `1px solid ${C.divider}` }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: C.text, fontFamily: "'Clash Grotesk','General Sans',sans-serif", letterSpacing: '-0.01em' }}>
          Candidate Management
        </h1>
        <p style={{ fontSize: '12px', color: C.faint, marginTop: '2px' }}>AI-ranked candidates with match scores and explanations</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Left: Roles List ──────────────────────────────── */}
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '14px',
          maxHeight: 'calc(100vh - 220px)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <h2 style={{
            fontSize: '10px', fontWeight: 700, color: C.faint, padding: '0 6px 10px',
            borderBottom: `1px solid ${C.divider}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            <span>Active Roles</span>
            <span style={{ fontSize: '9px', background: C.panelAlt, padding: '2px 7px', borderRadius: '4px', border: `1px solid ${C.divider}`, color: C.faint }}>
              {jobs?.items.length || 0} total
            </span>
          </h2>

          {!jobs?.items.length ? (
            <div style={{ textAlign: 'center', padding: '32px 10px', color: C.faint, fontSize: '12px' }}>
              <Briefcase size={28} style={{ marginBottom: '8px', opacity: 0.15, display: 'block', margin: '0 auto 8px' }} />
              No jobs found.
            </div>
          ) : (
            jobs.items.map(j => {
              const isSelected = j.id === selectedJobId
              const dotColor = jobStatusColor[j.status] || C.faint
              return (
                <div
                  key={j.id}
                  onClick={() => { setSelectedJobId(j.id); setSearch(''); setActiveTab('all') }}
                  style={{
                    padding: '12px 12px',
                    borderRadius: '4px',
                    background: isSelected ? `rgba(220,159,133,0.08)` : C.panelAlt,
                    border: `1px solid ${isSelected ? C.border : C.divider}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = C.border }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = C.divider }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', color: isSelected ? C.text : C.muted, marginBottom: '2px' }}>
                    {j.title}
                  </div>
                  <div style={{ fontSize: '11px', color: C.faint, marginBottom: '7px' }}>
                    {j.department} · {j.location}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                    <span style={{ fontSize: '10px', color: C.faint, fontWeight: 500 }}>
                      {j.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  {((j.hired_count ?? 0) > 0 || (j.rejected_count ?? 0) > 0) && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {(j.hired_count ?? 0) > 0 && (
                        <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`, fontWeight: 700, letterSpacing: '0.08em' }}>
                          ✓ Hired: {j.hired_count}
                        </span>
                      )}
                      {(j.rejected_count ?? 0) > 0 && (
                        <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(182,165,150,0.08)', color: C.faint, border: `1px solid ${C.divider}`, fontWeight: 700, letterSpacing: '0.08em' }}>
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

        {/* ── Right: Candidate Management ────────────────── */}
        <div>
          {!selectedJobId ? (
            <div style={{
              textAlign: 'center', padding: '80px 40px',
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px',
            }}>
              <Users size={40} style={{ marginBottom: '14px', color: C.faint, opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
              <p style={{ color: C.faint, fontSize: '13px' }}>Select a role from the list to view ranked candidates</p>
            </div>
          ) : (
            <>
              {/* Header & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '18px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.text, margin: 0, fontFamily: "'Clash Grotesk','General Sans',sans-serif" }}>
                    {selectedJob?.title} Candidates
                  </h2>
                  <p style={{ fontSize: '11px', color: C.faint, margin: '3px 0 0' }}>
                    {selectedJob?.department} · {selectedJob?.location}
                  </p>
                </div>
                <div style={{ position: 'relative', minWidth: '260px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: C.faint }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    style={{
                      width: '100%', padding: '9px 14px 9px 34px',
                      background: C.panelAlt, border: `1px solid ${C.border}`,
                      borderRadius: '4px', color: C.text, fontSize: '13px',
                      outline: 'none', boxSizing: 'border-box',
                      fontFamily: "'General Sans','Inter',sans-serif",
                    }}
                  />
                </div>
              </div>

              {/* Stats Strip */}
              {!isLoading && allCandidates.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
                  {[
                    { label: 'Total Applied',    value: totalApplied,     icon: <Users size={14} />,    color: C.accent },
                    { label: 'Pending Review',   value: pendingCount,     icon: <Clock size={14} />,    color: C.muted },
                    { label: 'Shortlisted/Hired',value: shortlistedCount, icon: <UserCheck size={14} />,color: C.green },
                    { label: 'Rejected',         value: rejectedCount,    icon: <UserX size={14} />,    color: C.faint },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px',
                      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '4px',
                        background: `rgba(220,159,133,0.1)`,
                        border: `1px solid ${C.divider}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: stat.color, flexShrink: 0,
                      }}>
                        {stat.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: C.text, lineHeight: 1, fontFamily: "'Clash Grotesk','General Sans',sans-serif" }}>{stat.value}</div>
                        <div style={{ fontSize: '10px', color: C.faint, marginTop: '2px', letterSpacing: '0.05em' }}>{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs */}
              <div style={{
                display: 'flex', gap: '4px', marginBottom: '14px',
                background: C.panel, padding: '5px', borderRadius: '4px',
                border: `1px solid ${C.border}`,
              }}>
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: '4px', border: 'none',
                      cursor: 'pointer', fontSize: '11px', fontWeight: activeTab === tab.key ? 700 : 500,
                      background: activeTab === tab.key ? C.panelAlt : 'transparent',
                      color: activeTab === tab.key ? C.text : C.faint,
                      borderBottom: activeTab === tab.key ? `2px solid ${C.accent}` : '2px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      transition: 'all 0.15s',
                      fontFamily: "'General Sans','Inter',sans-serif",
                      letterSpacing: '0.02em',
                    }}
                  >
                    {tab.label}
                    <span style={{
                      fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
                      background: activeTab === tab.key ? C.border : C.divider,
                      color: activeTab === tab.key ? C.muted : C.faint,
                      fontWeight: 700, letterSpacing: '0.05em',
                    }}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Candidate Cards */}
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: '90px', borderRadius: '4px', background: C.panel, border: `1px solid ${C.border}` }} />)}
                </div>
              ) : allCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '56px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px' }}>
                  <Users size={36} style={{ marginBottom: '10px', color: C.faint, opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ color: C.muted, fontSize: '13px', marginBottom: '6px' }}>No candidates yet for this role</p>
                  <p style={{ color: C.faint, fontSize: '12px' }}>Candidates appear once the AI sourcing and screening stage is complete.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px' }}>
                  <Users size={30} style={{ marginBottom: '10px', color: C.faint, opacity: 0.15, display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ color: C.muted, fontSize: '13px', marginBottom: '5px', fontWeight: 600 }}>No candidates in this view</p>
                  <p style={{ color: C.faint, fontSize: '12px', marginBottom: '16px' }}>
                    {activeTab === 'pending' ? `All ${totalApplied} candidate(s) have been reviewed.`
                      : activeTab === 'shortlisted' ? 'No candidates have been shortlisted yet.'
                      : 'No candidates have been rejected.'}
                  </p>
                  <div style={{ display: 'flex', gap: '7px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {shortlistedCount > 0 && activeTab !== 'shortlisted' && (
                      <button onClick={() => setActiveTab('shortlisted')} style={{ padding: '7px 13px', borderRadius: '4px', border: `1px solid ${C.greenBdr}`, background: C.greenBg, color: C.green, fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                        <UserCheck size={12} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                        View {shortlistedCount} Shortlisted
                      </button>
                    )}
                    {rejectedCount > 0 && activeTab !== 'rejected' && (
                      <button onClick={() => setActiveTab('rejected')} style={{ padding: '7px 13px', borderRadius: '4px', border: `1px solid ${C.divider}`, background: 'rgba(182,165,150,0.06)', color: C.faint, fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                        <UserX size={12} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                        View {rejectedCount} Rejected
                      </button>
                    )}
                    <button onClick={() => setActiveTab('all')} style={{ padding: '7px 13px', borderRadius: '4px', border: `1px solid ${C.border}`, background: `rgba(220,159,133,0.08)`, color: C.accent, fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                      View All {totalApplied}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filtered.map((c, idx) => {
                    const cat = c.score?.category ?? 'weak_match'
                    const catColor = categoryColor[cat]
                    const isPending = approveMutation.isPending || rejectMutation.isPending
                    const isExpanded = expandedId === c.id
                    const isPendingReview = c.status === 'applied' || c.status === 'screening'
                    const isShortlisted = c.status === 'shortlisted'
                    const isInterviewed = c.status === 'interviewed' || c.status === 'interview_scheduled'

                    return (
                      <div key={c.id} style={{
                        background: C.panel, border: `1px solid ${C.border}`,
                        borderRadius: '4px', overflow: 'hidden', transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.accent}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.border}
                      >
                        {/* Main row */}
                        <div
                          style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        >
                          {/* Rank */}
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '4px',
                            background: idx < 3 ? `rgba(220,159,133,0.15)` : C.panelAlt,
                            border: `1px solid ${idx < 3 ? C.border : C.divider}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '11px',
                            color: idx < 3 ? C.accent : C.faint, flexShrink: 0,
                          }}>
                            {idx + 1}
                          </div>

                          {/* Avatar */}
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '4px',
                            background: `rgba(220,159,133,0.1)`, border: `1px solid ${C.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 700, color: catColor, flexShrink: 0,
                          }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: C.text }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: C.faint }}>{c.email}</div>
                          </div>

                          {/* Score */}
                          {c.score && (
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '18px', fontWeight: 800, color: catColor, display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', fontFamily: "'Clash Grotesk','General Sans',sans-serif" }}>
                                <Star size={12} fill={catColor} /> {c.score.score}
                              </div>
                              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: `rgba(220,159,133,0.1)`, color: catColor, border: `1px solid ${C.border}`, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 700 }}>
                                {categoryLabel[cat]}
                              </span>
                            </div>
                          )}

                          {/* Status badge */}
                          <div style={{ flexShrink: 0 }}>
                            <StatusBadge status={c.status} />
                          </div>

                          {/* Pending Review actions */}
                          {isPendingReview && (
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button
                                title="Shortlist"
                                disabled={isPending}
                                onClick={() => approveMutation.mutate(c.id)}
                                style={{
                                  padding: '6px', background: C.greenBg,
                                  border: `1px solid ${C.greenBdr}`,
                                  borderRadius: '4px', color: C.green, cursor: isPending ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center',
                                }}
                              >
                                {approveMutation.isPending && approveMutation.variables === c.id
                                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                  : <CheckCircle size={13} />}
                              </button>
                              <button
                                title="Reject"
                                disabled={isPending}
                                onClick={() => {
                                  const reason = window.prompt('Reason for rejection:', 'Does not match requirements')
                                  if (reason !== null) rejectMutation.mutate({ id: c.id, reason })
                                }}
                                style={{
                                  padding: '6px', background: `rgba(182,165,150,0.08)`,
                                  border: `1px solid ${C.divider}`,
                                  borderRadius: '4px', color: C.faint, cursor: isPending ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center',
                                }}
                              >
                                {rejectMutation.isPending && rejectMutation.variables?.id === c.id
                                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                  : <XCircle size={13} />}
                              </button>
                            </div>
                          )}



                          {/* Select/Reject for interviewed */}
                          {isInterviewed && (
                            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button
                                disabled={selectMutation.isPending || rejectFinalMutation.isPending}
                                onClick={() => selectMutation.mutate(c.id)}
                                style={{
                                  padding: '6px 10px', background: C.greenBg, border: `1px solid ${C.greenBdr}`,
                                  borderRadius: '4px', color: C.green, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                                  fontFamily: "'General Sans','Inter',sans-serif",
                                }}
                              >
                                {selectMutation.isPending && selectMutation.variables === c.id
                                  ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsUp size={12} />}
                                Select
                              </button>
                              <button
                                disabled={selectMutation.isPending || rejectFinalMutation.isPending}
                                onClick={() => rejectFinalMutation.mutate(c.id)}
                                style={{
                                  padding: '6px 10px', background: `rgba(182,165,150,0.08)`, border: `1px solid ${C.divider}`,
                                  borderRadius: '4px', color: C.faint, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                                  fontFamily: "'General Sans','Inter',sans-serif",
                                }}
                              >
                                {rejectFinalMutation.isPending && rejectFinalMutation.variables === c.id
                                  ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsDown size={12} />}
                                Reject
                              </button>
                            </div>
                          )}

                          {/* Expand toggle */}
                          <div style={{ color: C.faint, flexShrink: 0 }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>

                        {/* Expanded panel */}
                        {isExpanded && c.score && (
                          <div style={{ borderTop: `1px solid ${C.divider}`, padding: '14px 16px', background: C.panelAlt }}>
                            <div style={{ fontSize: '12px', color: C.muted, marginBottom: '10px', lineHeight: 1.65 }}>
                              {c.score.explanation}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              {c.score.skills_matched.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '9px', color: C.green, fontWeight: 700, marginBottom: '5px', letterSpacing: '0.12em' }}>✓ SKILLS MATCHED</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {c.score.skills_matched.map(skill => (
                                      <span key={skill} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}` }}>{skill}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {c.score.skills_missing.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '9px', color: C.faint, fontWeight: 700, marginBottom: '5px', letterSpacing: '0.12em' }}>✗ SKILLS MISSING</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {c.score.skills_missing.map(skill => (
                                      <span key={skill} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(182,165,150,0.08)', color: C.faint, border: `1px solid ${C.divider}` }}>{skill}</span>
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

      {/* ── Interview Scheduling Modal ─────────────────── */}
      {interviewModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)',
          }}
          onClick={() => setInterviewModal(null)}
        >
          <div
            style={{
              background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: '4px', padding: '28px', width: '420px', maxWidth: '95vw',
              fontFamily: "'General Sans','Inter',sans-serif",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '5px', fontFamily: "'Clash Grotesk','General Sans',sans-serif" }}>
              Send Interview Invite
            </h3>
            <p style={{ fontSize: '12px', color: C.faint, marginBottom: '20px' }}>
              Scheduling for: <strong style={{ color: C.muted }}>{interviewModal.candidateName}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'DATE', type: 'date', value: interviewDate, min: new Date().toISOString().split('T')[0], onChange: (v: string) => setInterviewDate(v) },
                { label: 'TIME', type: 'time', value: interviewTime, onChange: (v: string) => setInterviewTime(v) },
                { label: 'INTERVIEWER NAME', type: 'text', value: interviewerName, placeholder: 'e.g. Rahul Sharma', onChange: (v: string) => setInterviewerName(v) },
              ].map(field => (
                <div key={field.label}>
                  <label style={{ fontSize: '9px', color: C.faint, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={field.value}
                    min={'min' in field ? field.min : undefined}
                    placeholder={'placeholder' in field ? field.placeholder : undefined}
                    onChange={e => field.onChange(e.target.value)}
                    style={inputBaseStyle}
                    onFocus={e => e.currentTarget.style.borderColor = C.accent}
                    onBlur={e => e.currentTarget.style.borderColor = C.border}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: '9px', color: C.faint, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>
                  DURATION
                </label>
                <select
                  value={interviewDuration}
                  onChange={e => setInterviewDuration(Number(e.target.value))}
                  style={{ ...inputBaseStyle, cursor: 'pointer' }}
                >
                  <option value={30} style={{ background: C.panel }}>30 minutes</option>
                  <option value={45} style={{ background: C.panel }}>45 minutes</option>
                  <option value={60} style={{ background: C.panel }}>60 minutes</option>
                  <option value={90} style={{ background: C.panel }}>90 minutes</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setInterviewModal(null)}
                style={{
                  flex: 1, padding: '10px', background: 'transparent',
                  border: `1px solid ${C.divider}`, borderRadius: '4px',
                  color: C.faint, fontSize: '11px', cursor: 'pointer', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: "'General Sans','Inter',sans-serif",
                }}
              >Cancel</button>
              <button
                disabled={!interviewDate || !interviewerName || scheduleMutation.isPending}
                onClick={() => {
                  if (!interviewDate || !interviewerName) { toast.error('Please fill in date and interviewer name'); return }
                  const scheduledAt = new Date(`${interviewDate}T${interviewTime}:00`).toISOString()
                  scheduleMutation.mutate({
                    candidate_id: interviewModal.candidateId,
                    job_id: selectedJobId,
                    scheduled_at: scheduledAt,
                    duration_minutes: interviewDuration,
                    interviewer: interviewerName,
                    interview_type: 'technical',
                  })
                }}
                style={{
                  flex: 2, padding: '10px',
                  background: (!interviewDate || !interviewerName) ? C.divider : C.accent,
                  border: 'none', borderRadius: '4px',
                  color: C.bg, fontSize: '11px',
                  cursor: (!interviewDate || !interviewerName) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  opacity: (!interviewDate || !interviewerName) ? 0.5 : 1,
                  fontFamily: "'General Sans','Inter',sans-serif",
                }}
              >
                {scheduleMutation.isPending
                  ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                  : <><CalendarPlus size={13} /> Send Invite & Meet Link</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
