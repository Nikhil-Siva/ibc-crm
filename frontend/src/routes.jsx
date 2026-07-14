import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';

// Lazy load all pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Followups = lazy(() => import('./pages/Followups'));
const Renewals = lazy(() => import('./pages/Renewals'));
const Agents = lazy(() => import('./pages/Agents'));
const Reports = lazy(() => import('./pages/Reports'));

// New NeoDove feature pages
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const PipelineManagement = lazy(() => import('./pages/PipelineManagement'));
const ContactImport = lazy(() => import('./pages/ContactImport'));
const Integrations = lazy(() => import('./pages/Integrations'));
const FormBuilder = lazy(() => import('./pages/FormBuilder'));
const CallReport = lazy(() => import('./pages/CallReport'));
const LoginReport = lazy(() => import('./pages/LoginReport'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const SmsAutomation = lazy(() => import('./pages/SmsAutomation'));
const WorkflowBuilder = lazy(() => import('./pages/WorkflowBuilder'));

// New pages
const TelecallerDashboard = lazy(() => import('./pages/TelecallerDashboard'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const UserManagement = lazy(() => import('./pages/UserManagement'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" tip="Loading..." />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin' && user?.role !== 'manager') return <Navigate to="/dashboard" />;
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
};

const TelecallerRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'agent') return <Navigate to="/dashboard" />;
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
};

// Smart dashboard router — agents go to telecaller-dashboard, others see Dashboard
const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'agent') {
    return <Navigate to="/telecaller-dashboard" replace />;
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <Dashboard />
    </Suspense>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Suspense fallback={<PageLoader />}><Signup /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />

      <Route path="/" element={<Navigate to="/dashboard" />} />

      {/* Smart dashboard redirect */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />

      {/* Existing Protected Routes */}
      <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
      <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
      <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
      <Route path="/followups" element={<ProtectedRoute><Followups /></ProtectedRoute>} />
      <Route path="/renewals" element={<ProtectedRoute><Renewals /></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
      <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />

      {/* Telecaller-only route */}
      <Route path="/telecaller-dashboard" element={<TelecallerRoute><TelecallerDashboard /></TelecallerRoute>} />

      {/* Admin-only: User Management */}
      <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />

      {/* New NeoDove Feature Routes */}
      <Route path="/campaigns" element={<AdminRoute><Campaigns /></AdminRoute>} />
      <Route path="/campaigns/:id" element={<AdminRoute><CampaignDetail /></AdminRoute>} />
      <Route path="/pipelines" element={<AdminRoute><PipelineManagement /></AdminRoute>} />
      <Route path="/contact-import" element={<AdminRoute><ContactImport /></AdminRoute>} />
      <Route path="/integrations" element={<AdminRoute><Integrations /></AdminRoute>} />
      <Route path="/form-builder/:campaignId" element={<AdminRoute><FormBuilder /></AdminRoute>} />
      <Route path="/reports/calls" element={<AdminRoute><CallReport /></AdminRoute>} />
      <Route path="/reports/login" element={<AdminRoute><LoginReport /></AdminRoute>} />
      <Route path="/marketplace" element={<AdminRoute><Marketplace /></AdminRoute>} />
      <Route path="/sms-automation" element={<AdminRoute><SmsAutomation /></AdminRoute>} />
      <Route path="/workflows" element={<AdminRoute><WorkflowBuilder /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

export default AppRoutes;
