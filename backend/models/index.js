const { sequelize } = require('../config/database');
const User = require('./User');
const Lead = require('./Lead');
const Customer = require('./Customer');
const Policy = require('./Policy');
const Followup = require('./Followup');
const Document = require('./Document');
const Agent = require('./Agent');

// ─── New NeoDove Model Imports ──────────────────────────────────────
const CallLog = require('./CallLog');
const AgentSession = require('./AgentSession');
const ContactImportLog = require('./ContactImportLog');
const CrmIntegration = require('./CrmIntegration');
const IntegrationLog = require('./IntegrationLog');
const Pipeline = require('./Pipeline');
const PipelineStage = require('./PipelineStage');
const Campaign = require('./Campaign');
const CampaignAgent = require('./CampaignAgent');
const EngagementForm = require('./EngagementForm');
const FormSubmission = require('./FormSubmission');
const MarketplaceProvider = require('./MarketplaceProvider');
const OrgProviderConnection = require('./OrgProviderConnection');
const SmsAutomation = require('./SmsAutomation');
const SmsAutomationLog = require('./SmsAutomationLog');
const Workflow = require('./Workflow');
const WorkflowRunLog = require('./WorkflowRunLog');
const ActivityLog = require('./ActivityLog');
const ReminderLog = require('./ReminderLog');
const Organization = require('./Organization');
const Note = require('./Note');

// ─── User Associations ──────────────────────────────────────────────
User.hasMany(Lead, { foreignKey: 'assigned_to' });
User.hasMany(Followup, { foreignKey: 'created_by' });
User.hasMany(Customer, { foreignKey: 'assigned_to' });

// ─── Lead Associations ──────────────────────────────────────────────
Lead.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedAgent' });
Lead.hasOne(Customer, { foreignKey: 'lead_id' });
Lead.hasMany(Followup, { foreignKey: 'lead_id' });

// ─── Customer Associations ──────────────────────────────────────────
Customer.belongsTo(Lead, { foreignKey: 'lead_id' });
Customer.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedAgent' });
Customer.hasMany(Policy, { foreignKey: 'customer_id' });
Customer.hasMany(Document, { foreignKey: 'customer_id' });
Customer.hasMany(Followup, { foreignKey: 'customer_id' });

// ─── Policy Associations ────────────────────────────────────────────
Policy.belongsTo(Customer, { foreignKey: 'customer_id' });
Policy.hasMany(Document, { foreignKey: 'policy_id' });

// ─── Followup Associations ──────────────────────────────────────────
Followup.belongsTo(Lead, { foreignKey: 'lead_id' });
Followup.belongsTo(Customer, { foreignKey: 'customer_id' });
Followup.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ─── Document Associations ──────────────────────────────────────────
Document.belongsTo(Customer, { foreignKey: 'customer_id' });
Document.belongsTo(Policy, { foreignKey: 'policy_id' });
Document.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// ─── Agent Associations ─────────────────────────────────────────────
Agent.belongsTo(User, { foreignKey: 'referred_by', as: 'referrer' });

// ═══════════════════════════════════════════════════════════════════
// ─── NeoDove Associations ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// ─── CallLog Associations ───────────────────────────────────────────
CallLog.belongsTo(Lead, { foreignKey: 'lead_id' });
CallLog.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });
CallLog.belongsTo(Campaign, { foreignKey: 'campaign_id' });
User.hasMany(CallLog, { foreignKey: 'agent_id' });

// ─── AgentSession Associations ──────────────────────────────────────
AgentSession.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });
User.hasMany(AgentSession, { foreignKey: 'agent_id' });

// ─── ContactImportLog Associations ──────────────────────────────────
ContactImportLog.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// ─── CrmIntegration / IntegrationLog Associations ───────────────────
CrmIntegration.belongsTo(Campaign, { foreignKey: 'target_campaign_id', as: 'targetCampaign' });
IntegrationLog.belongsTo(CrmIntegration, { foreignKey: 'integration_id' });
CrmIntegration.hasMany(IntegrationLog, { foreignKey: 'integration_id' });

