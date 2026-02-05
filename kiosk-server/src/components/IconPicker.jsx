import { useState, useRef, useEffect } from 'react';

const EMOJI_CATEGORIES = {
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🦟','🐢','🐍','🦎','🐙','🦑','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🐘','🦛','🐪','🦒','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔'],
  'Food': ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🧇','🥞','🧀','🍖','🍗','🥩','🌭','🍔','🍟','🍕','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🍿','🧈','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍣','🍤','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','☕','🍵','🧃','🥤','🧋','🍶','🍺','🥛','🧊'],
  'Activities': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥅','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤸','⛹️','🤾','🏊','🚴','🧗','🤹','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🎻','🎲','♟️','🎯','🎳','🎮','🕹️','🧩','🪀','🪁','🎰','🎗️'],
  'Travel': ['🚗','🚕','🚙','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛺','🚏','🚃','🚄','🚅','🚆','🚇','🚈','🚂','✈️','🛫','🛬','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','🏠','🏡','🏢','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','🗼','🗽','🏖️','🏝️','⛰️','🌋','🗻','🏕️','🏜️'],
  'Nature': ['🌸','💐','🌷','🌹','🥀','🌺','🌻','🌼','🌱','🪴','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂','🍃','🍄','🪨','💎','🌍','🌎','🌏','🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌙','🌚','🌛','🌜','☀️','🌤️','⛅','🌦️','🌈','☁️','🌧️','⛈️','🌩️','❄️','☃️','⛄','🌬️','💨','🌊','💧','💦','🔥','⭐','🌟','✨','💫','🌠'],
  'Objects': ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💾','💿','📀','🎥','📷','📹','📼','🔍','🔎','💡','🔦','🏮','📔','📕','📖','📗','📘','📙','📚','📓','📒','📃','📜','📄','✏️','🖊️','🖋️','🖌️','🖍️','📝','🔑','🗝️','🔨','🪓','⛏️','🔧','🔩','⚙️','🧲','🪜','🧰','🧪','🧫','🔬','🔭','📡','🛠️','🪚','🏗️'],
  'Symbols': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','👁️‍🗨️','🔚','🔙','🔛','🔝','🔜','〰️','➰','➿','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢'],
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
};

const ALL_EMOJI = Object.values(EMOJI_CATEGORIES).flat();

function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('emoji');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const pickerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close picker on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filteredEmoji = search
    ? ALL_EMOJI.filter((e) => e.includes(search))
    : null;

  const handleEmojiClick = (emoji) => {
    onChange(emoji);
    setOpen(false);
    setSearch('');
  };

  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxSize = 128;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            const scale = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await resizeImage(file);
    setUploadPreview(dataUrl);
  };

  const handleUpload = async () => {
    if (!uploadPreview) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/uploads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token,
        },
        body: JSON.stringify({ data: uploadPreview }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const { path } = await res.json();
      onChange(path);
      setOpen(false);
      setUploadPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const isImage = value?.startsWith('/');

  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        Icon
      </label>

      {/* Current icon preview / trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-16 bg-slate-700 border border-slate-600 rounded-lg text-white flex items-center justify-center gap-3 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {value ? (
          isImage ? (
            <img src={value} alt="" className="w-10 h-10 object-contain" />
          ) : (
            <span className="text-4xl">{value}</span>
          )
        ) : (
          <span className="text-slate-500">Click to pick an icon</span>
        )}
      </button>

      {/* Picker dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 left-0 right-0 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-600">
            <button
              type="button"
              onClick={() => setTab('emoji')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'emoji'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Emoji
            </button>
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'upload'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Upload Image
            </button>
          </div>

          {tab === 'emoji' && (
            <div className="p-3">
              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type emoji to filter..."
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-3"
              />

              {/* Emoji grid */}
              <div className="max-h-64 overflow-y-auto space-y-3">
                {filteredEmoji ? (
                  <div className="grid grid-cols-8 gap-1">
                    {filteredEmoji.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleEmojiClick(emoji)}
                        className={`w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-slate-600 transition-colors ${
                          value === emoji ? 'bg-blue-600/30 ring-2 ring-blue-500' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                    {filteredEmoji.length === 0 && (
                      <p className="col-span-8 text-slate-500 text-sm text-center py-4">No emoji match</p>
                    )}
                  </div>
                ) : (
                  Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <div key={category}>
                      <h4 className="text-xs text-slate-400 font-medium mb-1 sticky top-0 bg-slate-800 py-1">{category}</h4>
                      <div className="grid grid-cols-8 gap-1">
                        {emojis.map((emoji, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            className={`w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-slate-600 transition-colors ${
                              value === emoji ? 'bg-blue-600/30 ring-2 ring-blue-500' : ''
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div className="p-4 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                onChange={handleFileSelect}
                className="w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 file:cursor-pointer"
              />
              <p className="text-xs text-slate-500">
                PNG, JPG, GIF, SVG, or WebP. Will be resized to 128x128 max. Limit 1MB.
              </p>

              {uploadPreview && (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center">
                    <img src={uploadPreview} alt="Preview" className="max-w-full max-h-full object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {uploading ? 'Uploading...' : 'Use This Image'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IconPicker;
