import { useRef, useState, useEffect } from 'react';

export const meta = { key: 'drawing', name: 'Drawing', icon: '🎨', description: 'Simple drawing canvas' };

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

const BRUSH_SIZES = [4, 8, 16, 32];

function Drawing() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(8);
  const [lastPoint, setLastPoint] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to fill container
    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const drawLine = (start, end) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handleStart = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getPoint(e);
    setLastPoint(point);

    // Draw a dot for single clicks
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  const handleMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getPoint(e);
    if (lastPoint) {
      drawLine(lastPoint, point);
    }
    setLastPoint(point);
  };

  const handleEnd = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="h-screen bg-slate-800 flex flex-col">
      {/* Toolbar */}
      <div className="bg-slate-900 p-4 flex items-center justify-center gap-6 flex-wrap">
        {/* Colors */}
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                color === c ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-700" />

        {/* Brush sizes */}
        <div className="flex items-center gap-2">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                brushSize === size
                  ? 'bg-blue-600'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title={`${size}px brush`}
            >
              <span
                className="rounded-full bg-white"
                style={{ width: Math.min(size, 24), height: Math.min(size, 24) }}
              />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-700" />

        {/* Clear button */}
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Canvas container */}
      <div className="flex-1 p-4">
        <div className="w-full h-full rounded-lg overflow-hidden shadow-lg">
          <canvas
            ref={canvasRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            className="touch-none cursor-crosshair"
          />
        </div>
      </div>
    </div>
  );
}

export default Drawing;
