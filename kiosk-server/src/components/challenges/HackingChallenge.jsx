import { useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { field, registerConfigSchema, computeDefaults } from './schemas.js';

export const configSchema = {
  total_levels: field(z.number().int().min(1).max(6).default(6), {
    label: 'Number of Levels',
    description: 'How many hacking levels to complete (1-6, easiest to hardest)',
    type: 'number',
    min: 1,
    max: 6,
  }),
};

registerConfigSchema('hacking', configSchema);

const DEFAULTS = computeDefaults(configSchema);

/* ========== Shared UI ========== */

function HackScreen({ children, subtitle }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-mono">
      {/* Scanline overlay */}
      <div className="pointer-events-none absolute inset-0 z-10" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.03) 2px, rgba(0,255,0,0.03) 4px)',
      }} />
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 z-10" style={{
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)',
      }} />
      {subtitle && (
        <div className="absolute top-6 left-0 right-0 text-center text-green-600 text-sm z-20">
          {subtitle}
        </div>
      )}
      <div className="relative z-20 flex flex-col items-center justify-center w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}

function TerminalBox({ children, title }) {
  return (
    <div className="w-full border border-green-800 rounded-lg bg-black/80 overflow-hidden">
      {title && (
        <div className="bg-green-900/40 px-4 py-2 text-green-500 text-sm border-b border-green-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
          <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
          <span className="ml-2">{title}</span>
        </div>
      )}
      <div className="p-4 text-green-400 text-base leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function AccessGranted({ onNext, levelNum }) {
  return (
    <div className="text-center animate-fade-in">
      <div className="text-green-400 text-6xl mb-4">&#10003;</div>
      <div className="text-green-400 text-3xl font-bold mb-2">ACCESS GRANTED</div>
      <div className="text-green-600 text-lg mb-8">Level {levelNum} bypassed successfully</div>
      <button
        onClick={onNext}
        className="px-8 py-3 bg-green-700 hover:bg-green-600 text-black font-bold text-xl rounded-lg transition-colors"
      >
        Continue &gt;&gt;
      </button>
    </div>
  );
}

/* ========== Level 1: The Disabled Button ========== */
/* A greyed-out "Complete Challenge" button. Hidden link "enable admin mode" in faint text. */

function Level1({ onComplete }) {
  const [adminMode, setAdminMode] = useState(false);
  const [solved, setSolved] = useState(false);

  if (solved) return <AccessGranted onNext={onComplete} levelNum={1} />;

  return (
    <>
      <div className="text-red-500 text-2xl mb-2 animate-pulse tracking-widest">
        &#9888; SECURITY SYSTEM ACTIVE &#9888;
      </div>
      <div className="text-green-700 text-sm mb-12">Firewall v3.2.1 — All access points disabled</div>

      <button
        disabled={!adminMode}
        onClick={() => adminMode && setSolved(true)}
        className={`px-12 py-6 text-2xl font-bold rounded-xl transition-all mb-4 ${
          adminMode
            ? 'bg-green-600 hover:bg-green-500 text-black cursor-pointer shadow-lg shadow-green-500/30 animate-pulse'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
        }`}
      >
        {adminMode ? 'Admin Complete Challenge' : 'Complete Challenge'}
      </button>

      {!adminMode && <div className="text-slate-600 text-sm mb-20">Button disabled by security policy</div>}

      <div className="mt-8">
        <button
          onClick={() => setAdminMode(true)}
          className="text-[#0a0a0a] hover:text-green-400 text-xs transition-colors duration-500 cursor-default hover:cursor-pointer"
          style={{ textShadow: '0 0 0 transparent' }}
        >
          [ enable admin mode ]
        </button>
      </div>
    </>
  );
}

/* ========== Level 2: The Hidden Password ========== */
/* Password input. The password is hidden in near-invisible text on screen. */

function Level2({ onComplete }) {
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(false);
  const password = 'BANANA';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim().toUpperCase() === password) {
      setSolved(true);
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  };

  if (solved) return <AccessGranted onNext={onComplete} levelNum={2} />;

  return (
    <>
      <div className="text-red-500 text-4xl font-bold mb-2 tracking-wider">ACCESS DENIED</div>
      <div className="text-green-600 text-lg mb-8">Enter password to continue</div>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 mb-12">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter password..."
          autoFocus
          className={`w-72 text-center text-2xl py-3 rounded-lg bg-black border-2 text-green-400 placeholder-green-900 outline-none transition-colors ${
            shake ? 'border-red-500 animate-shake' : 'border-green-800 focus:border-green-500'
          }`}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          className="px-8 py-2 bg-green-800 hover:bg-green-700 text-green-200 font-bold rounded-lg transition-colors"
        >
          Submit
        </button>
      </form>

      {/* The "hidden" password — text is very close to background color */}
      <TerminalBox title="system_log.txt">
        <div className="text-green-700 text-sm space-y-1">
          <div>[LOG] Firewall initialized...</div>
          <div>[LOG] Checking security modules...</div>
          <div>[LOG] Password verification active</div>
          <div className="text-[#041a04]">
            [DEBUG] password_override = {password}
          </div>
          <div>[LOG] All systems nominal</div>
        </div>
      </TerminalBox>
      <div className="text-green-900 text-xs mt-4">Hint: Look carefully at everything on screen...</div>
    </>
  );
}

