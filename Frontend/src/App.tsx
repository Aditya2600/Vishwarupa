import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import MyVideos from "./pages/MyVideos.tsx";
import NotFound from "./pages/NotFound.tsx";
import TemplateLibrary from "./pages/TemplateLibrary.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import BulkSend from "./pages/BulkSend.tsx";
import Admin from "./pages/Admin.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import PdfSummarizer from "./pages/PdfSummarizer.tsx";
import PublicPDF from "./pages/PublicPDF.tsx";
import InteractiveLoanOffer from "./pages/InteractiveLoanOffer.tsx";
import InteractiveLoanReminder from "./pages/InteractiveLoanReminder.tsx";

// Must live inside <AuthProvider> so useAuth() works
const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  // Also check localStorage as fallback: React state may not have committed yet
  // right after login + navigate. localStorage is set synchronously before navigate.
  const isAdmin = user?.isAdmin || localStorage.getItem("is_admin") === "true";
  if (!isAuthenticated || !isAdmin) return <Navigate to="/admin-login" state={{ from: location }} replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/admin-login" element={<AdminLogin />} />

    <Route path="/" element={<ProtectedRoute><MyVideos /></ProtectedRoute>} />
    <Route path="/templates" element={<ProtectedRoute><TemplateLibrary /></ProtectedRoute>} />
    <Route path="/create" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/bulk" element={<ProtectedRoute><BulkSend /></ProtectedRoute>} />
    <Route path="/pdf-summarizer" element={<ProtectedRoute><PdfSummarizer /></ProtectedRoute>} />
    <Route path="/admin" element={<AdminProtectedRoute><Admin /></AdminProtectedRoute>} />
    <Route path="/s/:id" element={<PublicPDF />} />
    <Route path="/loan-offer/:id" element={<InteractiveLoanOffer />} />
    <Route path="/loan-reminder/:id" element={<InteractiveLoanReminder />} />

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner duration={3000} />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
