import { useState, useRef, useEffect, useCallback } from 'react';

export const meta = {
  key: 'speechtotext',
  name: 'Text to Speech',
  icon: '🎤',
  description: 'Record audio and convert to text',
};

const useIPC = !!window.kioskAudio;

function SpeechToText() {
  const [status, setStatus] = useState('idle'); // idle | recording | processing
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [appId, setAppId] = useState(null);
  const [level, setLevel] = useState(0);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const cleanupLevel = useRef(null);

  useEffect(() => {
    async function findApp() {
      const res = await fetch('/api/apps');
      const apps = await res.json();
      const app = apps.find(a => a.app_type === 'builtin' && a.url === 'speechtotext');
      if (app) setAppId(app.id);
    }
    findApp();
  }, []);

  const stopLevelMonitoring = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (cleanupLevel.current) {
      cleanupLevel.current();
      cleanupLevel.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
  }, []);

  function startBrowserLevelMonitoring(stream) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    function poll() {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setLevel(sum / data.length / 255);
      rafRef.current = requestAnimationFrame(poll);
    }
    poll();

    cleanupLevel.current = () => ctx.close();
  }

  async function startRecording() {
    setError(null);
    try {
      if (useIPC) {
        const result = await window.kioskAudio.startRecording();
        if (!result.success) throw new Error(result.error);
        cleanupLevel.current = window.kioskAudio.onLevel((l) => setLevel(l));
        setStatus('recording');
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        chunks.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          stopLevelMonitoring();
          transcribeBlob();
        };
        mediaRecorder.current = recorder;
        recorder.start();
        startBrowserLevelMonitoring(stream);
        setStatus('recording');
      }
    } catch {
      setError('Could not access microphone.');
    }
  }

  async function stopRecording() {
    setStatus('processing');
    stopLevelMonitoring();
    if (useIPC) {
      const result = await window.kioskAudio.stopRecording();
      if (result.error) {
        setError(result.error);
        setStatus('idle');
      } else {
        await transcribe(result.audio, 'audio/wav');
      }
    } else if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    }
  }

  async function transcribeBlob() {
    const blob = new Blob(chunks.current, { type: 'audio/webm' });
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await transcribe(base64, 'audio/webm');
  }

  async function transcribe(audio, mimeType) {
    try {
      const res = await fetch('/api/speechtotext/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, audio, mime_type: mimeType }),
      });
      const data = await res.json();

      if (data.error) {
        if (data.error === 'api_key_missing') {
          setError('OpenAI API key not configured. Ask a parent to set it up in the dashboard.');
        } else {
          setError(data.message || 'Transcription failed. Please try again.');
        }
      } else {
        setText(data.text || '');
      }
    } catch {
      setError('Failed to send audio. Please try again.');
    } finally {
      setStatus('idle');
    }
  }

  function handleMicClick() {
    if (status === 'recording') {
      stopRecording();
    } else if (status === 'idle') {
      startRecording();
    }
  }

  const bgColor = status === 'recording' ? 'bg-red-500' : status === 'processing' ? 'bg-orange-500' : 'bg-indigo-500';
  const ringColor = status === 'recording' ? 'ring-red-400' : status === 'processing' ? 'ring-orange-400' : 'ring-indigo-400';
  const scale = status === 'recording' ? 1 + level * 1.5 : 1;

  return (
    <div className="flex flex-col items-center justify-start h-full pt-24 px-6 pb-6 gap-6 overflow-auto">
      <button
        onClick={handleMicClick}
        disabled={status === 'processing'}
        style={{ transform: `scale(${scale})`, transition: 'transform 0.1s ease-out' }}
        className={`relative w-32 h-32 rounded-full ${bgColor} ring-4 ${ringColor} ring-offset-2 ring-offset-slate-900 flex items-center justify-center ${status === 'processing' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-16 h-16">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M17 11a1 1 0 0 0-2 0 3 3 0 0 1-6 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V18H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.1A5 5 0 0 0 17 11z" />
        </svg>
      </button>

      <p className="text-slate-400 text-sm">
        {status === 'idle' && 'Tap the mic to start recording'}
        {status === 'recording' && 'Recording... tap again to stop'}
        {status === 'processing' && 'Transcribing...'}
      </p>

      {error && (
        <p className="text-red-400 text-sm text-center max-w-md">{error}</p>
      )}

      <div className="w-full max-w-2xl min-h-[200px] bg-slate-800 rounded-xl p-6 border border-slate-700">
        {text ? (
          <p className="text-white text-3xl leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-slate-500 text-lg italic">Your transcribed text will appear here...</p>
        )}
      </div>
    </div>
  );
}

export default SpeechToText;
