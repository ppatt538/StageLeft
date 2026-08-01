import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Browser API shim ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionAPI: (new () => any) | null =
  typeof window !== 'undefined'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
    : null;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseSpeechRecognitionResult {
  /** Whether the browser supports the Web Speech API at all */
  supported: boolean;
  /** True while the mic is open and audio is being captured */
  listening: boolean;
  /** The committed (final) transcript text accumulated this session */
  transcript: string;
  /** In-flight partial text not yet finalised by the engine */
  interimTranscript: string;
  /** Start a new recording session (clears previous transcript) */
  start: () => void;
  /** Stop the current recording session */
  stop: () => void;
  /**
   * Last error code from the SpeechRecognitionErrorEvent, or null.
   * Common values: 'not-allowed', 'no-speech', 'network', 'aborted'.
   */
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const supported = !!SpeechRecognitionAPI;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    // Abort any live instance before starting fresh
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    setTranscript('');
    setInterimTranscript('');
    setError(null);

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;   // stop automatically after a pause
    recognition.interimResults = true; // fire events for partial results
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: {
      resultIndex: number;
      results: { isFinal: boolean; [i: number]: { transcript: string } }[];
    }) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalChunk += text;
        } else {
          interim += text;
        }
      }

      if (finalChunk) setTranscript((prev) => prev + finalChunk);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: { error: string }) => {
      setError(event.error);
      setListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('start-failed');
      setListening(false);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);

  return { supported, listening, transcript, interimTranscript, start, stop, error };
}
