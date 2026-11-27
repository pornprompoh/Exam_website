import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import AdminLayout from './AdminLayout'

export default function ProtectedAdminRoute() {
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('student')

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setUserRole('student')
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      setUserRole(data?.role || 'student')
      setLoading(false)
    }
    checkRole()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-white font-sans">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm">กำลังตรวจสอบสิทธิ์การเข้าใช้งานศูนย์ควบคุม...</p>
      </div>
    )
  }

  const canAccessAdmin = userRole === 'admin' || userRole === 'creator'
  return canAccessAdmin ? <AdminLayout userRole={userRole} /> : <Navigate to="/" replace />
}
