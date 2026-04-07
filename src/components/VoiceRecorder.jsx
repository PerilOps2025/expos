import { useState, useRef, useEffect } from 'react'

export default function VoiceRecorder({ onTranscript }) {
  const [state, setState] = useState('idle') // idle | listening | processing | done | error | unsupported
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setState('unsupported')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-IN'
    recognition.maxAlternatives = 1

    recognition.onstart = () => setState('listening')

    recognition.onresult = (e) => {
      let interim = ''
      let final = ''
      for (const result of e.results) {
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(final || interim)
    }

    recognition.onend = () => {
      setState(prev => prev === 'listening' ? 'processing' : prev)
    }

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') {
        setState('idle')
        return
      }
      setError(e.error)
      setState('error')
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (state === 'processing' && transcript) {
      // Small delay to let the transcript finalize
      timeoutRef.current = setTimeout(() => {
        setState('done')
      }, 400)
    }
  }, [state, transcript])

  function startRecording() {
    setTranscript('')
    setError('')
    setState('listening')
    recognitionRef.current?.start()
  }

  function stopRecording() {
    recognitionRef.current?.stop()
  }

  function handleUse() {
    if (transcript.trim()) {
      onTranscript(transcript.trim())
      setTranscript('')
      setState('idle')
    }
  }

  function handleDiscard() {
    setTranscript('')
    setState('idle')
  }

  if (state === 'unsupported') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
        <p className="text-gray-600 text-sm">Voice capture not supported in this browser</p>
        <p className="text-gray-700 text-xs mt-1">Use Chrome on Android or Safari on iOS</p>
      </div>
    )
  }

  const PULSE_RING = state === 'listening'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex flex-col items-center gap-4">
        {/* Record button */}
        <div className="relative">
          {PULSE_RING && (
            <>
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              <div className="absolute inset-0 scale-110 rounded-full bg-red-500/10 animate-ping" style={{ animationDelay: '0.3s' }} />
            </>
          )}
          <button
            onClick={state === 'listening' ? stopRecording : startRecording}
            disabled={state === 'processing'}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              state === 'listening'
                ? 'bg-red-600 hover:bg-red-500 scale-110'
                : state === 'processing'
                ? 'bg-gray-700 cursor-wait'
                : 'bg-gray-800 hover:bg-gray-700 active:scale-95'
            }`}
          >
            {state === 'listening' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : state === 'processing' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </circle>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <rect x="9" y="2" width="6" height="12" rx="3"/>
                <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>

        {/* State label */}
        <p className="text-gray-500 text-sm">
          {state === 'idle' && 'Tap to speak'}
          {state === 'listening' && 'Listening — tap to stop'}
          {state === 'processing' && 'Processing...'}
          {state === 'done' && 'Ready'}
          {state === 'error' && `Error: ${error}`}
        </p>

        {/* Live transcript */}
        {transcript && (
          <div className="w-full bg-gray-800 rounded-xl px-4 py-3">
            <p className="text-gray-300 text-sm leading-relaxed">{transcript}</p>
          </div>
        )}

        {/* Actions after done */}
        {state === 'done' && transcript && (
          <div className="flex gap-3 w-full">
            <button
              onClick={handleDiscard}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm py-2.5 rounded-xl transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleUse}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Use transcript →
            </button>
          </div>
        )}

        {/* Tip */}
        {state === 'idle' && (
          <p className="text-gray-700 text-xs text-center">
            Speak your task — transcript appears in the capture box for review
          </p>
        )}
      </div>
    </div>
  )
}