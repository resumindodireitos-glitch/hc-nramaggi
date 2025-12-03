import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Login from "./pages/Login";
import AdminSettings from "./pages/AdminSettings";

import Dashboard from "./pages/Dashboard";
import Forms from "./pages/Forms";
import FormSubmit from "./pages/FormSubmit";
import Submissions from "./pages/Submissions";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import AdminForms from "./pages/AdminForms";
import FormBuilder from "./pages/FormBuilder";
import ReviewReport from "./pages/ReviewReport";
import UserManagement from "./pages/UserManagement";
import BulkGeneration from "./pages/BulkGeneration";
import OrganizationManagement from "./pages/OrganizationManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
