import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import { ModalProvider } from '../shared/context/ModalContext'
import { ThemeProvider } from '../shared/context/ThemeContext'
import ScrollRestoration from './ScrollRestoration'
import ProtectedAdminRoute from './ProtectedAdminRoute'

import LoginPage from '../features/auth/pages/LoginPage'
import HomePage from '../features/home/pages/HomePage'
import ExamSessionPage from '../features/exam/pages/ExamSessionPage'
import MistakeBankPage from '../features/mistake-bank/pages/MistakeBankPage'
import AnalyticsPage from '../features/analytics/pages/AnalyticsPage'
import ProfilePage from '../features/profile/pages/ProfilePage'

function AppRoutes() {
  const { pathname } = useLocation()
  const hasNavbar = pathname !== '/login'
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionEnded =
        event === 'SIGNED_OUT' ||
        (event === 'TOKEN_REFRESHED' && !session) ||
        (event === 'INITIAL_SESSION' && !session)
      if (sessionEnded && pathname !== '/login') {
        navigate('/login', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate, pathname])

  return (
    <>
      <ScrollRestoration />
      <div className={hasNavbar ? 'pt-16' : ''}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/exam/:categoryId" element={<ExamSessionPage />} />
          <Route path="/mistakes" element={<MistakeBankPage />} />
          <Route path="/mistake-bank" element={<MistakeBankPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/*" element={<ProtectedAdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <ModalProvider>
          <AppRoutes />
        </ModalProvider>
      </ThemeProvider>
    </Router>
  )
}
