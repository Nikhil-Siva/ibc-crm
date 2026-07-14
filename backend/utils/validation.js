/**
 * Shared input validation helpers.
 */

const MIN_PASSWORD_LENGTH = 8;

/**
 * Validate a plaintext password against the account password policy.
 * Returns an error string, or null when the password is acceptable.
 */
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
};

/**
 * Pick only the allowed keys from a request body.
 * Guards every write path against mass assignment (id, role, timestamps, FKs).
 */
const pick = (source, allowedFields) => {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  for (const field of allowedFields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
};

/**
 * Escape LIKE wildcards so a search term containing % or _ is matched literally.
 */
const escapeLike = (value) => String(value).replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Client-writable columns per model. Anything absent here (id, timestamps,
 * lead_id, assigned_to) is derived server-side.
 */
const LEAD_WRITABLE = [
  'name', 'mobile', 'email', 'age', 'occupation', 'city', 'source',
  'insurance_interest', 'status', 'priority', 'notes', 'campaign_id',
  'pipeline_stage_id', 'last_contacted_at',
];

const CUSTOMER_WRITABLE = [
  'name', 'mobile', 'alternate_mobile', 'email', 'dob', 'gender', 'occupation',
  'annual_income', 'address', 'city', 'pincode', 'pan_number', 'aadhaar_number',
  'nominee_name', 'nominee_relation', 'nominee_dob',
];

const POLICY_WRITABLE = [
  'customer_id', 'policy_number', 'insurer', 'policy_type', 'plan_name',
  'sum_assured', 'premium_amount', 'premium_frequency', 'payment_mode',
  'start_date', 'maturity_date', 'due_date', 'next_due_date',
  'policy_term_years', 'status', 'commission_earned', 'notes',
];

const FOLLOWUP_WRITABLE = [
  'lead_id', 'customer_id', 'type', 'scheduled_at', 'notes', 'outcome',
  'is_done', 'done_at',
];

const AGENT_WRITABLE = [
  'name', 'mobile', 'email', 'city', 'age', 'occupation', 'education',
  'interview_status', 'interview_date', 'training_status', 'irda_exam_status',
  'activation_status', 'notes',
];

const SMS_AUTOMATION_WRITABLE = [
  'name', 'campaign_id', 'trigger_event', 'trigger_conditions', 'sms_template',
  'sms_provider_id', 'delay_minutes', 'is_active',
];

const WORKFLOW_WRITABLE = [
  'name', 'description', 'trigger_type', 'trigger_config', 'steps', 'is_active',
];

module.exports = {
  validatePassword,
  pick,
  escapeLike,
  MIN_PASSWORD_LENGTH,
  LEAD_WRITABLE,
  CUSTOMER_WRITABLE,
  POLICY_WRITABLE,
  FOLLOWUP_WRITABLE,
  AGENT_WRITABLE,
  SMS_AUTOMATION_WRITABLE,
  WORKFLOW_WRITABLE,
};
