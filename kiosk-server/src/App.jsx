function App() {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-[0_0_90%] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        {/* Main content goes here */}
        <h1>Hello World</h1>
      </div>
      <div className="flex-[0_0_10%] bg-slate-800 flex items-center justify-center px-5">
        <span className="text-slate-400 text-sm">Menu Bar</span>
      </div>
    </div>
  )
}

export default App
