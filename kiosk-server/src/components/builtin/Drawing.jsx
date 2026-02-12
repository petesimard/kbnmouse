import { useRef, useState, useEffect, useCallback } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { fetchDrawings, fetchDrawing, saveDrawing, updateDrawing, deleteDrawing } from '../../api/drawings.js';

export const meta = { key: 'drawing', name: 'Drawing', icon: '🎨', description: 'KidPix-style creative studio' };

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#84cc16', '#0ea5e9', '#6366f1',
  '#fca5a5', '#fdba74', '#fde68a', '#86efac', '#67e8f9', '#a5b4fc', '#d8b4fe', '#f9a8d4',
];

const BRUSH_SIZES = [3, 6, 12, 24, 40];

const TOOLS = [
  { id: 'pencil', icon: '✏️', name: 'Pencil' },
  { id: 'paintbrush', icon: '🖌️', name: 'Brush' },
  { id: 'spray', icon: '🎨', name: 'Spray' },
  { id: 'rainbow', icon: '🌈', name: 'Rainbow' },
  { id: 'stamps', icon: '⭐', name: 'Stamps' },
  { id: 'eraser', icon: '🧹', name: 'Eraser' },
  { id: 'fill', icon: '🪣', name: 'Fill' },
  { id: 'glitter', icon: '✨', name: 'Glitter' },
  { id: 'zigzag', icon: '〰️', name: 'Zigzag' },
  { id: 'mirror', icon: '🪞', name: 'Mirror' },
  { id: 'bubbles', icon: '🫧', name: 'Bubbles' },
  { id: 'calligraphy', icon: '🖋️', name: 'Calligraphy' },
];

const STAMP_CATEGORIES = {
  Animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦋','🐛','🐝','🐞','🐢','🐍','🦎','🐙','🦀','🐠','🐬','🐳','🦈'],
  Nature: ['🌸','🌺','🌻','🌷','🌹','🌼','🌵','🌲','🌳','🌴','🍀','🍁','🍂','🍃','🌾','🌿','☀️','🌙','⭐','🌈','☁️','❄️','🔥','💧','🌊','🍄','💐','🪻','🪷','🌱'],
  Food: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🥭','🍕','🍔','🌮','🍟','🍿','🧁','🍩','🍪','🎂','🍦','🍫','🍬','🍭','🥤','🧃','🍝','🥞','🧇','🥨','🥐'],
  Vehicles: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚜','🚲','🛵','🏍️','🚂','✈️','🚀','🛸','🚁','⛵','🚤','🛥️','🚢','🎠','🎢','🎡','🛶','🚠'],
  Faces: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😋','😜','🤪','😎','🤓','🧐','😤','😭','🥳','😱','🤯','😈','👻','💀','🤖'],
  Objects: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🎸','🎹','🥁','🎺','🎨','🎭','🎪','🎯','🎲','🧩','💎','👑','🎀','🧸','🪁','🔮','💡','📷','🔑','❤️','💜','💚'],
};

const UNDO_LIMIT = 20;

// ─── Sound Effects (Web Audio API) ──────────────────────────────────────────

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playPop() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.08);
  } catch {}
}

function playBoing() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function playUndo() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

function playExplosion() {
  try {
    const ctx = getAudioCtx();
    const bufferSize = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.6);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(); source.stop(ctx.currentTime + 0.6);
  } catch {}
}

function playSave() {
  try {
    const ctx = getAudioCtx();
    [261.6, 329.6, 392.0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.4);
    });
  } catch {}
}

function playFill() {
  try {
    const ctx = getAudioCtx();
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.3);
    filter.Q.value = 2;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(); source.stop(ctx.currentTime + 0.3);
  } catch {}
}

// ─── Flood Fill (scanline algorithm) ────────────────────────────────────────

