'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Browser speech-to-text (Chrome / Edge / Safari). Appends transcript into
 * the linked field via onTranscript.
 */
export function DictationButton({
  onTranscript,
  disabled,
  className,
  label = 'Speak',
}: {
  onTranscript: (text: string, meta: { isFinal: boolean }) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function stop() {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  function start() {
    setError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('Voice dictation needs Chrome, Edge, or Safari.');
      return;
    }

    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalChunk += piece;
        else interim += piece;
      }
      if (finalChunk.trim()) {
        onTranscript(finalChunk.trim(), { isFinal: true });
      } else if (interim.trim()) {
        onTranscript(interim.trim(), { isFinal: false });
      }
    };

    recognition.onerror = (event) => {
      const code = event.error || 'error';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone blocked — allow mic access in the browser.');
      } else if (code === 'no-speech') {
        setError('No speech heard — try again.');
      } else if (code !== 'aborted') {
        setError(`Voice error: ${code}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError('Could not start microphone.');
      setListening(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-[11px] text-ink-400">
        Voice dictation needs Chrome, Edge, or Safari on this device.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (listening ? stop() : start())}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
          listening
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
          disabled && 'opacity-50'
        )}
        title={listening ? 'Stop listening' : 'Dictate with microphone'}
      >
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            listening ? 'animate-pulse bg-white' : 'bg-red-500'
          )}
        />
        {listening ? 'Listening… tap to stop' : label}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

/** Controlled textarea with a mic that appends (final) speech. */
export function DictationField({
  value,
  onChange,
  rows = 3,
  placeholder,
  className,
  disabled,
  micLabel = 'Speak',
  name,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  micLabel?: string;
  name?: string;
  id?: string;
}) {
  const interimRef = useRef('');
  const baseRef = useRef(value);

  useEffect(() => {
    // Keep base in sync when not mid-interim
    if (!interimRef.current) baseRef.current = value;
  }, [value]);

  return (
    <div className="space-y-2">
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          interimRef.current = '';
          baseRef.current = e.target.value;
          onChange(e.target.value);
        }}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4',
          className
        )}
      />
      <DictationButton
        disabled={disabled}
        label={micLabel}
        onTranscript={(text, { isFinal }) => {
          if (isFinal) {
            const base = baseRef.current || '';
            const next = base.trim() ? `${base.trim()} ${text}` : text;
            interimRef.current = '';
            baseRef.current = next;
            onChange(next);
          } else {
            // Live preview: base + interim
            const base = baseRef.current || '';
            interimRef.current = text;
            const next = base.trim() ? `${base.trim()} ${text}` : text;
            onChange(next);
          }
        }}
      />
    </div>
  );
}
