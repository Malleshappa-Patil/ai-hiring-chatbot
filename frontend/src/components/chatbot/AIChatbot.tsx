import { useState, useRef, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { chatbotApi } from '@/api/chatbot'

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
  // Trigger button
  trigger: {
    position: 'fixed' as const,
    bottom: '28px',
    right: '28px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 22px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
    border: 'none',
    borderRadius: '50px',
    color: 'white',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 24px rgba(99,102,241,0.5), 0 0 0 0 rgba(99,102,241,0.4)',
    animation: 'chatPulse 2.5s ease-in-out infinite',
    transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
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
    background: 'rgba(13, 13, 30, 0.97)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderLeft: '1px solid rgba(99,102,241,0.2)',
    boxShadow: '-8px 0 48px rgba(0,0,0,0.5), -1px 0 0 rgba(99,102,241,0.15)',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  // Header
  header: {
    padding: '18px 20px',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
    borderBottom: '1px solid rgba(99,102,241,0.2)',
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
  },
  // Input area
  inputArea: {
    padding: '16px',
    borderTop: '1px solid rgba(99,102,241,0.15)',
    background: 'rgba(255,255,255,0.02)',
    flexShrink: 0,
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
            background: '#818cf8',
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
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Bot size={15} color="white" />
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isBot ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
          background: isBot
            ? 'rgba(255,255,255,0.06)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: isBot ? '1px solid rgba(255,255,255,0.08)' : 'none',
          color: '#e2e8f0',
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
    collect_job_title_and_skills: { label: 'Job Details', color: '#818cf8' },
    collect_experience: { label: 'Experience', color: '#818cf8' },
    collect_department: { label: 'Department', color: '#818cf8' },
    collect_location: { label: 'Location', color: '#818cf8' },
    collect_budget: { label: 'Budget', color: '#818cf8' },
    collect_additional_requirements: { label: 'Requirements', color: '#818cf8' },
    confirmation: { label: 'Confirm Request', color: '#f59e0b' },
    jd_generation: { label: 'Generating JD', color: '#8b5cf6' },
    jd_review: { label: 'Review JD', color: '#f59e0b' },
    workflow_running: { label: 'Workflow Active', color: '#10b981' },
    complete: { label: 'Complete ✓', color: '#10b981' },
  }

  const info = stepLabels[step] || { label: step, color: '#64748b' }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 9px',
        borderRadius: '20px',
        background: `${info.color}18`,
        border: `1px solid ${info.color}40`,
        color: info.color,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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

      if (response.workflow_triggered) {
        setWorkflowTriggered(true)
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Global CSS ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 4px 24px rgba(99,102,241,0.5), 0 0 0 0 rgba(99,102,241,0.4); }
          50% { box-shadow: 0 4px 32px rgba(99,102,241,0.7), 0 0 0 8px rgba(99,102,241,0); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes messageSlideIn {
          from { opacity: 0; transform: translateY(10px); }
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
          background: rgba(99,102,241,0.3);
          border-radius: 2px;
        }
        .chat-markdown p { margin: 0 0 8px 0; }
        .chat-markdown p:last-child { margin-bottom: 0; }
        .chat-markdown ul, .chat-markdown ol { margin: 6px 0 8px 16px; padding: 0; }
        .chat-markdown li { margin-bottom: 3px; }
        .chat-markdown strong { color: #c4b5fd; font-weight: 600; }
        .chat-markdown em { color: #a5b4fc; }
        .chat-markdown h1, .chat-markdown h2, .chat-markdown h3 { 
          color: #e2e8f0; 
          margin: 10px 0 6px 0; 
          font-size: 13px;
          font-weight: 700;
        }
        .chat-markdown hr {
          border: none;
          border-top: 1px solid rgba(99,102,241,0.2);
          margin: 10px 0;
        }
        .chat-markdown code {
          background: rgba(99,102,241,0.15);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
        }
        .chat-input:focus {
          outline: none;
          border-color: rgba(99,102,241,0.6) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .send-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
          transform: scale(1.05);
        }
        .trigger-btn:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 8px 32px rgba(99,102,241,0.6) !important;
        }
      `}</style>

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
              width: '38px', height: '38px', borderRadius: '11px',
              background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>
              <Sparkles size={18} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#e2e8f0', lineHeight: 1.2 }}>
                AI Hiring Assistant
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isLoading ? '#818cf8' : '#10b981',
                  boxShadow: isLoading ? '0 0 8px #818cf8' : 'none',
                  animation: isLoading ? 'chatPulse 1.5s infinite' : 'none',
                }} />
                <span style={{ fontSize: '11px', color: isLoading ? '#818cf8' : '#64748b', fontWeight: isLoading ? 600 : 400 }}>
                  {isLoading ? 'Typing...' : workflowTriggered ? 'Workflow Running' : 'Online'}
                </span>
                {workflowTriggered && <Workflow size={11} color="#10b981" />}
              </div>
            </div>
            {/* Step badge */}
            <StepBadge step={currentStep} />
            {/* Controls */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{
                  background: 'none', border: 'none', color: '#64748b',
                  cursor: 'pointer', padding: '4px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center',
                }}
                title="Minimize"
              >
                <ChevronDown size={16} />
              </button>
              <button
                onClick={handleClose}
                style={{
                  background: 'none', border: 'none', color: '#64748b',
                  cursor: 'pointer', padding: '4px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center',
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
              background: 'rgba(16,185,129,0.08)',
              borderBottom: '1px solid rgba(16,185,129,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#6ee7b7',
              flexShrink: 0,
            }}>
              <CheckCircle size={14} color="#10b981" />
              <span>Hiring workflow is running — <strong>check Workflow Monitor</strong> for live progress</span>
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
                color: '#475569', fontSize: '13px', textAlign: 'center',
                padding: '24px',
              }}>
                <MessageSquare size={32} color="#334155" style={{ marginBottom: '12px' }} />
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
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      borderRadius: '20px',
                      color: '#a5b4fc',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      transition: 'all 0.15s',
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
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '20px',
                    color: '#6ee7b7',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  ✓ Confirm
                </button>
                <button
                  onClick={() => setInputValue('Make changes to ')}
                  style={{
                    padding: '4px 14px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '20px',
                    color: '#fca5a5',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  ✎ Edit
                </button>
              </div>
            )}

            {/* Input row */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <input
                ref={inputRef}
                className="chat-input"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentStep === 'complete'
                    ? 'Workflow is running...'
                    : 'Type your message...'
                }
                disabled={isLoading || currentStep === 'complete'}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                  fontSize: '13.5px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  resize: 'none' as const,
                }}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim() || currentStep === 'complete'}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '11px',
                  background: isLoading || !inputValue.trim()
                    ? 'rgba(99,102,241,0.2)'
                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                  boxShadow: inputValue.trim() ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
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
              fontSize: '11px',
              color: '#334155',
              textAlign: 'center' as const,
            }}>
              Powered by Gemini AI • Press Enter to send
            </div>
          </div>
        </div>
      )}
    </>
  )
}
