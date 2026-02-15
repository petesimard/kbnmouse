import { useState, useEffect, useRef } from 'react';
import { useImageStorage } from '../../hooks/useImageStorage';

export const meta = {
  key: 'imagegen',
  name: 'Image Generator',
  icon: '🖼️',
  description: 'Create images with AI'
};

function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [appId, setAppId] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [modalImage, setModalImage] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const galleryRef = useRef(null);

  const { images, loading: imagesLoading, saveImage, deleteImage, clearAll } = useImageStorage();

  useEffect(() => {
    async function findApp() {
      try {
        const res = await fetch('/api/apps');
        const apps = await res.json();
        const imagegenApp = apps.find(a => a.app_type === 'builtin' && a.url === 'imagegen');
        if (imagegenApp) {
          setAppId(imagegenApp.id);
        } else {
          setConfigError('Image Generator app not found');
        }
      } catch (err) {
        setConfigError('Failed to load app configuration');
      }
    }
    findApp();
  }, []);

  // Focus input after loading completes
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalImage) {
        setModalImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalImage]);

  const generateImage = async () => {
    if (!prompt.trim() || loading || !appId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/imagegen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, prompt: prompt.trim() }),
      });
      const data = await res.json();

      if (data.error === 'content_policy') {
        setError(data.message || 'Your prompt was rejected. Please try something different.');
        return;
      }
      if (data.error === 'rate_limit') {
        setError(data.message || 'Too many requests. Please wait a moment.');
        return;
      }
      if (data.error) {
        setError(data.message || 'Something went wrong. Please try again.');
        return;
      }

      const newImage = await saveImage(prompt.trim(), data.imageData);
      setCurrentImage(newImage);
      setPrompt('');

      // Scroll gallery to start
      if (galleryRef.current) {
        galleryRef.current.scrollLeft = 0;
      }
    } catch (err) {
      setError('Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateImage();
    }
  };

  const handleDownload = (image) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${image.imageData}`;
    link.download = `image-${image.id}.png`;
    link.click();
  };

  const handleDelete = async (image) => {
    await deleteImage(image.id);
    if (currentImage?.id === image.id) {
      setCurrentImage(images.find(img => img.id !== image.id) || null);
    }
    if (modalImage?.id === image.id) {
      setModalImage(null);
    }
  };

  const handleClearAll = async () => {
    await clearAll();
    setCurrentImage(null);
  };

  if (configError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="text-8xl mb-6">❌</div>
          <h1 className="text-3xl font-bold text-white mb-4">Error</h1>
          <p className="text-slate-300 text-lg">{configError}</p>
        </div>
      </div>
    );
  }

  const displayImage = currentImage || images[0];

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-800/50 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🖼️</span>
            <div>
              <h1 className="text-xl font-bold text-white">Image Generator</h1>
              <p className="text-slate-400 text-sm">Create images with AI</p>
            </div>
          </div>
          <button
            onClick={handleClearAll}
            disabled={images.length === 0 || loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>🗑️</span>
            Clear All
          </button>
        </div>
      </div>

      {/* Main Image Display */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full" />
              <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-4 border-4 border-blue-500/30 rounded-full" />
              <div className="absolute inset-4 border-4 border-blue-500 rounded-full border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <p className="text-slate-300 text-lg">Creating your image...</p>
          </div>
        ) : displayImage ? (
          <div className="max-h-full max-w-full">
            <img
              src={`data:image/png;base64,${displayImage.imageData}`}
              alt={displayImage.prompt}
              className="max-h-[calc(100vh-280px)] max-w-full object-contain rounded-xl shadow-2xl cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
              onClick={() => setModalImage(displayImage)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">✨</div>
            <p className="text-slate-400 text-lg">No images yet</p>
            <p className="text-slate-500 text-sm mt-2">Type a prompt below to create an image!</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 bg-slate-800/50 border-t border-slate-700 p-4">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the image you want to create..."
            disabled={loading || !appId}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={generateImage}
            disabled={loading || !prompt.trim() || !appId}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Gallery */}
      {images.length > 0 && (
        <div className="flex-shrink-0 bg-slate-900/50 border-t border-slate-700 h-24 p-2">
          <div
            ref={galleryRef}
            className="flex gap-2 h-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent snap-x snap-mandatory"
          >
            {images.map((image) => (
              <button
                key={image.id}
                onClick={() => setCurrentImage(image)}
                className={`flex-shrink-0 h-full aspect-square rounded-lg overflow-hidden snap-start transition-all ${
                  currentImage?.id === image.id
                    ? 'ring-2 ring-purple-500 scale-95'
                    : 'hover:ring-2 hover:ring-slate-500'
                }`}
              >
                <img
                  src={`data:image/png;base64,${image.imageData}`}
                  alt={image.prompt}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`data:image/png;base64,${modalImage.imageData}`}
              alt={modalImage.prompt}
              className="max-h-[80vh] max-w-full object-contain rounded-xl"
            />
            <div className="mt-4 text-center">
              <p className="text-slate-300 text-sm mb-4 max-w-xl mx-auto">{modalImage.prompt}</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleDownload(modalImage)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>⬇️</span>
                  Download
                </button>
                <button
                  onClick={() => handleDelete(modalImage)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>🗑️</span>
                  Delete
                </button>
                <button
                  onClick={() => setModalImage(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageGenerator;
