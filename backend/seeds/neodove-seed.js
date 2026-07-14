/**
 * NeoDove Feature Seed File
 * Seeds: Pipelines, Stages, Campaigns, Marketplace Providers,
 *        Call Logs, Activity Logs, SMS Automations, Workflows
 *
 * Usage: node seeds/neodove-seed.js
 */

require('dotenv').config();

const { sequelize } = require('../config/database');
const {
  User,
  Pipeline,
  PipelineStage,
  Campaign,
  MarketplaceProvider,
  CallLog,
  ActivityLog,
  SmsAutomation,
  Workflow,
  Lead,
} = require('../models');

async function seed() {
  try {
    // Authenticate and sync
    await sequelize.authenticate();
    console.log('✅ Database connected for seeding.');

    await sequelize.sync();
    console.log('✅ Models synchronized.');

    // Find or create an admin user to use as creator/agent
    let adminUser = await User.findOne({ where: { role: 'admin' } });
    if (!adminUser) {
      console.log('⚠️  No admin user found. Please run the server first to seed the admin user.');
      process.exit(1);
    }

    const adminId = adminUser.id;

    // ─── 1. Default Pipeline with 8 stages (matching LEAD_STATUSES) ──
    console.log('📌 Seeding Default Pipeline...');
    const [defaultPipeline] = await Pipeline.findOrCreate({
      where: { name: 'Default Insurance Pipeline' },
      defaults: {
        description: 'Default pipeline matching existing lead statuses for insurance CRM workflow',
        is_active: true,
        created_by: adminId,
      },
    });

    const defaultStages = [
      { name: 'New', order: 1, color: '#3B82F6', probability: 10 },
      { name: 'Interested', order: 2, color: '#10B981', probability: 25 },
      { name: 'Follow-up', order: 3, color: '#F59E0B', probability: 40 },
      { name: 'Proposal Sent', order: 4, color: '#8B5CF6', probability: 55 },
      { name: 'Document Collection', order: 5, color: '#EC4899', probability: 70 },
      { name: 'Payment Pending', order: 6, color: '#F97316', probability: 85 },
      { name: 'Closed Won', order: 7, color: '#22C55E', probability: 100 },
      { name: 'Closed Lost', order: 8, color: '#EF4444', probability: 0 },
    ];

    for (const stage of defaultStages) {
      await PipelineStage.findOrCreate({
        where: { pipeline_id: defaultPipeline.id, name: stage.name },
        defaults: {
          pipeline_id: defaultPipeline.id,
          name: stage.name,
          order: stage.order,
          color: stage.color,
          probability: stage.probability,
          is_active: true,
        },
      });
    }
    console.log('  ✅ Default Pipeline with 8 stages created.');

    // ─── 2. Sales Pipeline with 5 stages ─────────────────────────────
    console.log('📌 Seeding Sales Pipeline...');
    const [salesPipeline] = await Pipeline.findOrCreate({
      where: { name: 'Sales Pipeline' },
      defaults: {
        description: 'Standard sales pipeline for tracking deal progression',
        is_active: true,
        created_by: adminId,
      },
    });

    const salesStages = [
      { name: 'Prospecting', order: 1, color: '#6366F1', probability: 10 },
      { name: 'Qualification', order: 2, color: '#0EA5E9', probability: 30 },
      { name: 'Proposal', order: 3, color: '#F59E0B', probability: 50 },
      { name: 'Negotiation', order: 4, color: '#F97316', probability: 75 },
      { name: 'Closed', order: 5, color: '#22C55E', probability: 100 },
    ];

    for (const stage of salesStages) {
      await PipelineStage.findOrCreate({
        where: { pipeline_id: salesPipeline.id, name: stage.name },
        defaults: {
          pipeline_id: salesPipeline.id,
          name: stage.name,
          order: stage.order,
          color: stage.color,
          probability: stage.probability,
          is_active: true,
        },
      });
    }
    console.log('  ✅ Sales Pipeline with 5 stages created.');

    // ─── 3. Three Campaigns ──────────────────────────────────────────
    console.log('📌 Seeding Campaigns...');
    const campaignData = [
      {
        name: 'Term Life Insurance Q3',
        description: 'Outbound campaign for term life insurance policies targeting young professionals aged 25-40',
        type: 'outbound',
        status: 'active',
        pipeline_id: defaultPipeline.id,
        manager_id: adminId,
        created_by: adminId,
        start_date: new Date('2026-07-01'),
        end_date: new Date('2026-09-30'),
        target_count: 500,
      },
      {
        name: 'Health Insurance Renewal',
        description: 'Campaign to follow up with customers whose health insurance policies are due for renewal',
        type: 'inbound',
        status: 'active',
        pipeline_id: defaultPipeline.id,
        manager_id: adminId,
        created_by: adminId,
        start_date: new Date('2026-06-01'),
        end_date: new Date('2026-08-31'),
        target_count: 300,
      },
      {
        name: 'Vehicle Insurance Cold Calls',
        description: 'Cold calling campaign for new vehicle insurance leads from partner dealerships',
        type: 'outbound',
        status: 'paused',
        pipeline_id: salesPipeline.id,
        manager_id: adminId,
        created_by: adminId,
        start_date: new Date('2026-06-15'),
        end_date: new Date('2026-12-31'),
        target_count: 1000,
      },
    ];

    const campaigns = [];
    for (const data of campaignData) {
      const [campaign] = await Campaign.findOrCreate({
        where: { name: data.name },
        defaults: data,
      });
      campaigns.push(campaign);
    }
    console.log('  ✅ 3 Campaigns created.');

    // ─── 4. Marketplace Providers (20) ───────────────────────────────
    console.log('📌 Seeding Marketplace Providers...');
    const providers = [
      { name: 'Twilio', category: 'telephony', description: 'Cloud communications platform for voice, SMS, and video', icon: 'twilio', website: 'https://www.twilio.com', pricing_model: 'pay-per-use', is_active: true },
      { name: 'Exotel', category: 'telephony', description: 'Cloud telephony platform for Indian businesses with IVR and call tracking', icon: 'exotel', website: 'https://exotel.com', pricing_model: 'subscription', is_active: true },
      { name: 'Knowlarity', category: 'telephony', description: 'Cloud communication solutions with virtual numbers and call center features', icon: 'knowlarity', website: 'https://www.knowlarity.com', pricing_model: 'subscription', is_active: true },
      { name: 'Ozonetel', category: 'telephony', description: 'Contact center solution with auto-dialer and CRM integration', icon: 'ozonetel', website: 'https://ozonetel.com', pricing_model: 'subscription', is_active: true },
      { name: 'MSG91', category: 'sms', description: 'Transactional and promotional SMS gateway for India', icon: 'msg91', website: 'https://msg91.com', pricing_model: 'pay-per-use', is_active: true },
      { name: 'Gupshup', category: 'sms', description: 'Messaging platform for SMS, WhatsApp, and RCS', icon: 'gupshup', website: 'https://www.gupshup.io', pricing_model: 'pay-per-use', is_active: true },
      { name: 'Kaleyra', category: 'sms', description: 'Enterprise messaging platform with global SMS reach', icon: 'kaleyra', website: 'https://www.kaleyra.com', pricing_model: 'pay-per-use', is_active: true },
      { name: 'WhatsApp Business API', category: 'messaging', description: 'Official WhatsApp API for business communication and customer engagement', icon: 'whatsapp', website: 'https://business.whatsapp.com', pricing_model: 'pay-per-use', is_active: true },
      { name: 'Interakt', category: 'messaging', description: 'WhatsApp business solution with automated notifications and catalog sharing', icon: 'interakt', website: 'https://www.interakt.shop', pricing_model: 'subscription', is_active: true },
      { name: 'Wati', category: 'messaging', description: 'WhatsApp team inbox and automation platform for customer support', icon: 'wati', website: 'https://www.wati.io', pricing_model: 'subscription', is_active: true },
      { name: 'Mailchimp', category: 'email', description: 'Email marketing platform with automation and analytics', icon: 'mailchimp', website: 'https://mailchimp.com', pricing_model: 'freemium', is_active: true },
      { name: 'SendGrid', category: 'email', description: 'Email delivery service with transactional and marketing email support', icon: 'sendgrid', website: 'https://sendgrid.com', pricing_model: 'freemium', is_active: true },
      { name: 'Razorpay', category: 'payment', description: 'Payment gateway supporting UPI, cards, netbanking, and EMI', icon: 'razorpay', website: 'https://razorpay.com', pricing_model: 'pay-per-use', is_active: true },
      { name: 'Cashfree', category: 'payment', description: 'Payment and banking API platform for Indian businesses', icon: 'cashfree', website: 'https://www.cashfree.com', pricing_model: 'pay-per-use', is_active: true },
      { name: 'Google Sheets', category: 'productivity', description: 'Cloud spreadsheet for real-time data sync and lead import/export', icon: 'google-sheets', website: 'https://sheets.google.com', pricing_model: 'free', is_active: true },
      { name: 'Google Calendar', category: 'productivity', description: 'Calendar integration for scheduling follow-ups and appointments', icon: 'google-calendar', website: 'https://calendar.google.com', pricing_model: 'free', is_active: true },
      { name: 'Zapier', category: 'automation', description: 'Workflow automation platform connecting 5000+ apps', icon: 'zapier', website: 'https://zapier.com', pricing_model: 'freemium', is_active: true },
      { name: 'Facebook Lead Ads', category: 'lead-source', description: 'Facebook ad integration for automatic lead capture from ad campaigns', icon: 'facebook', website: 'https://www.facebook.com/business', pricing_model: 'pay-per-use', is_active: true },
      { name: 'IndiaMART', category: 'lead-source', description: 'Indian B2B marketplace integration for lead capture', icon: 'indiamart', website: 'https://www.indiamart.com', pricing_model: 'subscription', is_active: true },
      { name: 'JustDial', category: 'lead-source', description: 'Local business listing platform integration for lead generation', icon: 'justdial', website: 'https://www.justdial.com', pricing_model: 'subscription', is_active: true },
    ];

    for (const provider of providers) {
      await MarketplaceProvider.findOrCreate({
        where: { name: provider.name },
        defaults: provider,
      });
    }
    console.log('  ✅ 20 Marketplace Providers created.');

    // ─── 5. Sample Call Logs (10) ────────────────────────────────────
    console.log('📌 Seeding Call Logs...');

    // Get some leads to link to
    const leads = await Lead.findAll({ limit: 10 });

    const callTypes = ['outbound', 'inbound'];
    const callStatuses = ['completed', 'missed', 'busy', 'no_answer', 'failed'];
    const dispositions = ['interested', 'not_interested', 'callback', 'wrong_number', 'voicemail', 'follow_up', 'closed'];

    for (let i = 0; i < 10; i++) {
      const duration = Math.floor(Math.random() * 600) + 10; // 10-610 seconds
      const callDate = new Date();
      callDate.setDate(callDate.getDate() - Math.floor(Math.random() * 30));
      const status = callStatuses[Math.floor(Math.random() * callStatuses.length)];

      await CallLog.create({
        lead_id: leads.length > 0 ? leads[i % leads.length].id : null,
        agent_id: adminId,
        campaign_id: campaigns.length > 0 ? campaigns[i % campaigns.length].id : null,
        call_type: callTypes[Math.floor(Math.random() * callTypes.length)],
        status: status,
        duration: status === 'completed' ? duration : 0,
        disposition: dispositions[Math.floor(Math.random() * dispositions.length)],
        notes: `Sample call log #${i + 1} - ${status === 'completed' ? 'Had a productive conversation about insurance options.' : 'Call could not be completed.'}`,
        recording_url: status === 'completed' ? `https://recordings.example.com/call-${i + 1}.mp3` : null,
        called_at: callDate,
      });
    }
    console.log('  ✅ 10 Call Logs created.');

    // ─── 6. Activity Logs (5) ────────────────────────────────────────
    console.log('📌 Seeding Activity Logs...');
    const activities = [
      {
        user_id: adminId,
        action: 'lead_created',
        entity_type: 'lead',
        entity_id: leads.length > 0 ? leads[0].id : 1,
        description: 'Created a new lead from web form submission',
        metadata: JSON.stringify({ source: 'web_form', ip: '192.168.1.100' }),
      },
      {
        user_id: adminId,
        action: 'campaign_started',
        entity_type: 'campaign',
        entity_id: campaigns.length > 0 ? campaigns[0].id : 1,
        description: 'Started Term Life Insurance Q3 campaign',
        metadata: JSON.stringify({ campaign_name: 'Term Life Insurance Q3', target_count: 500 }),
      },
      {
        user_id: adminId,
        action: 'pipeline_created',
        entity_type: 'pipeline',
        entity_id: defaultPipeline.id,
        description: 'Created Default Insurance Pipeline with 8 stages',
        metadata: JSON.stringify({ stages_count: 8 }),
      },
      {
        user_id: adminId,
        action: 'call_completed',
        entity_type: 'call_log',
        entity_id: 1,
        description: 'Completed an outbound call with lead - discussed term life insurance options',
        metadata: JSON.stringify({ duration: 245, disposition: 'interested' }),
      },
      {
        user_id: adminId,
        action: 'integration_configured',
        entity_type: 'integration',
        entity_id: 1,
        description: 'Configured Twilio integration for outbound calling',
        metadata: JSON.stringify({ provider: 'Twilio', type: 'telephony' }),
      },
    ];

    for (const activity of activities) {
      await ActivityLog.create(activity);
    }
    console.log('  ✅ 5 Activity Logs created.');

    // ─── 7. SMS Automations (2) ──────────────────────────────────────
    console.log('📌 Seeding SMS Automations...');
    const smsAutomations = [
      {
        name: 'Welcome SMS for New Leads',
        description: 'Automatically sends a welcome SMS when a new lead is added to a campaign',
        campaign_id: campaigns.length > 0 ? campaigns[0].id : null,
        trigger_event: 'lead_created',
        message_template: 'Hi {{lead_name}}, thank you for your interest in our insurance plans! Our advisor will contact you shortly. - InsuranceCRM',
        is_active: true,
        delay_minutes: 0,
        conditions: JSON.stringify({ lead_source: ['web_form', 'referral', 'facebook'] }),
      },
      {
        name: 'Follow-up Reminder SMS',
        description: 'Sends a reminder SMS to leads 24 hours before a scheduled follow-up',
        campaign_id: campaigns.length > 0 ? campaigns[1].id : null,
        trigger_event: 'followup_reminder',
        message_template: 'Hi {{lead_name}}, this is a reminder about your upcoming consultation with {{agent_name}} regarding your insurance needs. See you tomorrow!',
        is_active: true,
        delay_minutes: 1440,
        conditions: JSON.stringify({ followup_type: ['call', 'meeting'] }),
      },
    ];

    for (const automation of smsAutomations) {
      await SmsAutomation.findOrCreate({
        where: { name: automation.name },
        defaults: automation,
      });
    }
    console.log('  ✅ 2 SMS Automations created.');

    // ─── 8. Sample Workflow (1) ──────────────────────────────────────
    console.log('📌 Seeding Workflow...');
    const workflowDef = {
      name: 'New Lead Assignment Workflow',
      description: 'Automatically assigns new leads to available agents based on round-robin, sends welcome SMS, and schedules first follow-up',
      trigger_event: 'lead_created',
      is_active: true,
      steps: JSON.stringify([
        {
          order: 1,
          type: 'action',
          action: 'assign_agent',
          config: { method: 'round_robin', agent_roles: ['agent'] },
          description: 'Assign lead to next available agent using round-robin',
        },
        {
          order: 2,
          type: 'delay',
          delay_minutes: 5,
          description: 'Wait 5 minutes before sending welcome SMS',
        },
        {
          order: 3,
          type: 'action',
          action: 'send_sms',
          config: { template: 'welcome_sms' },
          description: 'Send welcome SMS to the lead',
        },
        {
          order: 4,
          type: 'condition',
          condition: { field: 'lead_source', operator: 'in', value: ['web_form', 'facebook'] },
          description: 'Check if lead came from web form or Facebook',
          on_true: 5,
          on_false: 6,
        },
        {
          order: 5,
          type: 'action',
          action: 'schedule_followup',
          config: { delay_hours: 2, type: 'call', priority: 'high' },
          description: 'Schedule high-priority follow-up call in 2 hours for web/Facebook leads',
        },
        {
          order: 6,
          type: 'action',
          action: 'schedule_followup',
          config: { delay_hours: 24, type: 'call', priority: 'normal' },
          description: 'Schedule normal follow-up call in 24 hours for other leads',
        },
        {
          order: 7,
          type: 'action',
          action: 'log_activity',
          config: { action: 'workflow_completed', message: 'New lead assignment workflow completed' },
          description: 'Log workflow completion activity',
        },
      ]),
      conditions: JSON.stringify({
        lead_status: 'New',
        has_phone: true,
      }),
      created_by: adminId,
    };

    await Workflow.findOrCreate({
      where: { name: workflowDef.name },
      defaults: workflowDef,
    });
    console.log('  ✅ 1 Workflow created.');

    console.log('\n🎉 NeoDove seed completed successfully!');
    console.log('─────────────────────────────────────────');
    console.log('  Pipelines:            2');
    console.log('  Pipeline Stages:     13');
    console.log('  Campaigns:            3');
    console.log('  Marketplace Providers: 20');
    console.log('  Call Logs:           10');
    console.log('  Activity Logs:        5');
    console.log('  SMS Automations:      2');
    console.log('  Workflows:            1');
    console.log('─────────────────────────────────────────');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
