'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTIONS = [
  'Where is job costing? I only see Settings and Reports.',
  'How do I import customers from Housecall Pro?',
  'How do I start a new job from a customer site?',
  'What’s on the Reports page with costing on?',
];

const STORAGE_KEY = 'easydispatch-help-chat-v1';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    'Hi — I’m the EasyDispatch help bot. Ask about customers, jobs, calendar, estimates, or the tech app while you work. Browse the FAQ anytime for quick answers.',
};

function loadMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [WELCOME];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed) || !parsed.length) return [WELCOME];
    return parsed.filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    );
  } catch {
    return [WELCOME];
  }
}

type HelpChatProps = {
  /** Embedded on Help page vs panel inside floating widget */
  variant?: 'page' | 'panel';
  faqHref?: string;
  className?: string;
  onClose?: () => void;
};

export function HelpChat({
  variant = 'page',
  faqHref = '/faq',
  className,
  onClose,
}: HelpChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages(loadMessages());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore quota */
    }
  }, [messages, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (variant === 'panel') {
      inputRef.current?.focus();
    }
  }, [variant]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Help chat failed');
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'Sorry — no reply.' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Help chat failed');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'I couldn’t answer just now. Open Help → FAQ, or try again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function clearChat() {
    setMessages([WELCOME]);
    setError(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const isPanel = variant === 'panel';

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden bg-white',
        isPanel
          ? 'h-full rounded-2xl border border-ink-200 shadow-2xl'
          : 'h-[min(28rem,70vh)] rounded-xl border border-slate-200 shadow-sm',
        className
      )}
    >
      <div
        className={cn(
          'flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3',
          isPanel ? 'bg-brand-600 text-white' : 'bg-slate-50'
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-semibold',
              isPanel ? 'text-white' : 'text-slate-900'
            )}
          >
            Ask EasyDispatch
          </p>
          <p
            className={cn(
              'text-xs',
              isPanel ? 'text-brand-100' : 'text-slate-500'
            )}
          >
            AI help while you work
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={clearChat}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium',
              isPanel
                ? 'text-brand-100 hover:bg-white/10 hover:text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            )}
          >
            Clear
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close help chat"
              className="rounded-md px-2 py-1 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {loading ? (
          <p className="text-xs text-slate-400">Thinking…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 ? (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left text-[11px] text-slate-600 hover:border-sky-300 hover:bg-sky-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="px-4 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="border-t border-slate-200">
        <form onSubmit={onSubmit} className="flex gap-2 p-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={loading}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <p className="border-t border-slate-100 px-3 py-2 text-center text-[11px] text-slate-400">
          <Link href={faqHref} className="font-medium text-sky-700 hover:underline">
            Open FAQ
          </Link>
        </p>
      </div>
    </div>
  );
}