/* ========== Level 3: The Invisible Button ========== */
/* Screen says "No actions available". A hidden clickable element disguised as decoration. */

function Level3({ onComplete }) {
  const [found, setFound] = useState(false);
  const [solved, setSolved] = useState(false);

  if (solved) return <AccessGranted onNext={onComplete} levelNum={3} />;

  return (
    <>
      <div className="text-red-500 text-3xl font-bold mb-4 tracking-wider">SYSTEM LOCKED</div>
      <div className="text-green-700 text-lg mb-6">No actions available. All buttons have been removed.</div>

      <TerminalBox title="security_notice.txt">
        <div className="text-green-700 text-sm space-y-1">
          <div>NOTICE: This terminal has been locked down.</div>
          <div>All interactive elements have been disabled.</div>
          <div>There is absolutely nothing you can click.</div>
          <div className="mt-2 text-green-900">
            (The cursor might change if you find something interesting...)
          </div>
        </div>
      </TerminalBox>

      <div className="mt-10 text-green-800 text-sm flex items-center gap-2">
        <span>Status:</span>
        <span className="text-red-600">LOCKED</span>
        <span className="text-green-800">|</span>
        <span>Uptime: 42d</span>
        <span className="text-green-800">|</span>
        {/* The hidden button is disguised as a status bar element */}
        <button
          onClick={() => {
            if (found) setSolved(true);
            else setFound(true);
          }}
          className="text-green-800 hover:text-green-400 transition-colors cursor-default hover:cursor-pointer"
          title=""
        >
          {found ? '[ OVERRIDE READY - click again ]' : 'Port:8080'}
        </button>
        <span className="text-green-800">|</span>
        <span>Ping: 12ms</span>
      </div>

      {found && (
        <div className="mt-4 text-green-500 text-sm animate-pulse">
          Override module loaded! Click it again to bypass the lock...
        </div>
      )}

      <div className="mt-8 text-green-900 text-xs">
        Hint: Not everything that looks like decoration IS decoration...
      </div>
    </>
  );
}

/* ========== Level 4: The Terminal ========== */
/* A fake terminal. Kids type commands to explore and find the unlock command. */

