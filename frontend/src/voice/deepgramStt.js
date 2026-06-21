import { DeepgramClient } from '@deepgram/sdk';
import { fetchVoiceToken } from '../api/passage.js';

const MODEL = 'nova-3';

/**
 * Live microphone STT via Deepgram (nova-3). Audio goes to Deepgram only — not logged here.
 *
 * @param {{
 *   onTranscript: (text: string, isFinal: boolean) => void,
 *   onStatus?: (status: 'connecting' | 'listening' | 'idle' | 'error', detail?: string) => void,
 * }} handlers
 * @returns {Promise<() => Promise<void>>} stop function
 */
export async function startLiveTranscription({ onTranscript, onStatus }) {
  onStatus?.('connecting');

  const { access_token: accessToken } = await fetchVoiceToken();
  const client = new DeepgramClient({ accessToken });

  const connection = await client.listen.v1.connect({
    model: MODEL,
    language: 'en-US',
    punctuate: 'true',
    interim_results: 'true',
    smart_format: 'true',
  });

  /** @type {MediaStream | null} */
  let stream = null;
  /** @type {MediaRecorder | null} */
  let recorder = null;
  let stopped = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    stream?.getTracks().forEach((t) => t.stop());

    try {
      if (connection.socket?.readyState === WebSocket.OPEN) {
        connection.socket.send(JSON.stringify({ type: 'CloseStream' }));
        connection.socket.close();
      }
    } catch {
      // socket may already be closed
    }

    onStatus?.('idle');
  };

  connection.on('message', (data) => {
    if (data?.type !== 'Results') return;
    const transcript = data.channel?.alternatives?.[0]?.transcript ?? '';
    if (!transcript.trim()) return;
    onTranscript(transcript, Boolean(data.is_final));
  });

  connection.on('error', () => {
    onStatus?.('error', 'Deepgram connection error');
    void stop();
  });

  connection.on('close', () => {
    if (!stopped) onStatus?.('idle');
  });

  connection.connect();
  await connection.waitForOpen();

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0 && connection.socket?.readyState === WebSocket.OPEN) {
      connection.socket.send(event.data);
    }
  };
  recorder.start(250);

  onStatus?.('listening');
  return stop;
}
