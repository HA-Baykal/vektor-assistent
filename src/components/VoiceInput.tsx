"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type VoiceInputProps = {
  onResult: (text: string) => void;
  placeholder?: string;
  mode?: "task" | "deal" | "auto";
};

const SILENCE_TIMEOUT = 2000; // 2 секунды тишины → автозавершение

export default function VoiceInput({
  onResult,
  placeholder = "Напишите или нажмите микрофон...",
  mode = "auto",
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFinalRef = useRef<string>(""); // последний финальный текст
  const isProcessingRef = useRef(false); // защита от двойного submit

  // Очистка таймера тишины
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Сброс таймера тишины (продлевает запись)
  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // 2 секунды тишины — автостоп + автоотправка
      const currentText = lastFinalRef.current.trim();
      if (currentText && !isProcessingRef.current) {
        isProcessingRef.current = true;
        stopListening();
        onResult(currentText);
        setTranscript("");
        lastFinalRef.current = "";
        setTimeout(() => { isProcessingRef.current = false; }, 500);
      } else {
        stopListening();
      }
    }, SILENCE_TIMEOUT);
  }, [onResult, clearSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    setError("");
    setTranscript("");
    lastFinalRef.current = "";
    isProcessingRef.current = false;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Ваш браузер не поддерживает распознавание речи. Используйте Chrome или Edge."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        lastFinalRef.current += finalTranscript;
        // Сбрасываем таймер тишины при каждом новом фрагменте речи
        resetSilenceTimer();
      }

      setTranscript(lastFinalRef.current + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setError("Речь не распознана. Попробуйте ещё раз.");
      } else if (event.error === "aborted") {
        // Это нормально — мы сами остановили запись
      } else {
        setError(`Ошибка: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Если запись закончилась сама (не по нашей команде) — отправляем
      const finalText = lastFinalRef.current.trim();
      if (finalText && !isProcessingRef.current) {
        isProcessingRef.current = true;
        onResult(finalText);
        setTranscript("");
        lastFinalRef.current = "";
        setTimeout(() => { isProcessingRef.current = false; }, 500);
      }
      clearSilenceTimer();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    // Запускаем таймер тишины сразу — если 2 сек нет речи, остановимся
    resetSilenceTimer();
  }, [onResult, resetSilenceTimer, clearSilenceTimer]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [clearSilenceTimer]);

  const handleSubmit = useCallback(() => {
    if (transcript.trim() && !isProcessingRef.current) {
      isProcessingRef.current = true;
      if (isListening) stopListening();
      onResult(transcript.trim());
      setTranscript("");
      lastFinalRef.current = "";
      setTimeout(() => { isProcessingRef.current = false; }, 500);
    }
  }, [transcript, isListening, stopListening, onResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full">
      <div className="relative flex items-start gap-2">
        {/* Текстовое поле */}
        <div className="relative flex-1">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            className="w-full resize-none rounded-2xl border-2 border-white/30 bg-white/20 px-4 py-3 pr-4 text-sm text-white shadow-inner outline-none backdrop-blur-sm transition-all placeholder:text-white/40 focus:border-white/50 focus:bg-white/25"
          />

          {/* Индикатор записи */}
          {isListening && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
              <span className="flex gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="h-3 w-0.5 animate-pulse rounded-full bg-white"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      height: `${8 + i * 3}px`,
                    }}
                  />
                ))}
              </span>
              <span className="ml-1 text-xs font-medium text-white/70">
                Слушаю...
              </span>
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex shrink-0 flex-col gap-2">
          {isListening ? (
            <button
              onClick={() => {
                stopListening();
                // Если есть текст — отправляем
                const finalText = lastFinalRef.current.trim() || transcript.trim();
                if (finalText && !isProcessingRef.current) {
                  isProcessingRef.current = true;
                  onResult(finalText);
                  setTranscript("");
                  lastFinalRef.current = "";
                  setTimeout(() => { isProcessingRef.current = false; }, 500);
                }
              }}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500 text-white shadow-lg transition active:scale-90 hover:bg-red-600 touch-target"
              aria-label="Остановить запись"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={startListening}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-white shadow-lg backdrop-blur-sm transition active:scale-90 hover:bg-white/30 touch-target"
              aria-label="Начать запись"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!transcript.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg transition active:scale-90 hover:bg-emerald-600 disabled:opacity-30 disabled:active:scale-100 touch-target"
            aria-label="Отправить"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-2">
          <span className="text-xs text-red-200">⚠️</span>
          <p className="text-xs font-medium text-red-100">{error}</p>
        </div>
      )}
    </div>
  );
}
