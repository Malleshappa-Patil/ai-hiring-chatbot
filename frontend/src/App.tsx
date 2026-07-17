import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'

import Layout from '@/components/common/Layout'
import ProtectedRoute from '@/components/common/ProtectedRoute'

import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import JobManagement from '@/pages/JobManagement'
import CandidateList from '@/pages/CandidateList'
import WorkflowMonitor from '@/pages/WorkflowMonitor'
import Analytics from '@/pages/Analytics'
import OnboardingTracker from '@/pages/OnboardingTracker'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — wrapped in sidebar layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"   element={<Dashboard />} />
              <Route path="/jobs"        element={<JobManagement />} />
              <Route path="/candidates"  element={<CandidateList />} />
              <Route path="/workflow"    element={<WorkflowMonitor />} />
              <Route path="/analytics"   element={<Analytics />} />
              <Route path="/onboarding"  element={<OnboardingTracker />} />
            </Route>
          </Route>

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>

      {/* Global toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#e8e8e8',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            fontSize: '14px',
          },
          duration: 4000,
        }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App
