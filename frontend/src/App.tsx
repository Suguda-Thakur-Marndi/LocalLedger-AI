import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanionProvider } from './lib/CompanionContext'
import { CompanionModal } from './components/CompanionModal'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ReceiptsPage } from './features/receipts/ReceiptsPage'
import { UploadPage } from './features/receipts/UploadPage'
import { ReceiptReviewPage } from './features/receipts/ReceiptReviewPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { SettingsPage } from './features/settings/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <CompanionProvider>
        <BrowserRouter>
          <CompanionModal />
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="receipts" element={<ReceiptsPage />} />
              <Route path="upload" element={<UploadPage />} />
              <Route path="review" element={<ReceiptReviewPage />} />
              <Route path="review/:documentId" element={<ReceiptReviewPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CompanionProvider>
    </QueryClientProvider>
  )
}

export default App
