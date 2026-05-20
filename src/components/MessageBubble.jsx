import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const codeTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#0d0d16',
    borderRadius: '10px',
    margin: '10px 0',
    border: '1px solid rgba(255,255,255,0.07)',
  },
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group/code">
      <button
        onClick={copy}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium"
        style={{ background: 'rgba(255,255,255,0.08)', color: copied ? 'var(--accent-light)' : 'rgba(196,192,216,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{copied ? 'check' : 'content_copy'}</span>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <SyntaxHighlighter
        style={codeTheme}
        language={language}
        PreTag="div"
        customStyle={{ fontSize: '13px' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export default function MessageBubble({ role, content, isStreaming, isThinking, onRetry }) {
  const [copied, setCopied] = useState(false)
  const isUser = role === 'user'

  function copy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Thinking indicator ────────────────────────────────────────────────────────
  if (isThinking) {
    return (
      <div className="flex items-start gap-4 mb-6 px-1">
        <Avatar />
        <div className="flex items-center gap-1.5 mt-2.5">
          {[0, 160, 320].map(delay => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40"
              style={{ animation: `thinking-dot 1.4s ease-in-out ${delay}ms infinite` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── User message ──────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end mb-6 px-1">
        <div
          className="max-w-[72%] rounded-2xl rounded-br-sm px-4 py-3 text-[15px] leading-relaxed text-on-surface whitespace-pre-wrap"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.28) 0%, rgba(var(--accent-rgb),0.18) 100%)',
            border: '1px solid rgba(var(--accent-rgb),0.35)',
            boxShadow: '0 2px 12px rgba(var(--accent-rgb),0.12)',
          }}
        >
          {content}
        </div>
      </div>
    )
  }

  // ── Assistant message ─────────────────────────────────────────────────────────
  return (
    <div className="flex items-start gap-4 mb-8 px-1 group">
      <Avatar />
      <div className="flex-1 min-w-0 mt-0.5">
        <div
          className="prose max-w-none"
          style={{
            '--tw-prose-body':          '#d4d0e8',
            '--tw-prose-headings':      '#e4e1ed',
            '--tw-prose-lead':          '#b8b4cc',
            '--tw-prose-bold':          '#e4e1ed',
            '--tw-prose-counters':      '#8b88a0',
            '--tw-prose-bullets':       '#464454',
            '--tw-prose-hr':            '#2a2a3a',
            '--tw-prose-quotes':        '#d4d0e8',
            '--tw-prose-quote-borders': 'rgba(var(--accent-rgb),0.5)',
            '--tw-prose-captions':      '#8b88a0',
            '--tw-prose-code':          'var(--accent-light)',
            '--tw-prose-pre-code':      '#d4d0e8',
            '--tw-prose-pre-bg':        '#0d0d16',
            '--tw-prose-th-borders':    'rgba(255,255,255,0.1)',
            '--tw-prose-td-borders':    'rgba(255,255,255,0.06)',
            fontSize: '15px',
            lineHeight: '1.75',
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const codeStr = String(children).replace(/\n$/, '')
                return !inline && match ? (
                  <CodeBlock language={match[1]} code={codeStr} />
                ) : (
                  <code
                    className="font-mono text-[13px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-light)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}
                    {...props}
                  >
                    {children}
                  </code>
                )
              },
              a({ href, children }) {
                return (
                  <a href={href} target="_blank" rel="noreferrer"
                    className="accent-link underline underline-offset-2 transition-colors">
                    {children}
                  </a>
                )
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-3">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                )
              },
              th({ children }) {
                return (
                  <th className="px-4 py-2 text-left font-medium text-[#c0c1ff] text-[13px]"
                    style={{ borderBottom: '1px solid rgba(var(--accent-rgb),0.3)', background: 'rgba(var(--accent-rgb),0.08)' }}>
                    {children}
                  </th>
                )
              },
              td({ children }) {
                return (
                  <td className="px-4 py-2 text-[13px]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {children}
                  </td>
                )
              },
              blockquote({ children }) {
                return (
                  <blockquote className="pl-4 italic text-[#b8b4cc]"
                    style={{ borderLeft: '3px solid rgba(var(--accent-rgb),0.5)' }}>
                    {children}
                  </blockquote>
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-[3px] h-[1em] align-middle animate-pulse ml-0.5 rounded-sm" style={{ background: 'var(--accent)' }} />
          )}
        </div>

        {/* Actions — fade in on hover */}
        {!isStreaming && (
          <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-[12px] text-on-surface-variant/60 hover:text-on-surface-variant transition-colors px-1 py-0.5 rounded"
            >
              <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied' : 'Copy'}
            </button>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 text-[12px] text-on-surface-variant/60 hover:text-on-surface-variant transition-colors px-1 py-0.5 rounded"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Avatar() {
  return (
    <div
      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
      style={{
        background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.3), rgba(var(--accent-rgb),0.15))',
        border: '1px solid rgba(var(--accent-rgb),0.3)',
        boxShadow: '0 0 12px rgba(var(--accent-rgb),0.15)',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--accent-mid)' }}>smart_toy</span>
    </div>
  )
}
