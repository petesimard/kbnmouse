import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Menu from './pages/Menu.jsx'
import TestContent from './pages/TestContent.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { getBuiltinApps, getBuiltinComponents } from './components/builtin'

const builtinComponents = getBuiltinComponents()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/menu" element={<Menu />} />
        <Route path="/test-content" element={<TestContent />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {getBuiltinApps().map(({ key }) => {
          const Component = builtinComponents[key]
          return Component ? <Route key={key} path={`/builtin/${key}`} element={<Component />} /> : null
        })}
        <Route path="/" element={<Navigate to="/test-content" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
