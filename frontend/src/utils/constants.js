// Lead Statuses
export const LEAD_STATUSES = [
  'New',
  'Interested',
  'Follow-up',
  'Proposal Sent',
  'Document Collection',
  'Payment Pending',
  'Closed Won',
  'Closed Lost',
  'Junk',
];

// Lead Sources
export const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Social Media',
  'Cold Call',
  'Walk-in',
  'WhatsApp',
  'JustDial',
  'Google Ads',
  'Facebook Ads',
  'Instagram',
  'LinkedIn',
  'IndiaMART',
  'Trade Show',
  'Newspaper Ad',
  'Other',
];

// Insurance Interests
export const INSURANCE_INTERESTS = [
  'Term Life',
  'Health Insurance',
  'Motor Insurance',
  'ULIP',
  'Endowment',
  'Money Back',
  'Child Plan',
  'Pension Plan',
  'Group Health',
  'Fire Insurance',
  'Marine Insurance',
  'Professional Indemnity',
  'Travel Insurance',
  'Personal Accident',
  'Critical Illness',
  'Super Top-up',
  'Home Insurance',
  'Cyber Insurance',
  'Other',
];

// Priorities
export const PRIORITIES = ['Hot', 'Warm', 'Cold'];

// Policy Types
export const POLICY_TYPES = [
  'Term Life',
  'Health',
  'Motor - Car',
  'Motor - Two Wheeler',
  'ULIP',
  'Endowment',
  'Money Back',
  'Child Plan',
  'Pension',
  'Group Health',
  'Fire',
  'Marine',
  'Travel',
  'Personal Accident',
  'Critical Illness',
  'Home',
  'Professional Indemnity',
  'Cyber',
  'Other',
];

// Policy Statuses
export const POLICY_STATUSES = [
  'Active',
  'Pending',
  'Lapsed',
  'Surrendered',
  'Matured',
  'Claimed',
  'Cancelled',
];

// Premium Frequencies
export const PREMIUM_FREQUENCIES = [
  'Monthly',
  'Quarterly',
  'Half-Yearly',
  'Yearly',
  'Single Pay',
];

// Payment Modes
export const PAYMENT_MODES = [
  'Online',
  'Cheque',
  'Cash',
  'NEFT',
  'UPI',
  'Auto Debit',
  'Credit Card',
  'Debit Card',
];

// Follow-up Types
export const FOLLOWUP_TYPES = [
  'Call',
  'WhatsApp',
  'Email',
  'Meeting',
  'Site Visit',
  'Video Call',
  'SMS',
  'Other',
];

// Document Types
export const DOC_TYPES = [
  'Aadhaar Card',
  'PAN Card',
  'Passport',
  'Driving License',
  'Voter ID',
  'Bank Statement',
  'Salary Slip',
  'ITR',
  'Photo',
  'Address Proof',
  'Policy Document',
  'Proposal Form',
  'Medical Report',
  'Cancelled Cheque',
  'Other',
];

// Genders
export const GENDERS = ['Male', 'Female', 'Other'];

// Agent Interview Statuses
export const AGENT_INTERVIEW_STATUSES = [
  'Scheduled',
  'Appeared',
  'Passed',
  'Failed',
  'No Show',
  'Rescheduled',
];

// Agent Training Statuses
export const AGENT_TRAINING_STATUSES = [
  'Not Started',
  'In Progress',
  'Completed',
  'Dropped',
];

// Agent IRDA Statuses
export const AGENT_IRDA_STATUSES = [
  'Not Applied',
  'Applied',
  'Exam Scheduled',
  'Exam Passed',
  'License Received',
  'License Rejected',
];

// Priority Colors
export const PRIORITY_COLORS = {
  Hot: '#f5222d',
  Warm: '#fa8c16',
  Cold: '#1890ff',
};

// Status Colors - for leads
export const STATUS_COLORS = {
  'New': '#1890ff',
  'Interested': '#722ed1',
  'Follow-up': '#fa8c16',
  'Proposal Sent': '#13c2c2',
  'Document Collection': '#2f54eb',
  'Payment Pending': '#eb2f96',
  'Closed Won': '#52c41a',
  'Closed Lost': '#f5222d',
  'Junk': '#8c8c8c',
};

// Policy status colors
export const POLICY_STATUS_COLORS = {
  'Active': '#52c41a',
  'Pending': '#faad14',
  'Lapsed': '#f5222d',
  'Surrendered': '#ff7a45',
  'Matured': '#1890ff',
  'Claimed': '#722ed1',
  'Cancelled': '#8c8c8c',
};

// Agent status colors
export const AGENT_STATUS_COLORS = {
  'Scheduled': '#1890ff',
  'Appeared': '#722ed1',
  'Passed': '#52c41a',
  'Failed': '#f5222d',
  'No Show': '#8c8c8c',
  'Rescheduled': '#faad14',
  'Not Started': '#8c8c8c',
  'In Progress': '#1890ff',
  'Completed': '#52c41a',
  'Dropped': '#f5222d',
  'Not Applied': '#8c8c8c',
  'Applied': '#1890ff',
  'Exam Scheduled': '#faad14',
  'Exam Passed': '#52c41a',
  'License Received': '#52c41a',
  'License Rejected': '#f5222d',
};

// Pipeline columns order (for Kanban)
export const PIPELINE_COLUMNS = [
  { key: 'New', title: 'New', color: '#1890ff', bg: '#e6f7ff' },
  { key: 'Interested', title: 'Interested', color: '#722ed1', bg: '#f9f0ff' },
  { key: 'Follow-up', title: 'Follow-up', color: '#fa8c16', bg: '#fff7e6' },
  { key: 'Proposal Sent', title: 'Proposal Sent', color: '#13c2c2', bg: '#e6fffb' },
  { key: 'Document Collection', title: 'Document Collection', color: '#2f54eb', bg: '#f0f5ff' },
  { key: 'Payment Pending', title: 'Payment Pending', color: '#eb2f96', bg: '#fff0f6' },
  { key: 'Closed Won', title: 'Closed Won', color: '#52c41a', bg: '#f6ffed' },
];

// Followup type icons mapping
export const FOLLOWUP_TYPE_ICONS = {
  'Call': 'PhoneOutlined',
  'WhatsApp': 'WhatsAppOutlined',
  'Email': 'MailOutlined',
  'Meeting': 'TeamOutlined',
  'Site Visit': 'EnvironmentOutlined',
  'Video Call': 'VideoCameraOutlined',
  'SMS': 'MessageOutlined',
  'Other': 'MoreOutlined',
};