// ─── Pipeline / PipelineStage Associations ──────────────────────────
Pipeline.hasMany(PipelineStage, { foreignKey: 'pipeline_id', as: 'stages' });
Pipeline.hasMany(Campaign, { foreignKey: 'pipeline_id' });
Pipeline.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
PipelineStage.belongsTo(Pipeline, { foreignKey: 'pipeline_id' });

// ─── Campaign Associations ──────────────────────────────────────────
Campaign.belongsTo(Pipeline, { foreignKey: 'pipeline_id', as: 'pipeline' });
Campaign.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });
Campaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Campaign.hasMany(CampaignAgent, { foreignKey: 'campaign_id', as: 'campaignAgents' });
Campaign.hasMany(Lead, { foreignKey: 'campaign_id' });
CampaignAgent.belongsTo(Campaign, { foreignKey: 'campaign_id' });
CampaignAgent.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

// ─── Lead NeoDove Associations ──────────────────────────────────────
Lead.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
Lead.belongsTo(PipelineStage, { foreignKey: 'pipeline_stage_id', as: 'pipelineStage' });

// ─── EngagementForm / FormSubmission Associations ───────────────────
EngagementForm.belongsTo(Campaign, { foreignKey: 'campaign_id' });
Campaign.hasOne(EngagementForm, { foreignKey: 'campaign_id' });
FormSubmission.belongsTo(EngagementForm, { foreignKey: 'form_id' });
FormSubmission.belongsTo(Lead, { foreignKey: 'lead_id' });
FormSubmission.belongsTo(User, { foreignKey: 'agent_id', as: 'agent' });

// ─── Marketplace Associations ───────────────────────────────────────
OrgProviderConnection.belongsTo(MarketplaceProvider, { foreignKey: 'provider_id', as: 'provider' });
MarketplaceProvider.hasMany(OrgProviderConnection, { foreignKey: 'provider_id' });

// ─── SmsAutomation Associations ─────────────────────────────────────
SmsAutomation.belongsTo(Campaign, { foreignKey: 'campaign_id' });
SmsAutomation.hasMany(SmsAutomationLog, { foreignKey: 'automation_id' });
SmsAutomationLog.belongsTo(SmsAutomation, { foreignKey: 'automation_id' });

// ─── Workflow Associations ──────────────────────────────────────────
Workflow.hasMany(WorkflowRunLog, { foreignKey: 'workflow_id' });
WorkflowRunLog.belongsTo(Workflow, { foreignKey: 'workflow_id' });

// ─── ActivityLog Associations ───────────────────────────────────────
ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ─── Note Associations ──────────────────────────────────────────────
Note.belongsTo(Lead, { foreignKey: 'lead_id' });
Note.belongsTo(Customer, { foreignKey: 'customer_id' });
Note.belongsTo(User, { foreignKey: 'created_by', as: 'author' });
Lead.hasMany(Note, { foreignKey: 'lead_id', as: 'noteEntries' });
Customer.hasMany(Note, { foreignKey: 'customer_id', as: 'noteEntries' });

// ─── Organization Associations ──────────────────────────────────────
// Every tenant-scoped model belongs to an Organization. The reverse (hasMany)
// is intentionally omitted: nothing should ever load an org's entire dataset.
for (const model of [
  User, Lead, Customer, Policy, Followup, Document, Agent, Campaign, Pipeline,
  CallLog, AgentSession, ActivityLog, ContactImportLog, CrmIntegration,
  EngagementForm, FormSubmission, SmsAutomation, Workflow, ReminderLog, Note,
]) {
  model.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' });
}

// Install the hooks that filter every query by org_id.
require('../services/tenancy').applyTenancyHooks(sequelize);

module.exports = {
  sequelize,
  User,
  Lead,
  Customer,
  Policy,
  Followup,
  Document,
  Agent,
  CallLog,
  AgentSession,
  ContactImportLog,
  CrmIntegration,
  IntegrationLog,
  Pipeline,
  PipelineStage,
  Campaign,
  CampaignAgent,
  EngagementForm,
  FormSubmission,
  MarketplaceProvider,
  OrgProviderConnection,
  SmsAutomation,
  SmsAutomationLog,
  Workflow,
  WorkflowRunLog,
  ActivityLog,
  ReminderLog,
  Organization,
  Note,
};
