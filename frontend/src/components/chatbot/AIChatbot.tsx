import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import {
  Bot,
  X,
  Send,
  ChevronDown,
  Loader2,
  Sparkles,
  CheckCircle,
  Workflow,
  MessageSquare,
  Download,
} from 'lucide-react'
import { chatbotApi } from '@/api/chatbot'
import { apiClient } from '@/api/client'

// ── Types ──────────────────────────────────────────────────────────────────────
interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isTyping?: boolean
}

// ── Styles (inline for zero deps) ─────────────────────────────────────────────
const styles = {
  // Trigger button — Editorial warm style
  trigger: {
    position: 'fixed' as const,
    bottom: '28px',
    right: '28px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    background: '#1E1A18',
    border: '1px solid #66473B',
    borderRadius: '4px',
    color: '#EBDCC4',
    fontFamily: "'General Sans', 'Inter', system-ui, sans-serif",
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
    transition: 'all 0.2s ease',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  // Chat panel
  panel: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: '420px',
    zIndex: 9998,
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#181818',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderLeft: '1px solid #66473B',
    boxShadow: '-8px 0 48px rgba(0,0,0,0.7)',
    fontFamily: "'General Sans', 'Inter', system-ui, sans-serif",
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  // Header
  header: {
    padding: '18px 20px',
    background: '#1E1A18',
    borderBottom: '1px solid #66473B',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  // Messages area
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    scrollBehavior: 'smooth' as const,
    background: '#181818',
  },
  // Input area
  inputArea: {
    padding: '16px',
    borderTop: '1px solid #66473B',
    background: '#1E1A18',
    flexShrink: 0,
  },
  downloadBtn: {
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid #66473B',
    borderRadius: '4px',
    color: '#B6A596',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'General Sans', 'Inter', system-ui, sans-serif",
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#66473B',
            animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: LocalMessage }) {
  const isBot = message.role === 'assistant'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isBot ? 'row' : 'row-reverse',
        gap: '8px',
        alignItems: 'flex-start',
        animation: 'messageSlideIn 0.3s ease-out',
      }}
    >
      {/* Avatar */}
      {isBot && (
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            background: 'rgba(220,159,133,0.12)',
            border: '1px solid rgba(220,159,133,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Bot size={15} color="#DC9F85" />
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: '4px',
          background: isBot ? '#1E1A18' : 'rgba(220,159,133,0.1)',
          border: isBot ? '1px solid #35211A' : '1px solid rgba(220,159,133,0.25)',
          color: isBot ? '#EBDCC4' : '#EBDCC4',
          fontSize: '13.5px',
          lineHeight: '1.6',
          wordBreak: 'break-word' as const,
        }}
      >
        {message.isTyping ? (
          <TypingDots />
        ) : isBot ? (
          <div className="chat-markdown">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <span>{message.content}</span>
        )}
      </div>
    </div>
  )
}

// ── Step progress indicator ────────────────────────────────────────────────────
function StepBadge({ step }: { step: string }) {
  const stepLabels: Record<string, { label: string; color: string }> = {
    collect_details: { label: 'Collecting Details', color: '#B6A596' },
    collect_job_title_and_skills: { label: 'Job Details', color: '#B6A596' },
    collect_experience: { label: 'Experience', color: '#B6A596' },
    collect_location: { label: 'Location', color: '#B6A596' },
    collect_budget: { label: 'Budget', color: '#B6A596' },
    collect_additional_requirements: { label: 'Requirements', color: '#B6A596' },
    confirmation: { label: 'Confirm Request', color: '#DC9F85' },
    jd_generation: { label: 'Generating JD', color: '#DC9F85' },
    jd_review: { label: 'Review JD', color: '#DC9F85' },
    workflow_running: { label: 'Workflow Active', color: '#8ab4a0' },
    complete: { label: 'Complete ✓', color: '#8ab4a0' },
  }

  const info = stepLabels[step] || { label: step, color: '#7A6A5E' }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 9px',
        borderRadius: '4px',
        background: `${info.color}18`,
        border: `1px solid ${info.color}40`,
        color: info.color,
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily: "'General Sans', 'Inter', sans-serif",
      }}
    >
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: info.color }} />
      {info.label}
    </div>
  )
}

