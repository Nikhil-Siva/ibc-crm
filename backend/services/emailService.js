const nodemailer = require('nodemailer');

/**
 * Create reusable transporter – mock-safe (returns null if credentials missing)
 */
const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass || user === 'your@gmail.com') {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

/**
 * Send renewal email
 */
const sendRenewalEmail = async (to, customerName, policyDetails) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`[Email Mock] Renewal email to ${to} for ${customerName}`, policyDetails);
      return { success: true, mock: true, message: 'Email credentials not configured – logged to console.' };
    }

    const mailOptions = {
      from: `"Insurance CRM" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Policy Renewal Reminder – ${customerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Policy Renewal Reminder</h2>
          <p>Dear <strong>${customerName}</strong>,</p>
          <p>Your insurance policy is due for renewal. Here are the details:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Policy Number</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${policyDetails.policy_number || 'N/A'}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Policy Type</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${policyDetails.policy_type || 'N/A'}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Premium Amount</td><td style="padding: 8px; border: 1px solid #e5e7eb;">₹${policyDetails.premium_amount || 'N/A'}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Due Date</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${policyDetails.next_due_date || 'N/A'}</td></tr>
          </table>
          <p>Please ensure timely payment to keep your policy active.</p>
          <p>Best regards,<br>Invic Business Corp LLP</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Renewal email sent to ${to}: ${info.messageId}`);
    return { success: true, mock: false, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] sendRenewalEmail error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send login OTP
 */
const sendLoginOtp = async (to, otp) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`[Email Mock] OTP email to ${to}: ${otp}`);
      return { success: true, mock: true, message: 'Email credentials not configured – logged to console.' };
    }

    const mailOptions = {
      from: `"Insurance CRM" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Your Login OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Login OTP</h2>
          <p>Your one-time password is:</p>
          <h1 style="color: #1e40af; letter-spacing: 8px; text-align: center; padding: 20px; background: #f0f9ff; border-radius: 8px;">${otp}</h1>
          <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
          <p>Best regards,<br>Invic Business Corp LLP</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] OTP email sent to ${to}: ${info.messageId}`);
    return { success: true, mock: false, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] sendLoginOtp error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send daily digest email
 */
const sendDailyDigest = async (to, todayStats) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`[Email Mock] Daily digest to ${to}`, todayStats);
      return { success: true, mock: true, message: 'Email credentials not configured – logged to console.' };
    }

    const mailOptions = {
      from: `"Insurance CRM" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Daily Digest – ${new Date().toLocaleDateString('en-IN')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Daily Digest</h2>
          <p>Here's your summary for today:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">New Leads</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${todayStats.new_leads || 0}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Followups Due</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${todayStats.followups_due || 0}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Renewals Due</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${todayStats.renewals_due || 0}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Policies Issued</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${todayStats.policies_issued || 0}</td></tr>
          </table>
          <p>Best regards,<br>Insurance CRM System</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Daily digest sent to ${to}: ${info.messageId}`);
    return { success: true, mock: false, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] sendDailyDigest error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendRenewalEmail,
  sendLoginOtp,
  sendDailyDigest,
};
