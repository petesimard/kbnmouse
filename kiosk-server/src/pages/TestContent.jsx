function TestContent() {
  return (
    <div className="h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center text-white">
      <h1 className="text-5xl font-bold mb-4">Welcome!</h1>
      <p className="text-xl text-white/80 mb-8">Choose an app from the menu below</p>

      {/* App categories */}
      <div className="grid grid-cols-2 gap-6 max-w-2xl">
        <div className="bg-white/10 backdrop-blur rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Learning</h2>
          <p className="text-sm text-white/70">Educational apps and resources</p>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Creative</h2>
          <p className="text-sm text-white/70">Drawing, coding, and making</p>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Games</h2>
          <p className="text-sm text-white/70">Fun and educational games</p>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Videos</h2>
          <p className="text-sm text-white/70">Kid-friendly video content</p>
        </div>
      </div>
    </div>
  );
}

export default TestContent;