// ── Main Chatbot Component ─────────────────────────────────────────────────────
export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState('greeting')
  const [workflowTriggered, setWorkflowTriggered] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [jdContent, setJdContent] = useState<string | null>(null)
  const [inputHeight, setInputHeight] = useState('42px')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Dynamically auto-resize the chat input textarea as content changes
  useEffect(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      // Clamp height between 42px and 150px
      const newHeight = Math.min(Math.max(scrollHeight, 42), 150)
      setInputHeight(`${newHeight}px`)
    }
  }, [inputValue])

  // Restore chatbot session on mount
  useEffect(() => {
    const initSession = async () => {
      const savedSessionId = localStorage.getItem('hiring_chatbot_session_id')
      if (savedSessionId) {
        try {
          const session = await chatbotApi.getSession(savedSessionId)
          setSessionId(session.session_id)
          setCurrentStep(session.step)
          if (session.jd_content) {
            setJdContent(session.jd_content)
          }
          if (session.step === 'complete' || session.workflow_session_id) {
            setWorkflowTriggered(true)
          }
          
          // Map messages
          const mapped = session.messages.map((m: any, idx: number) => ({
            id: `msg-saved-${idx}-${Date.now()}`,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp)
          }))
          setMessages(mapped)
        } catch (err) {
          console.error("Failed to restore chatbot session", err)
          localStorage.removeItem('hiring_chatbot_session_id')
        }
      }
    }
    initSession()
  }, [])

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const addMessage = (role: 'user' | 'assistant', content: string): string => {
    const id = `msg-${Date.now()}-${Math.random()}`
    setMessages(prev => [...prev, { id, role, content, timestamp: new Date() }])
    return id
  }

  const addTypingIndicator = (): string => {
    const id = `typing-${Date.now()}`
    setMessages(prev => [...prev, { id, role: 'assistant', content: '', timestamp: new Date(), isTyping: true }])
    return id
  }

  const removeTypingIndicator = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  // Open chat and start session
  const handleOpen = async () => {
    setIsOpen(true)
    setIsMinimized(false)

    if (!sessionId) {
      setIsLoading(true)
      const typingId = addTypingIndicator()
      try {
        const session = await chatbotApi.startSession()
        setSessionId(session.session_id)
        localStorage.setItem('hiring_chatbot_session_id', session.session_id)
        setCurrentStep(session.step)
        removeTypingIndicator(typingId)
        addMessage('assistant', session.welcome_message)
      } catch (err) {
        removeTypingIndicator(typingId)
        addMessage('assistant',
          "👋 Hello! I'm your **AI Hiring Assistant**. I'm having trouble connecting to the server right now. Please make sure the backend is running and try again."
        )
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading || !sessionId) return

    setInputValue('')
    addMessage('user', text)
    setIsLoading(true)

    const typingId = addTypingIndicator()

    try {
      const response = await chatbotApi.sendMessage(sessionId, text)
      removeTypingIndicator(typingId)
      addMessage('assistant', response.bot_message)
      setCurrentStep(response.step)

      if (response.jd_content) {
        setJdContent(response.jd_content)
      }

      if (response.workflow_triggered) {
        setWorkflowTriggered(true)
        // Invalidate jobs cache so Job Management shows the new job immediately
        queryClient.invalidateQueries({ queryKey: ['jobs'] })
      }
    } catch (err) {
      removeTypingIndicator(typingId)
      addMessage('assistant',
        "I'm having trouble connecting to the server. Please check that the backend is running on port 8000."
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter is allowed to make a newline in textarea
      } else {
        e.preventDefault()
        handleSend()
      }
    }
  }

  const downloadPDF = async () => {
    if (!sessionId) return
    try {
      const response = await apiClient.get(`/chatbot/session/${sessionId}/download-jd/pdf`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `JD_${sessionId.substring(0, 8)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("PDF download failed", err)
    }
  }

  const downloadDOCX = async () => {
    if (!sessionId) return
    try {
      const response = await apiClient.get(`/chatbot/session/${sessionId}/download-jd/doc`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `JD_${sessionId.substring(0, 8)}.docx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Word download failed", err)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Styles moved to the bottom of the file to completely solve typing lag */}

      {/* ── Trigger Button ───────────────────────────────────────────────────── */}
      {!isOpen && (
        <button
          className="trigger-btn"
          onClick={handleOpen}
          style={styles.trigger}
          title="Open AI Hiring Assistant"
        >
          <Bot size={20} />
          <span>AI Hiring Assistant</span>
          {hasUnread && (
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#f59e0b', position: 'absolute', top: '8px', right: '8px',
            }} />
          )}
        </button>
      )}

      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="chat-panel-open"
          style={{
            ...styles.panel,
            transform: isMinimized ? 'translateY(calc(100vh - 64px))' : 'translateX(0)',
          }}
        >
          {/* ── Header ────────────────────────────────────────────────────── */}
          <div style={styles.header}>
            {/* Bot icon + title */}
            <div style={{
              width: '38px', height: '38px', borderRadius: '4px',
              background: 'rgba(220,159,133,0.1)',
              border: '1px solid rgba(220,159,133,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={18} color="#DC9F85" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#EBDCC4', lineHeight: 1.2, fontFamily: "'Clash Grotesk', 'General Sans', sans-serif", letterSpacing: '0.01em' }}>
                AI Hiring Assistant
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isLoading ? '#DC9F85' : '#8ab4a0',
                  boxShadow: isLoading ? '0 0 8px rgba(220,159,133,0.6)' : 'none',
                  animation: isLoading ? 'chatPulse 1.5s infinite' : 'none',
                }} />
                <span style={{ fontSize: '10px', color: isLoading ? '#DC9F85' : '#7A6A5E', fontWeight: isLoading ? 600 : 400, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {isLoading ? 'Typing...' : workflowTriggered ? 'Workflow Running' : 'Online'}
                </span>
                {workflowTriggered && <Workflow size={11} color="#8ab4a0" />}
              </div>
            </div>
            {/* Step badge */}
            <StepBadge step={currentStep} />
            {/* Controls */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{
                  background: 'none', border: 'none', color: '#7A6A5E',
                  cursor: 'pointer', padding: '4px', borderRadius: '4px',
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s',
                }}
                title="Minimize"
              >
                <ChevronDown size={16} />
              </button>
              <button
                onClick={handleClose}
                style={{
                  background: 'none', border: 'none', color: '#7A6A5E',
                  cursor: 'pointer', padding: '4px', borderRadius: '4px',
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s',
                }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Workflow triggered banner ────────────────────────────────── */}
          {workflowTriggered && (
            <div style={{
              padding: '10px 16px',
              background: 'rgba(138,180,160,0.07)',
              borderBottom: '1px solid rgba(138,180,160,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#8ab4a0',
              flexShrink: 0,
              letterSpacing: '0.03em',
            }}>
              <CheckCircle size={14} color="#8ab4a0" />
              <span>Hiring workflow is running — <strong style={{ color: '#EBDCC4' }}>check Workflow Monitor</strong> for live progress</span>
            </div>
          )}

          {/* ── Messages ──────────────────────────────────────────────────── */}
          <div
            className="chat-messages"
            style={styles.messages}
          >
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#7A6A5E', fontSize: '12px', textAlign: 'center',
                padding: '24px', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <MessageSquare size={32} color="#35211A" style={{ marginBottom: '12px' }} />
                <p style={{ margin: 0 }}>Starting AI Hiring Assistant...</p>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area ────────────────────────────────────────────────── */}
          <div style={styles.inputArea}>
            {/* Quick action hints based on step */}
            {currentStep === 'jd_review' && (
              <div style={{
                display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' as const,
              }}>
                {['approve', 'Make it more detailed', 'Add remote work policy'].map(hint => (
                  <button
                    key={hint}
                    onClick={() => {
                      setInputValue(hint)
                      inputRef.current?.focus()
                    }}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(220,159,133,0.08)',
                      border: '1px solid rgba(220,159,133,0.25)',
                      borderRadius: '4px',
                      color: '#DC9F85',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'General Sans', 'Inter', sans-serif",
                      transition: 'all 0.15s',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}
            {currentStep === 'confirmation' && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <button
                  onClick={() => setInputValue('confirm')}
                  style={{
                    padding: '4px 14px',
                    background: 'rgba(138,180,160,0.08)',
                    border: '1px solid rgba(138,180,160,0.25)',
                    borderRadius: '4px',
                    color: '#8ab4a0',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'General Sans', 'Inter', sans-serif",
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  ✓ Confirm
                </button>
                <button
                  onClick={() => setInputValue('Make changes to ')}
                  style={{
                    padding: '4px 14px',
                    background: 'rgba(176,112,112,0.08)',
                    border: '1px solid rgba(176,112,112,0.25)',
                    borderRadius: '4px',
                    color: '#b07070',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'General Sans', 'Inter', sans-serif",
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  ✎ Edit
                </button>
              </div>
            )}

            {/* Download Options (PDF and DOCX both) */}
            {jdContent && (
              <div style={{
                display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center'
              }}>
                <span style={{ fontSize: '10px', color: '#7A6A5E', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Download:</span>
                <button onClick={downloadPDF} style={styles.downloadBtn}>
                  <Download size={11} />
                  PDF
                </button>
                <button onClick={downloadDOCX} style={styles.downloadBtn}>
                  <Download size={11} />
                  Word
                </button>
              </div>
            )}

            {/* Input row */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                className="chat-input"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentStep === 'complete'
                    ? 'Workflow is running...'
                    : 'Type your message (Shift+Enter for newline)...'
                }
                disabled={isLoading || currentStep === 'complete'}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'rgba(235,220,196,0.03)',
                  border: '1px solid #35211A',
                  borderRadius: '4px',
                  color: '#EBDCC4',
                  fontSize: '13.5px',
                  fontFamily: "'General Sans', 'Inter', system-ui, sans-serif",
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  resize: 'none' as const,
                  height: inputHeight,
                  overflowY: inputRef.current && inputRef.current.scrollHeight > 150 ? 'auto' : 'hidden',
                  lineHeight: '1.4',
                }}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim() || currentStep === 'complete'}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px',
                  background: isLoading || !inputValue.trim()
                    ? 'rgba(220,159,133,0.1)'
                    : '#DC9F85',
                  border: '1px solid',
                  borderColor: isLoading || !inputValue.trim() ? '#35211A' : '#DC9F85',
                  color: isLoading || !inputValue.trim() ? '#66473B' : '#181818',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                  boxShadow: inputValue.trim() ? '0 4px 12px rgba(220,159,133,0.25)' : 'none',
                }}
              >
                {isLoading ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>

            {/* Footer hint */}
            <div style={{
              marginTop: '8px',
              fontSize: '10px',
              color: '#35211A',
              textAlign: 'center' as const,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Powered by Gemini AI • Shift+Enter for newline
            </div>
          </div>
        </div>
      )}
      
      {/* ── Global CSS (Rendered statically outside the component to eliminate typing lag) ── */}
      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,159,133,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(220,159,133,0); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes messageSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .chat-panel-open {
          animation: panelSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .chat-messages::-webkit-scrollbar {
          width: 4px;
        }
        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-messages::-webkit-scrollbar-thumb {
          background: #35211A;
          border-radius: 2px;
        }
        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: #66473B;
        }
        .chat-markdown p { margin: 0 0 8px 0; }
        .chat-markdown p:last-child { margin-bottom: 0; }
        .chat-markdown ul, .chat-markdown ol { margin: 6px 0 8px 16px; padding: 0; }
        .chat-markdown li { margin-bottom: 3px; }
        .chat-markdown strong { color: #DC9F85; font-weight: 600; }
        .chat-markdown em { color: #B6A596; }
        .chat-markdown h1, .chat-markdown h2, .chat-markdown h3 { 
          color: #EBDCC4; 
          margin: 10px 0 6px 0; 
          font-size: 13px;
          font-weight: 700;
          font-family: 'Clash Grotesk', 'General Sans', sans-serif;
          letter-spacing: 0.01em;
        }
        .chat-markdown hr {
          border: none;
          border-top: 1px solid #35211A;
          margin: 10px 0;
        }
        .chat-markdown code {
          background: rgba(220,159,133,0.1);
          border: 1px solid rgba(220,159,133,0.2);
          padding: 1px 5px;
          border-radius: 2px;
          font-size: 12px;
          color: #DC9F85;
        }
        .chat-input::placeholder { color: #35211A; }
        .chat-input:focus {
          outline: none;
          border-color: #66473B !important;
          box-shadow: 0 0 0 3px rgba(220,159,133,0.06);
        }
        .send-btn:hover:not(:disabled) {
          opacity: 0.85;
          transform: scale(1.03);
        }
        .trigger-btn:hover {
          border-color: #DC9F85 !important;
          color: #DC9F85 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
        }
        .chat-download-btn:hover {
          border-color: #DC9F85 !important;
          color: #DC9F85 !important;
        }
      `}</style>
    </>
  )
}
