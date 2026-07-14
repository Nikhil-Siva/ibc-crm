const axios = require('axios');

const WATI_API_URL = process.env.WATI_API_URL;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;

/**
 * Helper to make WATI API calls
 */
const sendWatiMessage = async (endpoint, payload) => {
  if (!WATI_API_URL || !WATI_API_TOKEN || WATI_API_URL.includes('YOUR_INSTANCE')) {
    console.log(`[WhatsApp Mock] Endpoint: ${endpoint}`, JSON.stringify(payload, null, 2));
    return { success: true, mock: true, message: 'WATI credentials not configured – message logged to console.' };
  }

  try {
    const response = await axios.post(
      `${WATI_API_URL}${endpoint}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WATI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return { success: true, mock: false, data: response.data };
  } catch (error) {
    console.error('[WhatsApp] WATI API error:', error.message);
    return { success: false, mock: false, error: error.message };
  }
};

/**
 * Send renewal reminder via WhatsApp
 */
const sendRenewalReminder = async (mobile, customerName, policyType, dueDate, premiumAmount) => {
  try {
    const payload = {
      whatsappNumber: mobile,
      templateName: 'renewal_reminder',
      parameters: [
        { name: 'customer_name', value: customerName },
        { name: 'policy_type', value: policyType || 'Insurance' },
        { name: 'due_date', value: dueDate || 'N/A' },
        { name: 'premium_amount', value: premiumAmount ? `₹${premiumAmount}` : 'N/A' },
      ],
    };

    console.log(`[WhatsApp] Sending renewal reminder to ${mobile} for ${customerName}`);
    return await sendWatiMessage('/api/v1/sendTemplateMessage', payload);
  } catch (error) {
    console.error('[WhatsApp] sendRenewalReminder error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send follow-up reminder via WhatsApp
 */
const sendFollowupReminder = async (mobile, agentName, leadName, scheduledTime) => {
  try {
    const payload = {
      whatsappNumber: mobile,
      templateName: 'followup_reminder',
      parameters: [
        { name: 'agent_name', value: agentName },
        { name: 'lead_name', value: leadName },
        { name: 'scheduled_time', value: scheduledTime || 'today' },
      ],
    };

    console.log(`[WhatsApp] Sending followup reminder to ${mobile} – Agent: ${agentName}, Lead: ${leadName}`);
    return await sendWatiMessage('/api/v1/sendTemplateMessage', payload);
  } catch (error) {
    console.error('[WhatsApp] sendFollowupReminder error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome message via WhatsApp
 */
const sendWelcomeMessage = async (mobile, customerName, policyNumber) => {
  try {
    const payload = {
      whatsappNumber: mobile,
      templateName: 'welcome_message',
      parameters: [
        { name: 'customer_name', value: customerName },
        { name: 'policy_number', value: policyNumber || 'N/A' },
      ],
    };

    console.log(`[WhatsApp] Sending welcome message to ${mobile} for ${customerName}`);
    return await sendWatiMessage('/api/v1/sendTemplateMessage', payload);
  } catch (error) {
    console.error('[WhatsApp] sendWelcomeMessage error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send birthday wish via WhatsApp
 */
const sendBirthdayWish = async (mobile, customerName) => {
  try {
    const payload = {
      whatsappNumber: mobile,
      templateName: 'birthday_wish',
      parameters: [
        { name: 'customer_name', value: customerName },
      ],
    };

    console.log(`[WhatsApp] Sending birthday wish to ${mobile} for ${customerName}`);
    return await sendWatiMessage('/api/v1/sendTemplateMessage', payload);
  } catch (error) {
    console.error('[WhatsApp] sendBirthdayWish error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendRenewalReminder,
  sendFollowupReminder,
  sendWelcomeMessage,
  sendBirthdayWish,
};
