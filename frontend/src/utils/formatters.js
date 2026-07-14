import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/**
 * Format currency in Indian Rupees with Indian number system
 * e.g., 123456 → ₹1,23,456
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format currency with decimals
 * e.g., 123456.78 → ₹1,23,456.78
 */
export const formatCurrencyDecimal = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format date as '15 Jan 2025'
 */
export const formatDate = (date) => {
  if (!date) return '-';
  return dayjs(date).format('DD MMM YYYY');
};

/**
 * Format datetime as '15 Jan 2025, 2:30 PM'
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  return dayjs(date).format('DD MMM YYYY, h:mm A');
};

/**
 * Format mobile number as +91 98765 43210
 */
export const formatMobile = (mobile) => {
  if (!mobile) return '-';
  const cleaned = String(mobile).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return mobile;
};

/**
 * Calculate days until a date (negative if past)
 */
export const daysUntil = (date) => {
  if (!date) return null;
  const target = dayjs(date).startOf('day');
  const today = dayjs().startOf('day');
  return target.diff(today, 'day');
};

/**
 * Get greeting based on current time
 */
export const getGreeting = () => {
  const hour = dayjs().hour();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export const timeAgo = (date) => {
  if (!date) return '-';
  return dayjs(date).fromNow();
};

/**
 * Format number with Indian number system (without currency symbol)
 * e.g., 1234567 → 12,34,567
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, maxLength = 30) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Get initials from name
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