function Level4({ onComplete }) {
  const [history, setHistory] = useState([
    { type: 'system', text: 'HACK-OS v4.0 — Type "help" for available commands' },
    { type: 'system', text: '3 files found in current directory.' },
  ]);
  const [input, setInput] = useState('');
  const [solved, setSolved] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  const files = {
    'readme.txt': 'Welcome to the secure server.\nAll important commands are listed in the manual.\nRemember: knowledge is power!',
    'manual.txt': 'AVAILABLE COMMANDS:\n  help - show help\n  ls   - list files\n  cat  - read a file\n  ???  - try reading the secret file for more info',
    'secret.txt': 'CLASSIFIED INFORMATION:\nThe unlock command is: open sesame\n\nType exactly: open sesame',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cmd = input.trim().toLowerCase();
    setInput('');
    const newHistory = [...history, { type: 'input', text: `> ${input.trim()}` }];

    if (cmd === 'open sesame') {
      setSolved(true);
      return;
    } else if (cmd === 'help') {
      newHistory.push({ type: 'output', text: 'Commands: help, ls, cat <filename>' });
    } else if (cmd === 'ls') {
      newHistory.push({ type: 'output', text: Object.keys(files).map(f => `  ${f}`).join('\n') });
    } else if (cmd.startsWith('cat ')) {
      const fname = cmd.slice(4).trim();
      if (files[fname]) {
        newHistory.push({ type: 'output', text: files[fname] });
      } else {
        newHistory.push({ type: 'error', text: `File not found: ${fname}` });
      }
    } else if (cmd === '') {
      // nothing
    } else {
      newHistory.push({ type: 'error', text: `Unknown command: ${cmd}` });
    }

    setHistory(newHistory);
  };

  if (solved) return <AccessGranted onNext={onComplete} levelNum={4} />;

  return (
    <>
      <div className="text-green-500 text-xl mb-4 tracking-wider">SECURE TERMINAL</div>

      <div className="w-full border border-green-800 rounded-lg bg-black/90 overflow-hidden">
        <div className="bg-green-900/40 px-4 py-2 text-green-500 text-sm border-b border-green-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
          <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
          <span className="ml-2">terminal</span>
        </div>

        <div ref={scrollRef} className="p-4 h-72 overflow-y-auto text-sm space-y-1">
          {history.map((line, i) => (
            <div key={i} className={
              line.type === 'input' ? 'text-green-300 font-bold' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'system' ? 'text-green-600' :
              'text-green-400'
            } style={{ whiteSpace: 'pre-wrap' }}>
              {line.text}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-green-800 flex">
          <span className="text-green-500 px-3 py-2 text-lg">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-green-300 text-lg py-2 outline-none"
            autoComplete="off"
            spellCheck="false"
          />
        </form>
      </div>

      <div className="mt-4 text-green-900 text-xs">
        Hint: Try "help" to see what commands you can use, then explore the files...
      </div>
    </>
  );
}

/* ========== Level 5: The Switch Puzzle ========== */
/* Toggle switches to the correct positions. Clues hidden in "log entries". */

function Level5({ onComplete }) {
  const [switches, setSwitches] = useState([false, false, false, false, false]);
  // Solution: switches 0, 2, 4 ON — switches 1, 3 OFF
  const solution = [true, false, true, false, true];
  const [solved, setSolved] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const labels = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'];

  const toggle = (idx) => {
    const next = [...switches];
    next[idx] = !next[idx];
    setSwitches(next);
    setShowResult(false);
  };

  const handleTest = () => {
    const correct = switches.every((s, i) => s === solution[i]);
    if (correct) {
      setSolved(true);
    } else {
      setShowResult(true);
    }
  };

  if (solved) return <AccessGranted onNext={onComplete} levelNum={5} />;

  return (
    <>
      <div className="text-green-500 text-xl mb-2 tracking-wider">FIREWALL CONTROL PANEL</div>
      <div className="text-green-700 text-sm mb-6">Set the correct switch configuration to bypass the firewall</div>

      <div className="flex gap-4 mb-8 flex-wrap justify-center">
        {switches.map((on, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[90px] ${
              on
                ? 'border-green-500 bg-green-900/30 shadow-lg shadow-green-500/20'
                : 'border-slate-700 bg-slate-900/50'
            }`}
          >
            <div className={`w-8 h-14 rounded-full border-2 relative transition-all ${
              on ? 'border-green-500 bg-green-900' : 'border-slate-600 bg-slate-800'
            }`}>
              <div className={`w-6 h-6 rounded-full absolute left-0.5 transition-all ${
                on ? 'top-0.5 bg-green-400' : 'bottom-0.5 bg-slate-500'
              }`} />
            </div>
            <span className={`text-xs font-bold ${on ? 'text-green-400' : 'text-slate-500'}`}>
              {labels[i]}
            </span>
            <span className={`text-xs ${on ? 'text-green-600' : 'text-slate-600'}`}>
              {on ? 'ON' : 'OFF'}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={handleTest}
        className="px-8 py-2 bg-green-800 hover:bg-green-700 text-green-200 font-bold rounded-lg transition-colors mb-6"
      >
        Test Configuration
      </button>

      {showResult && (
        <div className="text-red-500 text-sm mb-4 animate-pulse">
          &#9888; INCORRECT CONFIGURATION — Access denied
        </div>
      )}

      <TerminalBox title="firewall_logs.txt">
        <div className="text-green-700 text-xs space-y-1">
          <div>[INFO] Switch diagnostic running...</div>
          <div>[WARN] ALPHA relay must be <span className="text-green-500">active</span> for bypass</div>
          <div>[INFO] BETA relay should remain <span className="text-red-400">inactive</span> — overload risk</div>
          <div>[WARN] GAMMA relay must be <span className="text-green-500">active</span> for bypass</div>
          <div>[INFO] DELTA relay should remain <span className="text-red-400">inactive</span> — overload risk</div>
          <div>[WARN] EPSILON relay must be <span className="text-green-500">active</span> for bypass</div>
          <div>[INFO] Awaiting correct configuration...</div>
        </div>
      </TerminalBox>
    </>
  );
}

/* ========== Level 6: The Decoder ========== */
/* A Caesar cipher. Decode the encrypted word using the provided key. */

function Level6({ onComplete }) {
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(false);

  // Simple Caesar cipher: shift each letter by 3
  const answer = 'UNLOCK';
  const shift = 3;
  const encrypted = answer.split('').map(ch => {
    const code = ch.charCodeAt(0) - 65;
    return String.fromCharCode(((code + shift) % 26) + 65);
  }).join('');
  // UNLOCK shifted by 3 = XQORFN

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim().toUpperCase() === answer) {
      setSolved(true);
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  };

  if (solved) return <AccessGranted onNext={onComplete} levelNum={6} />;

  // Build the decoder ring display
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const shifted = alphabet.split('').map((_, i) =>
    String.fromCharCode(((i + shift) % 26) + 65)
  ).join('');

  return (
    <>
      <div className="text-green-500 text-xl mb-2 tracking-wider">ENCRYPTED TRANSMISSION</div>
      <div className="text-green-700 text-sm mb-6">Decode the secret message to gain access</div>

      <div className="text-4xl font-bold text-red-400 tracking-[0.5em] mb-6 bg-slate-900 px-8 py-4 rounded-lg border border-red-800">
        {encrypted}
      </div>

      <TerminalBox title="decoder_key.txt">
        <div className="text-xs mb-2 text-green-600">Each coded letter maps to the real letter (shift of {shift}):</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-0 text-sm">
          <div>
            {alphabet.slice(0, 13).split('').map((letter, i) => (
              <div key={letter} className="flex gap-2">
                <span className="text-red-400 w-4">{shifted[i]}</span>
                <span className="text-green-700">&rarr;</span>
                <span className="text-green-400 w-4">{letter}</span>
              </div>
            ))}
          </div>
          <div>
            {alphabet.slice(13).split('').map((letter, i) => (
              <div key={letter} className="flex gap-2">
                <span className="text-red-400 w-4">{shifted[i + 13]}</span>
                <span className="text-green-700">&rarr;</span>
                <span className="text-green-400 w-4">{letter}</span>
              </div>
            ))}
          </div>
        </div>
      </TerminalBox>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 mt-6">
        <div className="text-green-600 text-sm">Type the decoded message:</div>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          autoFocus
          placeholder="Decoded message..."
          className={`w-72 text-center text-2xl py-3 rounded-lg bg-black border-2 text-green-400 placeholder-green-900 outline-none transition-colors ${
            shake ? 'border-red-500 animate-shake' : 'border-green-800 focus:border-green-500'
          }`}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          className="px-8 py-2 bg-green-800 hover:bg-green-700 text-green-200 font-bold rounded-lg transition-colors"
        >
          Decrypt
        </button>
      </form>

      <div className="mt-4 text-green-900 text-xs">
        Hint: Find each coded letter on the left, read the real letter on the right
      </div>
    </>
  );
}

/* ========== Main Component ========== */

const LEVELS = [Level1, Level2, Level3, Level4, Level5, Level6];

export default function HackingChallenge({ config = {}, reward, onComplete, onBack }) {
  const totalLevels = Math.min(config.total_levels || DEFAULTS.total_levels, 6);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [done, setDone] = useState(false);

  const handleLevelComplete = useCallback(() => {
    const next = currentLevel + 1;
    if (next >= totalLevels) {
      setDone(true);
      onComplete('hacking', reward);
    } else {
      setCurrentLevel(next);
    }
  }, [currentLevel, totalLevels, reward, onComplete]);

  if (done) {
    return (
      <HackScreen>
        <div className="text-center">
          <div className="text-6xl mb-6">&#128737;&#65039;</div>
          <h2 className="text-4xl font-bold text-green-400 mb-3">SYSTEM BREACHED</h2>
          <p className="text-xl text-green-600 mb-2">All {totalLevels} security layers bypassed!</p>
          <p className="text-2xl text-green-300 mb-8">You earned +{reward} bonus minutes!</p>
          <button
            onClick={onBack}
            className="px-8 py-3 bg-green-800 hover:bg-green-700 text-green-200 text-xl font-bold rounded-lg transition-colors"
          >
            Back to Challenges
          </button>
        </div>
      </HackScreen>
    );
  }

  const LevelComponent = LEVELS[currentLevel];

  return (
    <HackScreen subtitle={`SECURITY LAYER ${currentLevel + 1} / ${totalLevels}`}>
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-30 px-4 py-2 bg-green-900/50 hover:bg-green-800/50 text-green-600 rounded-lg transition-colors text-sm"
      >
        &larr; Back
      </button>

      {/* Level progress dots */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: totalLevels }, (_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${
              i < currentLevel ? 'bg-green-400' :
              i === currentLevel ? 'bg-green-500 ring-2 ring-green-400/50 animate-pulse' :
              'bg-green-900 border border-green-800'
            }`}
          />
        ))}
      </div>

      <LevelComponent onComplete={handleLevelComplete} />

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-10px); }
          80% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </HackScreen>
  );
}
