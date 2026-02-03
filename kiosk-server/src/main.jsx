import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Menu from './pages/Menu.jsx'
import TestContent from './pages/TestContent.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { Clock, Drawing, Timer } from './components/builtin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/menu" element={<Menu />} />
        <Route path="/test-content" element={<TestContent />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/builtin/clock" element={<Clock />} />
        <Route path="/builtin/drawing" element={<Drawing />} />
        <Route path="/builtin/timer" element={<Timer />} />
        <Route path="/" element={<Navigate to="/test-content" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
