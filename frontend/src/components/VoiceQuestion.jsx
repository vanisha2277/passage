import { useCallback, useEffect, useRef, useState } from 'react';
import { startLiveTranscription } from '../voice/deepgramStt.js';
import { prepareVoiceQuestion } from '../voice/prepareVoiceQuestion.js';
import { askVoiceQuestion } from '../api/passage.js';
import { extractTokens } from '../utils/redactedText.js';

const MIC_NUDGE =
  'Please type ID numbers — don\u2019t say them out loud. Spoken questions go to Deepgram; avoid speaking A-numbers, SSNs, or passport numbers.';

/**
 * @param {{
 *   sessionId: string,
 *   redactedContext: string,
 *   targetLanguage: string,
 *   tokenMap: Record<string, string>,
 * }} props
 */
export default function VoiceQuestion({ sessionId, redactedContext, targetLanguage, tokenMap }) {
  const [listening, setListening] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [redactedPreview, setRedactedPreview] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const stopRef = useRef(null);

  const stopMic = useCallback(async () => {
    if (stopRef.current) {
      await stopRef.current();
      stopRef.current = null;
    }
    setListening(false);
    setConnecting(false);
  }, []);

  useEffect(() => () => {
    void stopMic();
  }, [stopMic]);

  async function toggleMic() {
    setVoiceError(null);
    setAnswer(null);
    setRedactedPreview('');

    if (listening || connecting) {
      await stopMic();
      return;
    }

    setConnecting(true);
    setTranscript('');
    setInterim('');

    try {
      const stop = await startLiveTranscription({
        onTranscript: (text, isFinal) => {
          if (isFinal) {
            setTranscript((prev) => (prev ? `${prev} ${text}` : text).trim());
            setInterim('');
          } else {
            setInterim(text);
          }
        },
        onStatus: (status, detail) => {
          if (status === 'listening') {
            setConnecting(false);
            setListening(true);
          } else if (status === 'idle') {
            setListening(false);
            setConnecting(false);
          } else if (status === 'error') {
            setVoiceError(detail ?? 'Voice input failed');
            setListening(false);
            setConnecting(false);
          }
        },
      });
      stopRef.current = stop;
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : String(err));
      setConnecting(false);
      setListening(false);
    }
  }

  async function handleAskClaude() {
    const raw = [transcript, interim].filter(Boolean).join(interim && transcript ? ' ' : '').trim();
    if (!raw) {
      setVoiceError('Say or type a question first');
      return;
    }

    setAsking(true);
    setVoiceError(null);
    setAnswer(null);

    try {
      await stopMic();

      const { redacted } = await prepareVoiceQuestion(raw, sessionId, tokenMap);
      setRedactedPreview(redacted);

      const result = await askVoiceQuestion({
        transcript: redacted,
        sessionId,
        redactedContext,
        targetLanguage,
      });

      setAnswer(result);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  }

  const displayText = [transcript, interim].filter(Boolean).join(interim && transcript ? ' ' : '');
  const hasTokensInPreview = redactedPreview ? extractTokens(redactedPreview).length > 0 : false;

  return (
    <section
      className={`voice-question${listening || connecting ? ' is-live' : ''}`}
      aria-label="Ask about this document by voice"
    >
      <h3>Ask by voice</h3>
      <p className="hint">
        Your question is redacted in the browser before it reaches Claude — same pipeline as pasted text.
      </p>

      {(listening || connecting) && (
        <p className="voice-nudge" role="status" aria-live="polite">
          {MIC_NUDGE}
        </p>
      )}

      <div className="voice-controls">
        <button
          type="button"
          className={listening ? 'btn-mic btn-mic-live' : 'btn-mic'}
          onClick={toggleMic}
          disabled={connecting || asking}
          aria-pressed={listening}
        >
          {connecting ? 'Connecting…' : listening ? 'Stop microphone' : 'Start microphone'}
        </button>
        {listening && <span className="mic-indicator" aria-hidden="true" />}
        <button
          type="button"
          onClick={handleAskClaude}
          disabled={asking || listening || connecting || !displayText.trim()}
        >
          {asking ? 'Asking…' : 'Ask Claude'}
        </button>
      </div>

      {voiceError && <p className="voice-error">{voiceError}</p>}

      {(displayText || listening) && (
        <div className="voice-transcript">
          <span className="voice-transcript-label">Live transcript (local only — sent to Deepgram as audio)</span>
          <p className="voice-transcript-text">{displayText || '(listening…)'}</p>
        </div>
      )}

      {redactedPreview && (
        <div className="voice-redacted-preview">
          <span className="voice-transcript-label">Scrubbed question sent to Claude</span>
          <p className="voice-transcript-text">{redactedPreview}</p>
          {hasTokensInPreview && <p className="hint">PII tokens only in network payload — no raw identifiers.</p>}
        </div>
      )}

      {answer && (
        <div className="voice-answer">
          <h4>Claude&apos;s answer</h4>
          <p className="hint">trace_id: {answer.trace_id}</p>
          <pre className="voice-answer-text">{answer.answer_text}</pre>
        </div>
      )}
    </section>
  );
}
