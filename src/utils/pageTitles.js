const titles = [
  { match: /^\/$/, title: 'Dashboard' },
  { match: /^\/hospitals\/[^/]+/, title: 'Hospital Details' },
  { match: /^\/hospitals/, title: 'Hospitals' },
  { match: /^\/plans/, title: 'Subscription Plans' },
  { match: /^\/billing/, title: 'Billing' },
  { match: /^\/revenue/, title: 'Monthly Revenue' },
  { match: /^\/recurring-revenue/, title: 'Recurring Revenue' },
  { match: /^\/invoices\/[^/]+/, title: 'Invoice Details' },
  { match: /^\/invoices/, title: 'Invoices' },
  { match: /^\/coupons/, title: 'Coupons' },
  { match: /^\/announcements/, title: 'Announcements' },
  { match: /^\/support\/[^/]+/, title: 'Ticket Details' },
  { match: /^\/support/, title: 'Support Inbox' },
  { match: /^\/faqs/, title: 'FAQs' },
  { match: /^\/activity-logs/, title: 'Activity Logs' },
  { match: /^\/reports/, title: 'Reports & Analytics' },
  { match: /^\/access-management/, title: 'Access Management' },
  { match: /^\/security/, title: 'Security' },
  { match: /^\/settings/, title: 'Settings' },
];

export function getPageTitle(pathname) {
  return titles.find((t) => t.match.test(pathname))?.title || '';
}
