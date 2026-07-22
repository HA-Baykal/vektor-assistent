"use client";

import { useState, useRef, useCallback } from "react";

type VoiceInputProps = {
  onResult: (text: string) => void;
  placeholder?: string;
  mode?: "task" | "deal" | "auto";
};

// Web Speech API — бесплатно, встроено в браузер
// Распознавание русской речи без отправки данных на сервер
export default function VoiceInput({
  onResult,
  placeholder = "Нажмите микрофони скажите задачу или сделку...",
  mode = "auto",
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    setError("");
    setTranscript("");

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
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      setError(`Ошибка: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const handleSubmit = () => {
    if (transcript.trim()) {
      onResult(transcript.trim());
      setTranscript("");
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-32 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          rows={3}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {isListening ? (
            <button
              onClick={stopListening}
              className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-red-600"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Стоп
            </button>
          ) : (
            <button
              onClick={startListening}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-700"
            >
              <MicIcon />
              Голос
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!transcript.trim()}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
      {isListening && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-end gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-indigo-500 animate-pulse"
                style={{
                  height: `${8 + Math.random() * 16}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-indigo-600">Слушаю...</span>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
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
  );
}
