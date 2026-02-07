import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { ProfileProvider } from './contexts/ProfileContext'
import Menu from './pages/Menu.jsx'
import ProfileSelect from './pages/ProfileSelect.jsx'
import TestContent from './pages/TestContent.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AppsPage from './pages/dashboard/AppsPage.jsx'
import ChallengesPage from './pages/dashboard/ChallengesPage.jsx'
import AppUsagePage from './pages/dashboard/AppUsagePage.jsx'
import SettingsPage from './pages/dashboard/SettingsPage.jsx'
import ProfilesPage from './pages/dashboard/ProfilesPage.jsx'
import KiosksPage from './pages/dashboard/KiosksPage.jsx'
import GameManage from './pages/GameManage.jsx'
import { getBuiltinApps, getBuiltinComponents } from './components/builtin'

const builtinComponents = getBuiltinComponents()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ProfileProvider>
        <Routes>
          <Route path="/menu" element={<Menu />} />
          <Route path="/profiles" element={<ProfileSelect />} />
          <Route path="/test-content" element={<TestContent />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<AppsPage />} />
            <Route path="challenges" element={<ChallengesPage />} />
            <Route path="usage" element={<AppUsagePage />} />
            <Route path="profiles" element={<ProfilesPage />} />
            <Route path="kiosks" element={<KiosksPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/game/:id" element={<GameManage />} />
          {getBuiltinApps().map(({ key }) => {
            const Component = builtinComponents[key]
            return Component ? <Route key={key} path={`/builtin/${key}`} element={<Component />} /> : null
          })}
          <Route path="/" element={<Navigate to="/test-content" replace />} />
        </Routes>
      </ProfileProvider>
    </BrowserRouter>
  </StrictMode>,
)
