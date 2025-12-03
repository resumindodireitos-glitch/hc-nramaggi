import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { MorphingSquare } from "@/components/ui/morphing-square";

// Non-lazy loaded (critical paths)
import Index from "./pages/Index";
import Login from "./pages/Login";
import PublicFormSubmit from "./pages/PublicFormSubmit";

// Lazy loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Forms = lazy(() => import("./pages/Forms"));
const FormSubmit = lazy(() => import("./pages/FormSubmit"));
const Submissions = lazy(() => import("./pages/Submissions"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const AdminForms = lazy(() => import("./pages/AdminForms"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const ReviewReport = lazy(() => import("./pages/ReviewReport"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const BulkGeneration = lazy(() => import("./pages/BulkGeneration"));
const OrganizationManagement = lazy(() => import("./pages/OrganizationManagement"));
const AIPromptsManagement = lazy(() => import("./pages/AIPromptsManagement"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const AIUsagePanel = lazy(() => import("./pages/AIUsagePanel"));
const SubmissionsManagement = lazy(() => import("./pages/SubmissionsManagement"));
const SystemLogs = lazy(() => import("./pages/SystemLogs"));
const Profile = lazy(() => import("./pages/Profile"));
const SystemUpdates = lazy(() => import("./pages/SystemUpdates"));
const LGPDManagement = lazy(() => import("./pages/LGPDManagement"));
const RiskMatrixDashboard = lazy(() => import("./pages/RiskMatrixDashboard"));
const AggregatedReports = lazy(() => import("./pages/AggregatedReports"));
const CronJobsDashboard = lazy(() => import("./pages/CronJobsDashboard"));
const WebhookConfiguration = lazy(() => import("./pages/WebhookConfiguration"));
const FormCalculationConfig = lazy(() => import("./pages/FormCalculationConfig"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Page loader component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <MorphingSquare message="Carregando..." />
  </div>
);

// Optimized QueryClient with caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/f/:id" element={<PublicFormSubmit />} />
                <Route path="/responder/:id" element={<PublicFormSubmit />} />
                
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/forms"
                  element={
                    <ProtectedRoute>
                      <Forms />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/forms/:id"
                  element={
                    <ProtectedRoute>
                      <FormSubmit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/submissions"
                  element={
                    <ProtectedRoute>
                      <Submissions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/submissions/:id/report"
                  element={
                    <ProtectedRoute>
                      <ReportDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports/:id"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ReportDetail />
                    </ProtectedRoute>
                  }
                />
                {/* Admin Routes */}
                <Route
                  path="/admin/forms"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminForms />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/forms/new"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FormBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/forms/:id"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FormBuilder />
                    </ProtectedRoute>
                  }
                />
                {/* Review & User Management Routes */}
                <Route
                  path="/reports/:id/review"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ReviewReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute requireAdmin>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/bulk"
                  element={
                    <ProtectedRoute requireAdmin>
                      <BulkGeneration />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/organization"
                  element={
                    <ProtectedRoute requireAdmin>
                      <OrganizationManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/prompts"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AIPromptsManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/agents"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AIAgents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/ai-usage"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AIUsagePanel />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/submissions"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SubmissionsManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/logs"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SystemLogs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/updates"
                  element={
                    <ProtectedRoute>
                      <SystemUpdates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/lgpd"
                  element={
                    <ProtectedRoute requireAdmin>
                      <LGPDManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/risk-matrix"
                  element={
                    <ProtectedRoute requireAdmin>
                      <RiskMatrixDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/aggregated-reports"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AggregatedReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/cron-jobs"
                  element={
                    <ProtectedRoute requireAdmin>
                      <CronJobsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/webhooks"
                  element={
                    <ProtectedRoute requireAdmin>
                      <WebhookConfiguration />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/forms/:id/calculation"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FormCalculationConfig />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