function floodFill(ctx, startX, startY, fillColor) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

  const startIdx = (sy * width + sx) * 4;
  const sr = data[startIdx], sg = data[startIdx + 1], sb = data[startIdx + 2], sa = data[startIdx + 3];

  // Parse fill color
  const temp = document.createElement('canvas').getContext('2d');
  temp.fillStyle = fillColor;
  temp.fillRect(0, 0, 1, 1);
  const fc = temp.getImageData(0, 0, 1, 1).data;
  const fr = fc[0], fg = fc[1], fb = fc[2], fa = fc[3];

  if (sr === fr && sg === fg && sb === fb && sa === fa) return;

  const tolerance = 32;
  function matches(idx) {
    return Math.abs(data[idx] - sr) <= tolerance &&
           Math.abs(data[idx + 1] - sg) <= tolerance &&
           Math.abs(data[idx + 2] - sb) <= tolerance &&
           Math.abs(data[idx + 3] - sa) <= tolerance;
  }

  const stack = [[sx, sy]];
  const visited = new Uint8Array(width * height);
  let filled = 0;
  const LIMIT = 500000;

  while (stack.length > 0 && filled < LIMIT) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const vi = y * width + x;
    if (visited[vi]) continue;
    visited[vi] = 1;
    const idx = vi * 4;
    if (!matches(idx)) continue;
    data[idx] = fr; data[idx + 1] = fg; data[idx + 2] = fb; data[idx + 3] = fa;
    filled++;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── Thumbnail generator ────────────────────────────────────────────────────

function generateThumbnail(canvas, maxSize = 200) {
  const thumb = document.createElement('canvas');
  const ratio = Math.min(maxSize / canvas.width, maxSize / canvas.height);
  thumb.width = Math.round(canvas.width * ratio);
  thumb.height = Math.round(canvas.height * ratio);
  thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL('image/png');
}

// ─── Component ──────────────────────────────────────────────────────────────

