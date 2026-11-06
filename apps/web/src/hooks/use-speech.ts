'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CharacterVoicePreference } from '@niva/shared-types';

// ============================================================================
// 1. SPEECH RECOGNITION (STT) HOOK
// ============================================================================

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
}

export function useSpeechRecognition(onResultCallback?: (text: string) => void): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const callbackRef = useRef(onResultCallback);
  const isIntentionalStopRef = useRef(false);
  const finalAccumulatorRef = useRef('');

  // Keep callback ref updated without triggering effect re-runs
  useEffect(() => {
    callbackRef.current = onResultCallback;
  }, [onResultCallback]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';

        // Process results from resultIndex to accurately separate new final vs interim
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            const trimmed = text.trim();
            if (trimmed) {
              finalAccumulatorRef.current = finalAccumulatorRef.current
                ? `${finalAccumulatorRef.current} ${trimmed}`
                : trimmed;
            }
          } else {
            interim += text;
          }
        }

        const cleanFinal = finalAccumulatorRef.current;
        const cleanInterim = interim.trim();
        const currentSessionTranscript = [cleanFinal, cleanInterim].filter(Boolean).join(' ');

        setTranscript(currentSessionTranscript);
        if (callbackRef.current) {
          callbackRef.current(currentSessionTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        // Distinguish intentional stops from genuine recognition errors
        if (isIntentionalStopRef.current || event.error === 'aborted') {
          isIntentionalStopRef.current = false;
          setIsListening(false);
          return;
        }

        if (event.error === 'no-speech') {
          // Normal silence timeout; non-blocking
          setIsListening(false);
          return;
        }

        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please enable microphone permissions in your browser settings.');
        } else if (event.error === 'audio-capture') {
          setError('No microphone found or microphone is busy.');
        } else if (event.error === 'network') {
          setError('Network error during speech recognition.');
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }

        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        isIntentionalStopRef.current = false;
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          isIntentionalStopRef.current = true;
          recognitionRef.current.stop();
        } catch {
          // Safe teardown
        }
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    isIntentionalStopRef.current = false;
    setError(null);
    setTranscript('');
    finalAccumulatorRef.current = '';

    try {
      recognitionRef.current.start();
    } catch (err: any) {
      if (err.name === 'InvalidStateError') {
        // Already started or restarting
        setIsListening(true);
      } else {
        setError(err.message || 'Failed to start microphone.');
        setIsListening(false);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    isIntentionalStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Safe stop
      }
    }
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    finalAccumulatorRef.current = '';
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}

// ============================================================================
// 2. TEXT TO SPEECH (TTS) HOOK
// ============================================================================

export interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  speak: (text: string, options?: CharacterVoicePreference) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  voices: SpeechSynthesisVoice[];
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available && available.length > 0) {
        setVoices(available);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    const checkInterval = setInterval(() => {
      if (window.speechSynthesis) {
        setIsSpeaking(window.speechSynthesis.speaking);
        setIsPaused(window.speechSynthesis.paused);
      }
    }, 250);

    return () => {
      clearInterval(checkInterval);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const findBestVoice = useCallback(
    (pref?: CharacterVoicePreference): SpeechSynthesisVoice | null => {
      if (!voices || voices.length === 0) return null;

      // 1. Try matching preferred voice name
      if (pref?.preferredVoiceName) {
        const exact = voices.find((v) =>
          v.name.toLowerCase().includes(pref.preferredVoiceName!.toLowerCase()),
        );
        if (exact) return exact;
      }

      // 2. Try matching language
      const lang = pref?.lang || 'en-US';
      const langMatches = voices.filter((v) => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)));

      if (langMatches.length > 0) {
        if (pref?.genderHint === 'male') {
          const male = langMatches.find((v) =>
            /male|david|george|mark|james|alex/i.test(v.name),
          );
          if (male) return male;
        } else if (pref?.genderHint === 'female') {
          const female = langMatches.find((v) =>
            /female|samantha|zira|susan|victoria|karen|catherine/i.test(v.name),
          );
          if (female) return female;
        }
        return langMatches[0] ?? null;
      }

      return voices[0] ?? null;
    },
    [voices],
  );

  const speak = useCallback(
    (text: string, options?: CharacterVoicePreference) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // Cancel any ongoing utterance
      window.speechSynthesis.cancel();

      // Clean markdown tags for clear reading
      const cleanText = text
        .replace(/[*_#`~]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voice = findBestVoice(options);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.pitch = options?.pitch ?? 1.0;
      utterance.rate = options?.rate ?? 1.0;
      utterance.lang = options?.lang || (voice ? voice.lang : 'en-US');

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [findBestVoice],
  );

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  return {
    isSpeaking,
    isPaused,
    isSupported,
    speak,
    stop,
    pause,
    resume,
    voices,
  };
}
