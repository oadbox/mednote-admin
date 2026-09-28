const PLATFORM = '/platform';

const endpoints = {
  // Auth
  auth: {
    login: `${PLATFORM}/auth/login`,
    forgotPassword: `${PLATFORM}/auth/forgot-password`,
    resetPassword: `${PLATFORM}/auth/reset-password`,
    me: `${PLATFORM}/auth/me`,
    changePassword: `${PLATFORM}/auth/change-password`,
  },

  // Dashboard
  dashboard: {
    stats: `${PLATFORM}/dashboard/stats`,
    hospitalGrowth: `${PLATFORM}/dashboard/hospital-growth`,
    recentHospitals: `${PLATFORM}/dashboard/recent-hospitals`,
    revenueOverview: `${PLATFORM}/dashboard/revenue-overview`,
    supportOverview:  `${PLATFORM}/dashboard/support-overview`,
    recurringRevenue: `${PLATFORM}/dashboard/recurring-revenue`,
    planDistribution: `${PLATFORM}/dashboard/plan-distribution`,
    upcomingRenewals: `${PLATFORM}/dashboard/upcoming-renewals`,
    revenueBreakdown: `${PLATFORM}/dashboard/revenue-breakdown`,
  },

  // Hospitals
  hospitals: {
    list: `${PLATFORM}/hospitals`,
    create: `${PLATFORM}/hospitals`,
    get: (id) => `${PLATFORM}/hospitals/${id}`,
    update: (id) => `${PLATFORM}/hospitals/${id}`,
    delete: (id) => `${PLATFORM}/hospitals/${id}`,
    hardReset: (id) => `${PLATFORM}/hospitals/${id}/hard-reset`,
    repair: (id) => `${PLATFORM}/hospitals/${id}/repair`,
    toggleStatus: (id) => `${PLATFORM}/hospitals/${id}/toggle-status`,
    stats: (id) => `${PLATFORM}/hospitals/${id}/stats`,
    subscriptions: (id) => `${PLATFORM}/hospitals/${id}/subscriptions`,
    sweepExpiredTrials: `${PLATFORM}/hospitals/sweep-expired-trials`,
    resetAdminPassword: (id) => `${PLATFORM}/hospitals/${id}/reset-admin-password`,
    accessControl: (id) => `${PLATFORM}/hospitals/${id}/access-control`,
    saveAccessRole: (id, role) => `${PLATFORM}/hospitals/${id}/access-control/${role}`,
    modules: (id) => `${PLATFORM}/hospitals/${id}/modules`,
  },

  // Coupons
  coupons: {
    list: `${PLATFORM}/coupons`,
    create: `${PLATFORM}/coupons`,
    get: (id) => `${PLATFORM}/coupons/${id}`,
    update: (id) => `${PLATFORM}/coupons/${id}`,
    delete: (id) => `${PLATFORM}/coupons/${id}`,
    validate: `${PLATFORM}/coupons/validate`,
  },

  // Invoices
  invoices: {
    list: `${PLATFORM}/invoices`,
    create: `${PLATFORM}/invoices`,
    get: (id) => `${PLATFORM}/invoices/${id}`,
    update: (id) => `${PLATFORM}/invoices/${id}`,
    issue: (id) => `${PLATFORM}/invoices/${id}/issue`,
    print: (id) => `${PLATFORM}/invoices/${id}/print`,
    markPaid: (id) => `${PLATFORM}/invoices/${id}/mark-paid`,
    voidInvoice: (id) => `${PLATFORM}/invoices/${id}/void`,
  },

  // Plans
  plans: {
    list: `${PLATFORM}/plans`,
    modules: `${PLATFORM}/plans/modules`,
    create: `${PLATFORM}/plans`,
    get: (id) => `${PLATFORM}/plans/${id}`,
    update: (id) => `${PLATFORM}/plans/${id}`,
    delete: (id) => `${PLATFORM}/plans/${id}`,
  },

  // Billing / Subscriptions
  billing: {
    list: `${PLATFORM}/billing`,
    get: (id) => `${PLATFORM}/billing/${id}`,
    stats: `${PLATFORM}/billing/stats`,
    recordPayment: (id) => `${PLATFORM}/billing/${id}/payment`,
    renew: (id) => `${PLATFORM}/billing/${id}/renew`,
  },

  // FAQs
  faqs: {
    list: `${PLATFORM}/faqs`,
    create: `${PLATFORM}/faqs`,
    get: (id) => `${PLATFORM}/faqs/${id}`,
    update: (id) => `${PLATFORM}/faqs/${id}`,
    delete: (id) => `${PLATFORM}/faqs/${id}`,
    reorder: `${PLATFORM}/faqs/reorder`,
  },

  // FAQ Categories
  faqCategories: {
    list: `${PLATFORM}/faq-categories`,
    create: `${PLATFORM}/faq-categories`,
    get: (id) => `${PLATFORM}/faq-categories/${id}`,
    update: (id) => `${PLATFORM}/faq-categories/${id}`,
    delete: (id) => `${PLATFORM}/faq-categories/${id}`,
  },

  // Activity Logs
  activityLogs: {
    list: `${PLATFORM}/activity-logs`,
    get: (id) => `${PLATFORM}/activity-logs/${id}`,
  },

  // Reports
  reports: {
    overview: `${PLATFORM}/reports/overview`,
    revenue: `${PLATFORM}/reports/revenue`,
    hospitals: `${PLATFORM}/reports/hospitals`,
    plans: `${PLATFORM}/reports/plans`,
    mrr: `${PLATFORM}/reports/mrr`,
  },

  // Impersonation
  impersonate: (hospitalId) => `${PLATFORM}/impersonate/${hospitalId}`,

  // Announcements
  announcements: {
    list: `${PLATFORM}/announcements`,
    create: `${PLATFORM}/announcements`,
    get: (id) => `${PLATFORM}/announcements/${id}`,
    update: (id) => `${PLATFORM}/announcements/${id}`,
    delete: (id) => `${PLATFORM}/announcements/${id}`,
  },

  // Support tickets (admin inbox)
  support: {
    list: `${PLATFORM}/support-tickets`,
    get: (id) => `${PLATFORM}/support-tickets/${id}`,
    update: (id) => `${PLATFORM}/support-tickets/${id}`,
    reply: (id) => `${PLATFORM}/support-tickets/${id}/messages`,
    stats: `${PLATFORM}/support-tickets/stats`,
  },

  // Public platform settings (no auth)
  publicSettings: `${PLATFORM}/public-settings`,

  // Notifications
  notifications: {
    list: `${PLATFORM}/notifications`,
  },

  // Settings
  settings: {
    profile: `${PLATFORM}/settings/profile`,
    updateProfile: `${PLATFORM}/settings/profile`,
    changePassword: `${PLATFORM}/settings/profile/password`,
    platform: `${PLATFORM}/settings/platform`,
    updatePlatform: `${PLATFORM}/settings/platform`,
    locations: `${PLATFORM}/settings/locations`,
    updateLocations: `${PLATFORM}/settings/locations`,
  },
};

export default endpoints;
