import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

// Auth pages
import Login from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';

// Dashboard
import Dashboard from '../pages/dashboard/Dashboard';

// 404 fallback
import NotFound from '../pages/NotFound';

// Hospitals
import HospitalList from '../pages/hospitals/HospitalList';
import HospitalDetail from '../pages/hospitals/HospitalDetail';

// Plans
import PlanList from '../pages/plans/PlanList';

// Billing
import BillingList from '../pages/billing/BillingList';
import BillingDetail from '../pages/billing/BillingDetail';
import RevenueDetails from '../pages/revenue/RevenueDetails';
import RecurringRevenueDetails from '../pages/revenue/RecurringRevenueDetails';

// Invoices
import InvoiceList from '../pages/invoices/InvoiceList';
import InvoiceDetail from '../pages/invoices/InvoiceDetail';

// Coupons
import CouponList from '../pages/coupons/CouponList';

// Announcements
import AnnouncementList from '../pages/announcements/AnnouncementList';

// Support
import TicketList from '../pages/support/TicketList';
import TicketDetail from '../pages/support/TicketDetail';

// FAQs
import FAQList from '../pages/faqs/FAQList';

// Activity Logs
import ActivityLogList from '../pages/activity-logs/ActivityLogList';

// Reports
import ReportsDashboard from '../pages/reports/ReportsDashboard';

// Settings
import SettingsPage from '../pages/settings/SettingsPage';

// Security — platform-admin IP allowlist
import SecurityPage from '../pages/security/SecurityPage';

// Access Management — per-hospital role permission editor
import AccessManagement from '../pages/access/AccessManagement';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/hospitals" element={<HospitalList />} />
        <Route path="/hospitals/:id" element={<HospitalDetail />} />
        <Route path="/plans" element={<PlanList />} />
        <Route path="/billing" element={<BillingList />} />
        <Route path="/billing/:id" element={<BillingDetail />} />
        <Route path="/revenue" element={<RevenueDetails />} />
        <Route path="/recurring-revenue" element={<RecurringRevenueDetails />} />
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/coupons" element={<CouponList />} />
        <Route path="/announcements" element={<AnnouncementList />} />
        <Route path="/support" element={<TicketList />} />
        <Route path="/support/:id" element={<TicketDetail />} />
        <Route path="/faqs" element={<FAQList />} />
        <Route path="/activity-logs" element={<ActivityLogList />} />
        <Route path="/reports" element={<ReportsDashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/access-management" element={<AccessManagement />} />

        {/* 404 — confused-nurse illustration, sidebar + topbar visible */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
