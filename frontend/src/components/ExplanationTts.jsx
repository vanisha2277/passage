import { useCallback, useEffect, useRef, useState } from 'react';
import { extractExplanationText, ttsVoiceForLanguage } from '../voice/explanationText.js';
import { fetchExplanationTts } from '../voice/deepgramTts.js';

/**
 * Play/pause read-back of Claude explanation text ONLY (tokenized, pre-reinsertion).
 * Deliberately has no access to reinsertedText — callers pass claudeTokenizedText only.
 *
 * @param {{ claudeTokenizedText: string, targetLanguage: string, label?: string }} props
 */
export default function ExplanationTts({ claudeTokenizedText, targetLanguage, label = 'Listen to explanation' }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const explanationRef = useRef('');

  explanationRef.current = extractExplanationText(claudeTokenizedText);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPlaying(false);
    setReady(false);
  }, []);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  async function ensureAudioLoaded() {
    const explanation = explanationRef.current;
    if (!explanation.trim()) {
      throw new Error('No explanation text to read aloud');
    }

    if (audioRef.current && blobUrlRef.current) return;

    setLoading(true);
    setError(null);
    try {
      const blob = await fetchExplanationTts(explanation, targetLanguage);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      audio.onplay = () => setPlaying(true);
      audioRef.current = audio;
      setReady(true);
    } finally {
      setLoading(false);
    }
  }

  async function handlePlayPause() {
    try {
      if (playing && audioRef.current) {
        audioRef.current.pause();
        return;
      }

      await ensureAudioLoaded();
      if (!audioRef.current) return;

      if (audioRef.current.currentTime > 0 && !audioRef.current.paused) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      cleanupAudio();
    }
  }

  const voice = ttsVoiceForLanguage(targetLanguage);
  const preview = explanationRef.current.slice(0, 120);

  return (
    <div className="explanation-tts">
      <div className="explanation-tts-controls">
        <button type="button" className="btn-tts" onClick={handlePlayPause} disabled={loading || !preview}>
          {loading ? 'Loading audio…' : playing ? 'Pause read-back' : ready ? 'Play read-back' : 'Play read-back'}
        </button>
        <span className="hint tts-meta">TTS voice: {voice} · explanation only (no reinserted values)</span>
      </div>
      {error && <p className="voice-error">{error}</p>}
      <details className="tts-preview-details">
        <summary>Text sent to Deepgram TTS (tokenized explanation)</summary>
        <pre className="span-log">{explanationRef.current || '(empty)'}</pre>
      </details>
    </div>
  );
}
