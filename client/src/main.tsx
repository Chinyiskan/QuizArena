import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Home from './pages/Home.tsx'
import Play from './pages/Play.tsx'
import Admin from './pages/Admin.tsx'
import Editor from './pages/Editor.tsx'
import Host from './pages/Host.tsx'
import Reports from './pages/Reports.tsx'
import Report from './pages/Report.tsx'
import { MotionConfig } from 'motion/react'
import ErrorBoundary from './ErrorBoundary.tsx'
import { installClicks } from './sound.ts'

installClicks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/:pin" element={<Play />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/lessons/:id" element={<Editor />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/reports/:id" element={<Report />} />
        <Route path="/host/:pin" element={<Host />} />
      </Routes>
    </BrowserRouter>
    </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
