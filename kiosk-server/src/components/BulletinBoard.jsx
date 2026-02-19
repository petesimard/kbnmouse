import { useState, useEffect, useRef } from 'react';

export function PostItNote({ content, color = '#fef9c3', profileName, profileIcon, isParent, parentName = 'Mom & Dad' }) {
  return (
    <div
      className="w-44 relative group"
      style={{
        background: isParent
          ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
          : `linear-gradient(135deg, ${color} 0%, ${color}ee 100%)`,
        padding: '20px 16px 14px',
        fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
        boxShadow: isParent
          ? '2px 3px 12px rgba(59,130,246,0.2), 0 1px 3px rgba(0,0,0,0.1)'
          : '2px 3px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {/* Thumbtack */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
        <div className="relative">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-px h-1 bg-gray-400/30 rounded-full" />
          <div className="w-2.5 h-2.5 rounded-full relative"
            style={{
              background: isParent
                ? 'radial-gradient(circle at 35% 30%, #60a5fa, #2563eb 60%, #1d4ed8)'
                : 'radial-gradient(circle at 35% 30%, #fb7185, #e11d48 60%, #be123c)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)',
            }}
          >
            <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      {!isParent && (
        <div className="absolute bottom-0 right-0 w-5 h-5"
          style={{
            background: `linear-gradient(135deg, ${color}00 50%, rgba(0,0,0,0.08) 50%)`,
          }}
        />
      )}

      {isParent && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-blue-400 text-xs">💙</span>
          <span className="text-blue-500 font-bold" style={{ fontSize: '10px' }}>From {parentName}</span>
        </div>
      )}
      <p className={`text-xs leading-relaxed break-words whitespace-pre-wrap ${isParent ? 'text-blue-900' : 'text-amber-900/90'}`}>
        {content}
      </p>
      {profileName && !isParent && (
        <div className="mt-2.5 text-right text-amber-700/50 font-medium" style={{ fontSize: '10px' }}>
          {profileIcon} {profileName}
        </div>
      )}
    </div>
  );
}

export function PhotoPin({ content, profileName, profileIcon }) {
  return (
    <div className="relative">
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
        <div className="relative">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-px h-1 bg-gray-400/30 rounded-full" />
          <div className="w-2.5 h-2.5 rounded-full relative"
            style={{
              background: 'radial-gradient(circle at 35% 30%, #fbbf24, #d97706 60%, #b45309)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)',
            }}
          >
            <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
      <div style={{
        background: 'white',
        padding: '8px 8px 24px',
        boxShadow: '2px 3px 12px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.08)',
        width: '160px',
      }}>
        <img src={content} alt="" className="w-full aspect-[4/3] object-cover block" />
        {profileName && (
          <div className="mt-1 text-center text-gray-400 font-medium" style={{ fontSize: '10px', fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive' }}>
            {profileIcon} {profileName}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmojiPin({ content }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative z-10 -mb-0.5">
        <div className="w-2 h-2 rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #34d399, #059669 60%, #047857)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)',
          }}
        >
          <div className="absolute top-px left-px w-1 h-1 rounded-full bg-white/40" />
        </div>
      </div>
      <span className="text-5xl select-none" style={{
        filter: 'drop-shadow(2px 3px 4px rgba(0,0,0,0.2))',
      }}>{content}</span>
    </div>
  );
}

export default function BulletinBoard({ pins, parentName, placing, onPlaced, onCancelPlace, onDeletePin, className = '' }) {
  const boardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  // Track mouse position over the board
  useEffect(() => {
    const handler = (e) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // ESC cancels placement
  useEffect(() => {
    if (!placing) return;
    const handler = (e) => { if (e.key === 'Escape') onCancelPlace?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [placing, onCancelPlace]);

  const handleBoardClick = () => {
    if (!placing) return;
    onPlaced?.(mousePos.x, mousePos.y);
  };

  return (
    <div
      ref={boardRef}
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        background: 'linear-gradient(145deg, #c9a06c 0%, #bf9460 20%, #d4a874 40%, #c49a68 60%, #ba8e58 80%, #c9a06c 100%)',
        cursor: placing ? 'crosshair' : 'default',
      }}
      onClick={handleBoardClick}
    >
      {/* Cork texture - fine grain */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          radial-gradient(ellipse at 15% 25%, rgba(160,120,60,0.4) 0.5px, transparent 1px),
          radial-gradient(ellipse at 45% 65%, rgba(140,100,50,0.3) 0.5px, transparent 1px),
          radial-gradient(ellipse at 75% 35%, rgba(170,130,70,0.35) 0.5px, transparent 1px),
          radial-gradient(ellipse at 30% 80%, rgba(150,110,55,0.3) 0.5px, transparent 1px),
          radial-gradient(ellipse at 85% 75%, rgba(145,105,52,0.35) 0.5px, transparent 1px),
          radial-gradient(ellipse at 55% 15%, rgba(155,115,58,0.3) 0.5px, transparent 1px)`,
        backgroundSize: '18px 18px, 23px 23px, 15px 15px, 20px 20px, 17px 17px, 25px 25px',
      }} />
      {/* Cork texture - larger mottling */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 20% 30%, rgba(100,70,30,0.5) 0%, transparent 60%),
          radial-gradient(ellipse 40% 60% at 70% 60%, rgba(80,55,20,0.4) 0%, transparent 50%),
          radial-gradient(ellipse 50% 50% at 50% 50%, rgba(120,85,35,0.3) 0%, transparent 55%)`,
      }} />
      {/* Inner shadow for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.25), inset 0 0 120px rgba(0,0,0,0.08)',
      }} />

      {/* Board frame - wooden border */}
      <div className="absolute inset-0 pointer-events-none" style={{
        border: '10px solid transparent',
        borderImage: 'linear-gradient(135deg, #5a3d20 0%, #7a5232 25%, #4a3018 50%, #6b4528 75%, #5a3d20 100%) 1',
        boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.4)',
      }} />
      {/* Frame highlight */}
      <div className="absolute inset-[10px] pointer-events-none" style={{
        boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.2), inset -1px -1px 2px rgba(255,255,255,0.05)',
      }} />

      {/* Placement banner */}
      {placing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] animate-bounce">
          <div className="bg-white/95 backdrop-blur-sm text-amber-900 px-5 py-2 rounded-full shadow-lg font-bold text-sm flex items-center gap-2">
            <span>📌</span> Click anywhere to place!
            <button
              onClick={(e) => { e.stopPropagation(); onCancelPlace?.(); }}
              className="ml-1 text-red-500 hover:text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Pinned items */}
      {pins.map(pin => (
        <div
          key={pin.id}
          className="absolute transition-transform duration-200 group/pin"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: `translate(-50%, -50%) rotate(${pin.rotation || 0}deg)`,
            zIndex: pin.id
          }}
        >
          {pin.pin_type === 'photo' ? (
            <PhotoPin content={pin.content} profileName={pin.profile_name} profileIcon={pin.profile_icon} />
          ) : pin.pin_type === 'message' ? (
            <PostItNote content={pin.content} color={pin.color} profileName={pin.profile_name} profileIcon={pin.profile_icon} isParent={!!pin.is_parent} parentName={parentName} />
          ) : (
            <EmojiPin content={pin.content} />
          )}
          {onDeletePin && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeletePin(pin.id); }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover/pin:opacity-100 transition-opacity shadow-lg"
              style={{ zIndex: 1 }}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {/* Ghost preview while placing */}
      {placing && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${mousePos.x}%`,
            top: `${mousePos.y}%`,
            transform: `translate(-50%, -50%) rotate(${placing.rotation}deg)`,
            opacity: 0.7,
            zIndex: 99999,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
          }}
        >
          {placing.type === 'photo' ? (
            <PhotoPin content={placing.content} />
          ) : placing.type === 'message' ? (
            <PostItNote content={placing.content} color={placing.color} />
          ) : (
            <EmojiPin content={placing.content} />
          )}
        </div>
      )}

      {/* Empty state */}
      {pins.length === 0 && !placing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-40">
            <div className="text-6xl mb-3">📌</div>
            <div className="text-amber-900 font-bold text-lg">No pins yet!</div>
            <div className="text-amber-900/70 text-sm">Add a message or emoji to get started</div>
          </div>
        </div>
      )}
    </div>
  );
}