function Drawing() {
  const { profileId } = useProfile();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const hueRef = useRef(0);
  const zigzagRef = useRef(0);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(8);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showStamps, setShowStamps] = useState(false);
  const [stampCategory, setStampCategory] = useState('Animals');
  const [selectedStamp, setSelectedStamp] = useState('⭐');
  const [showGallery, setShowGallery] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [currentDrawingId, setCurrentDrawingId] = useState(null);
  const [currentDrawingName, setCurrentDrawingName] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [toast, setToast] = useState(null);

  // ─── Canvas Setup ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      const rect = containerRef.current.getBoundingClientRect();
      const prevData = canvas.width > 0 && canvas.height > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (prevData) ctx.putImageData(prevData, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // ─── Toast helper ───────────────────────────────────────────────────────

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // ─── Undo / Redo ───────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    const snap = canvas.toDataURL('image/png');
    const stack = undoStackRef.current;
    stack.push(snap);
    if (stack.length > UNDO_LIMIT) stack.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    playUndo();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    redoStackRef.current.push(canvas.toDataURL('image/png'));
    const snap = stack.pop();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setCanUndo(stack.length > 0);
      setCanRedo(true);
    };
    img.src = snap;
  }, []);

  const handleRedo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    playPop();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    undoStackRef.current.push(canvas.toDataURL('image/png'));
    const snap = stack.pop();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setCanUndo(true);
      setCanRedo(stack.length > 0);
    };
    img.src = snap;
  }, []);

  // ─── Dynamite Clear ────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    if (isClearing) return;
    pushUndo();
    playExplosion();
    setIsClearing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    const colors = ['#000000', '#f97316', '#ef4444', '#ffffff'];
    const duration = 800;
    const start = performance.now();

    function animate(now) {
      const t = Math.min((now - start) / duration, 1);
      const r = t * maxR * 1.2;
      for (let i = colors.length - 1; i >= 0; i--) {
        const ri = r - i * 40;
        if (ri > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, ri, 0, Math.PI * 2);
          ctx.fillStyle = colors[i];
          ctx.fill();
        }
      }
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
        setCurrentDrawingId(null);
        setCurrentDrawingName(null);
        setIsClearing(false);
      }
    }
    requestAnimationFrame(animate);
  }, [isClearing, pushUndo]);

  // ─── Drawing Logic ─────────────────────────────────────────────────────

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const drawStroke = useCallback((from, to, ctx) => {
    const effectiveColor = tool === 'eraser' ? '#ffffff' : color;

    switch (tool) {
      case 'pencil': {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = effectiveColor;
        ctx.lineWidth = Math.max(2, brushSize * 0.4);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        break;
      }
      case 'paintbrush':
      case 'eraser': {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = effectiveColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = tool === 'eraser' ? 1 : 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'spray': {
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const steps = Math.max(1, Math.ceil(dist / 4));
        for (let s = 0; s <= steps; s++) {
          const t = steps === 0 ? 0 : s / steps;
          const cx = from.x + (to.x - from.x) * t;
          const cy = from.y + (to.y - from.y) * t;
          const count = Math.floor(brushSize * 1.5);
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * brushSize;
            ctx.fillStyle = effectiveColor;
            ctx.globalAlpha = 0.3 + Math.random() * 0.5;
            ctx.fillRect(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1.5, 1.5);
          }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'rainbow': {
        hueRef.current = (hueRef.current + 3) % 360;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = `hsl(${hueRef.current}, 90%, 55%)`;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
      case 'glitter': {
        const gdist = Math.hypot(to.x - from.x, to.y - from.y);
        const gsteps = Math.max(1, Math.ceil(gdist / 3));
        for (let s = 0; s <= gsteps; s++) {
          const t = gsteps === 0 ? 0 : s / gsteps;
          const cx = from.x + (to.x - from.x) * t;
          const cy = from.y + (to.y - from.y) * t;
          const count = Math.floor(brushSize * 0.8);
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * brushSize;
            const size = 1 + Math.random() * 3;
            const lightness = 50 + Math.random() * 40;
            // Parse color to get hue-ish tint
            ctx.fillStyle = Math.random() > 0.3 ? effectiveColor : `hsl(${Math.random() * 360}, 80%, ${lightness}%)`;
            ctx.globalAlpha = 0.5 + Math.random() * 0.5;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'zigzag': {
        zigzagRef.current += 1;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist2 = Math.hypot(dx, dy);
        if (dist2 < 1) break;
        const perpX = -dy / dist2;
        const perpY = dx / dist2;
        const amp = brushSize * 0.6;
        const wave = Math.sin(zigzagRef.current * 0.5) * amp;
        const ox = perpX * wave;
        const oy = perpY * wave;
        ctx.beginPath();
        ctx.moveTo(from.x + ox, from.y + oy);
        ctx.lineTo(to.x + ox, to.y + oy);
        ctx.strokeStyle = effectiveColor;
        ctx.lineWidth = Math.max(2, brushSize * 0.4);
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
      case 'mirror': {
        const canvas = canvasRef.current;
        const midX = canvas.width / 2;
        // Draw on both sides
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = effectiveColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.stroke();
        // Mirror
        const mirrorFromX = midX + (midX - from.x);
        const mirrorToX = midX + (midX - to.x);
        ctx.beginPath();
        ctx.moveTo(mirrorFromX, from.y);
        ctx.lineTo(mirrorToX, to.y);
        ctx.strokeStyle = effectiveColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
      case 'bubbles': {
        const bdist = Math.hypot(to.x - from.x, to.y - from.y);
        const bsteps = Math.max(1, Math.ceil(bdist / 8));
        for (let s = 0; s <= bsteps; s++) {
          const t = bsteps === 0 ? 0 : s / bsteps;
          const cx = from.x + (to.x - from.x) * t;
          const cy = from.y + (to.y - from.y) * t;
          if (Math.random() > 0.4) {
            const r = 3 + Math.random() * brushSize * 0.8;
            ctx.beginPath();
            ctx.arc(cx + (Math.random() - 0.5) * brushSize, cy + (Math.random() - 0.5) * brushSize, r, 0, Math.PI * 2);
            ctx.strokeStyle = effectiveColor;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4 + Math.random() * 0.4;
            ctx.stroke();
            // Highlight
            ctx.beginPath();
            ctx.arc(cx + (Math.random() - 0.5) * brushSize - r * 0.3, cy + (Math.random() - 0.5) * brushSize - r * 0.3, r * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'calligraphy': {
        const dx2 = to.x - from.x;
        const dy2 = to.y - from.y;
        const angle = Math.atan2(dy2, dx2);
        // Width varies with direction (thin for horizontal, thick for vertical)
        const widthFactor = Math.abs(Math.sin(angle));
        const lineWidth = Math.max(1, brushSize * (0.2 + widthFactor * 0.8));
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = effectiveColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }, [tool, color, brushSize]);

  const handleStart = useCallback((e) => {
    e.preventDefault();
    if (isClearing) return;
    const point = getPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (tool === 'fill') {
      pushUndo();
      playFill();
      floodFill(ctx, point.x, point.y, color);
      return;
    }

    if (tool === 'stamps') {
      pushUndo();
      playBoing();
      const size = brushSize * 2 + 20;
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selectedStamp, point.x, point.y);
      return;
    }

    pushUndo();
    drawingRef.current = true;
    lastPointRef.current = point;
    zigzagRef.current = 0;

    // Draw initial dot
    if (tool === 'pencil' || tool === 'paintbrush' || tool === 'eraser' || tool === 'calligraphy') {
      const effectiveColor = tool === 'eraser' ? '#ffffff' : color;
      const size = tool === 'pencil' ? Math.max(2, brushSize * 0.4) : brushSize;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = effectiveColor;
      ctx.globalAlpha = tool === 'paintbrush' ? 0.7 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (tool === 'mirror') {
      const midX = canvas.width / 2;
      const effectiveColor2 = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = effectiveColor2;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(midX + (midX - point.x), point.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = effectiveColor2;
      ctx.fill();
    }
  }, [tool, color, brushSize, selectedStamp, isClearing, pushUndo]);

  const handleMove = useCallback((e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const point = getPoint(e);
    const ctx = canvasRef.current.getContext('2d');
    if (lastPointRef.current) {
      drawStroke(lastPointRef.current, point, ctx);
    }
    lastPointRef.current = point;
  }, [drawStroke]);

  const handleEnd = useCallback(() => {
    drawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  // ─── Save / Load ──────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!profileId) { showToast('No profile selected'); return; }
    const canvas = canvasRef.current;
    const image_data = canvas.toDataURL('image/png');
    const thumbnail = generateThumbnail(canvas);

    try {
      if (currentDrawingId) {
        await updateDrawing(currentDrawingId, { name: currentDrawingName, image_data, thumbnail });
        showToast('Drawing saved!');
      } else {
        setShowSaveModal(true);
        setSaveName('');
        return; // Modal will handle the actual save
      }
      playSave();
    } catch {
      showToast('Failed to save');
    }
  }, [profileId, currentDrawingId, currentDrawingName, showToast]);

  const handleSaveNew = useCallback(async () => {
    if (!saveName.trim() || !profileId) return;
    const canvas = canvasRef.current;
    const image_data = canvas.toDataURL('image/png');
    const thumbnail = generateThumbnail(canvas);

    try {
      const result = await saveDrawing({ name: saveName.trim(), image_data, thumbnail, profile_id: profileId });
      setCurrentDrawingId(result.id);
      setCurrentDrawingName(saveName.trim());
      setShowSaveModal(false);
      playSave();
      showToast('Drawing saved!');
    } catch {
      showToast('Failed to save');
    }
  }, [saveName, profileId, showToast]);

  const loadGallery = useCallback(async () => {
    if (!profileId) return;
    setGalleryLoading(true);
    try {
      const items = await fetchDrawings(profileId);
      setGalleryItems(items);
    } catch {
      setGalleryItems([]);
    }
    setGalleryLoading(false);
  }, [profileId]);

  const handleOpenGallery = useCallback(() => {
    setShowGallery(true);
    loadGallery();
  }, [loadGallery]);

  const handleLoadDrawing = useCallback(async (id) => {
    try {
      const drawing = await fetchDrawing(id);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setCurrentDrawingId(drawing.id);
        setCurrentDrawingName(drawing.name);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
        setShowGallery(false);
        showToast(`Loaded "${drawing.name}"`);
      };
      img.src = drawing.image_data;
    } catch {
      showToast('Failed to load drawing');
    }
  }, [showToast]);

  const handleDeleteDrawing = useCallback(async (id) => {
    try {
      await deleteDrawing(id);
      if (currentDrawingId === id) {
        setCurrentDrawingId(null);
        setCurrentDrawingName(null);
      }
      loadGallery();
      showToast('Drawing deleted');
    } catch {
      showToast('Failed to delete');
    }
  }, [currentDrawingId, loadGallery, showToast]);

  // ─── Tool select handler ──────────────────────────────────────────────

  const handleToolSelect = useCallback((toolId) => {
    playPop();
    setTool(toolId);
    if (toolId === 'stamps') {
      setShowStamps(true);
    } else {
      setShowStamps(false);
    }
  }, []);

  // ─── Cursor style ─────────────────────────────────────────────────────

  const cursorClass = tool === 'fill' ? 'cursor-crosshair' :
                      tool === 'stamps' ? 'cursor-pointer' :
                      tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-slate-800 flex overflow-hidden select-none">
      {/* Left Sidebar - Tools */}
      <div className="w-16 bg-slate-900 flex flex-col items-center py-2 gap-1 overflow-y-auto shrink-0">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleToolSelect(t.id)}
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl transition-all ${
              tool === t.id ? 'bg-blue-600 scale-110 shadow-lg shadow-blue-500/30' : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title={t.name}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 bg-slate-900 flex items-center px-3 gap-2 shrink-0">
          {/* Left: Undo/Redo */}
          <button onClick={handleUndo} disabled={!canUndo}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${canUndo ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600'}`}
            title="Undo">↩️</button>
          <button onClick={handleRedo} disabled={!canRedo}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${canRedo ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600'}`}
            title="Redo">↪️</button>

          {/* Center: Title */}
          <div className="flex-1 text-center text-white/60 text-sm font-medium truncate px-2">
            {currentDrawingName || 'Untitled Drawing'}
          </div>

          {/* Right: Save/Gallery/Clear */}
          <button onClick={handleSave}
            className="h-10 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            title="Save">
            💾 Save
          </button>
          <button onClick={handleOpenGallery}
            className="h-10 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            title="Gallery">
            🖼️ Gallery
          </button>
          <button onClick={handleClear} disabled={isClearing}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
              isClearing ? 'bg-red-800 animate-pulse' : 'bg-red-600 hover:bg-red-700 hover:scale-105'
            }`}
            title="Dynamite Clear!">
            💣
          </button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className={`flex-1 bg-white relative ${isClearing ? 'animate-shake' : ''}`}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            className={`absolute inset-0 w-full h-full touch-none ${cursorClass}`}
          />

          {/* Stamp Picker Overlay */}
          {showStamps && (
            <div className="absolute top-2 left-2 bg-slate-900/95 rounded-xl p-3 shadow-xl backdrop-blur z-10 max-w-xs">
              <div className="flex gap-1 mb-2 flex-wrap">
                {Object.keys(STAMP_CATEGORIES).map((cat) => (
                  <button key={cat} onClick={() => setStampCategory(cat)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      stampCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}>{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                {STAMP_CATEGORIES[stampCategory].map((s, i) => (
                  <button key={i} onClick={() => { setSelectedStamp(s); playPop(); }}
                    className={`w-8 h-8 rounded flex items-center justify-center text-lg hover:bg-slate-700 transition-colors ${
                      selectedStamp === s ? 'bg-blue-600 ring-2 ring-blue-400' : ''
                    }`}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="bg-slate-900 p-2 flex items-center gap-3 shrink-0 flex-wrap">
          {/* Colors */}
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === c ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700" />

          {/* Brush Sizes */}
          <div className="flex items-center gap-1">
            {BRUSH_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setBrushSize(size)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  brushSize === size ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title={`${size}px`}
              >
                <span className="rounded-full bg-white" style={{ width: Math.min(size, 28), height: Math.min(size, 28) }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowSaveModal(false)}>
          <div className="bg-slate-800 rounded-xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white text-lg font-bold mb-4">Save Drawing</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNew()}
              placeholder="My masterpiece..."
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-lg mb-4 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors">Cancel</button>
              <button onClick={handleSaveNew} disabled={!saveName.trim()}
                className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowGallery(false)}>
          <div className="bg-slate-800 rounded-xl p-6 w-[500px] max-h-[80vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-bold">My Drawings</h3>
              <button onClick={() => setShowGallery(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            {galleryLoading ? (
              <div className="text-center text-slate-400 py-8">Loading...</div>
            ) : galleryItems.length === 0 ? (
              <div className="text-center text-slate-400 py-8">No saved drawings yet</div>
            ) : (
              <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                {galleryItems.map((item) => (
                  <div key={item.id} className="bg-slate-700 rounded-lg overflow-hidden group">
                    <div className="aspect-video bg-white flex items-center justify-center overflow-hidden">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-slate-400 text-xs">No preview</span>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-white text-xs font-medium truncate mb-1">{item.name}</div>
                      <div className="flex gap-1">
                        <button onClick={() => handleLoadDrawing(item.id)}
                          className="flex-1 text-xs py-1 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors">Open</button>
                        <button onClick={() => handleDeleteDrawing(item.id)}
                          className="text-xs py-1 px-2 rounded bg-red-600/80 hover:bg-red-600 text-white transition-colors">🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSS for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-8px, -4px); }
          20% { transform: translate(6px, 4px); }
          30% { transform: translate(-6px, 2px); }
          40% { transform: translate(4px, -4px); }
          50% { transform: translate(-4px, 4px); }
          60% { transform: translate(6px, -2px); }
          70% { transform: translate(-2px, 4px); }
          80% { transform: translate(4px, -2px); }
          90% { transform: translate(-2px, 2px); }
        }
        .animate-shake { animation: shake 0.8s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

export default Drawing;
