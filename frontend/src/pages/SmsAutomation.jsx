import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card, Table, Button, Modal, Drawer, Form, Input, Select, Switch, Tag, Space,
  Typography, Radio, InputNumber, message, Spin, Tooltip, Popconfirm, DatePicker,
  Divider, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FileSearchOutlined,
  SendOutlined, MessageOutlined, ThunderboltOutlined, ExperimentOutlined,
  InfoCircleOutlined, CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const TRIGGER_EVENTS = [
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'lead_stage_changed', label: 'Lead Stage Changed' },
  { value: 'call_connected', label: 'Call Connected' },
  { value: 'call_not_answered', label: 'Call Not Answered' },
  { value: 'form_submitted', label: 'Form Submitted' },
  { value: 'lead_assigned_to_agent', label: 'Lead Assigned to Agent' },
  { value: 'custom_field_value_changed', label: 'Custom Field Value Changed' },
];

const MERGE_TAGS = [
  '{{lead_name}}',
  '{{agent_name}}',
  '{{company_name}}',
  '{{stage_name}}',
  '{{campaign_name}}',
];

const SmsAutomation = () => {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testAutomationId, setTestAutomationId] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
  const [logsAutomation, setLogsAutomation] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsDateFilter, setLogsDateFilter] = useState(null);
  const [logsStatusFilter, setLogsStatusFilter] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [stages, setStages] = useState([]);
  const [smsProviders, setSmsProviders] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [logsPagination, setLogsPagination] = useState({ current: 1, pageSize: 10 });

  const [form] = Form.useForm();
  const templateRef = useRef(null);
  const scopeValue = Form.useWatch('scope', form);
  const triggerEvent = Form.useWatch('trigger_event', form);
  const smsTemplate = Form.useWatch('sms_template', form);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sms-automations');
      const data = res.data?.data || res.data;
      setAutomations(Array.isArray(data) ? data : data?.rows || []);
    } catch {
      message.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/campaigns');
      const data = res.data?.data || res.data;
      setCampaigns(Array.isArray(data) ? data : data?.rows || []);
    } catch {
      // silent
    }
  }, []);

  const fetchStages = useCallback(async () => {
    try {
      const res = await api.get('/pipelines');
      const data = res.data?.data || res.data;
      const allStages = [];
      (Array.isArray(data) ? data : data?.rows || []).forEach((p) => {
        (p.stages || []).forEach((s) => {
          allStages.push({ ...s, pipeline_name: p.name });
        });
      });
      setStages(allStages);
    } catch {
      // silent
    }
  }, []);

  const fetchSmsProviders = useCallback(async () => {
    try {
      const res = await api.get('/marketplace', { params: { category: 'bulk_sms' } });
      const data = res.data?.data || res.data;
      setSmsProviders(Array.isArray(data) ? data : data?.rows || []);
    } catch {
      // silent
    }
  }, []);

  const fetchLogs = useCallback(async (automationId) => {
    setLogsLoading(true);
    try {
      const params = {};
      if (logsDateFilter && logsDateFilter[0]) {
        params.start_date = logsDateFilter[0].format('YYYY-MM-DD');
        params.end_date = logsDateFilter[1].format('YYYY-MM-DD');
      }
      if (logsStatusFilter) params.status = logsStatusFilter;
      const res = await api.get(`/sms-automations/${automationId}/logs`, { params });
      const data = res.data?.data || res.data;
      setLogs(Array.isArray(data) ? data : data?.rows || []);
    } catch {
      message.error('Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  }, [logsDateFilter, logsStatusFilter]);

  useEffect(() => {
    fetchAutomations();
    fetchCampaigns();
    fetchStages();
    fetchSmsProviders();
  }, [fetchAutomations, fetchCampaigns, fetchStages, fetchSmsProviders]);

  useEffect(() => {
    if (logsAutomation?.id) {
      fetchLogs(logsAutomation.id);
    }
  }, [logsAutomation, fetchLogs]);

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ scope: 'all', delay: 0 });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      scope: record.campaign_id ? 'specific' : 'all',
      campaign_id: record.campaign_id,
      trigger_event: record.trigger_event,
      from_stage: record.trigger_config?.from_stage,
      to_stage: record.trigger_config?.to_stage,
      field_name: record.trigger_config?.field_name,
      field_value: record.trigger_config?.field_value,
      delay: record.delay || 0,
      sms_template: record.sms_template,
      provider_id: record.provider_id,
    });
    setModalVisible(true);
  };

  const handleDelete = useCallback(async (id) => {
    try {
      await api.delete(`/sms-automations/${id}`);
      message.success('Automation deleted');
      fetchAutomations();
    } catch {
      message.error('Failed to delete automation');
    }
  }, [fetchAutomations]);

  const handleToggleStatus = useCallback(async (record) => {
    try {
      await api.put(`/sms-automations/${record.id}`, {
        ...record,
        status: record.status === 'active' ? 'inactive' : 'active',
      });
      message.success('Status updated');
      fetchAutomations();
    } catch {
      message.error('Failed to update status');
    }
  }, [fetchAutomations]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const triggerConfig = {};
      if (values.trigger_event === 'lead_stage_changed') {
        triggerConfig.from_stage = values.from_stage;
        triggerConfig.to_stage = values.to_stage;
      }
      if (values.trigger_event === 'custom_field_value_changed') {
        triggerConfig.field_name = values.field_name;
        triggerConfig.field_value = values.field_value;
      }
      const payload = {
        name: values.name,
        campaign_id: values.scope === 'specific' ? values.campaign_id : null,
        trigger_event: values.trigger_event,
        trigger_config: triggerConfig,
        delay: values.delay || 0,
        sms_template: values.sms_template,
        provider_id: values.provider_id,
      };
      if (editingRecord) {
        await api.put(`/sms-automations/${editingRecord.id}`, payload);
        message.success('Automation updated');
      } else {
        await api.post('/sms-automations', payload);
        message.success('Automation created');
      }
      setModalVisible(false);
      fetchAutomations();
    } catch (err) {
      if (err.errorFields) return;
      message.error('Failed to save automation');
    } finally {
      setSaving(false);
    }
  }, [editingRecord, form, fetchAutomations]);

  const handleTestSms = useCallback(async () => {
    if (!testPhone.trim()) {
      message.warning('Please enter a phone number');
      return;
    }
    setTestSending(true);
    try {
      await api.post('/sms-automations/test-send', {
        automation_id: testAutomationId,
        phone_number: testPhone,
      });
      message.success('Test SMS sent successfully');
      setTestModalVisible(false);
      setTestPhone('');
    } catch {
      message.error('Failed to send test SMS');
    } finally {
      setTestSending(false);
    }
  }, [testAutomationId, testPhone]);

  const insertMergeTag = useCallback(
    (tag) => {
      const el = templateRef.current?.resizableTextArea?.textArea;
      if (el) {
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const current = form.getFieldValue('sms_template') || '';
        const newVal = current.substring(0, start) + tag + current.substring(end);
        form.setFieldsValue({ sms_template: newVal });
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + tag.length, start + tag.length);
        }, 0);
      } else {
        const current = form.getFieldValue('sms_template') || '';
        form.setFieldsValue({ sms_template: current + tag });
      }
    },
    [form]
  );

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Campaign',
      dataIndex: 'campaign_name',
      render: (text, record) => text || (record.campaign_id ? `ID: ${record.campaign_id}` : <Tag>All Campaigns</Tag>),
    },
    {
      title: 'Trigger Event',
      dataIndex: 'trigger_event',
      render: (event) => {
        const found = TRIGGER_EVENTS.find((t) => t.value === event);
        return <Tag color="blue">{found?.label || event}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status, record) => (
        <Switch
          checked={status === 'active'}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
          style={{ background: status === 'active' ? '#52c41a' : undefined }}
        />
      ),
    },
    {
      title: 'SMS Sent',
      dataIndex: 'sms_sent_count',
      sorter: (a, b) => (a.sms_sent_count || 0) - (b.sms_sent_count || 0),
      render: (count) => <Badge count={count || 0} showZero color="var(--c-accent)" overflowCount={99999} />,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="Delete this automation?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
          <Tooltip title="View Logs">
            <Button
              type="text"
              icon={<FileSearchOutlined />}
              onClick={() => { setLogsAutomation(record); setLogsDrawerVisible(true); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: 'Phone',
      dataIndex: 'phone',
      render: (text) => <Text copyable>{text}</Text>,
    },
    {
      title: 'Message',
      dataIndex: 'message_text',
      ellipsis: true,
      width: 280,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => {
        const colorMap = { sent: 'green', failed: 'red', pending: 'blue' };
        return <Tag color={colorMap[status] || 'default'}>{(status || 'unknown').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Sent At',
      dataIndex: 'sent_at',
      sorter: (a, b) => dayjs(a.sent_at).unix() - dayjs(b.sent_at).unix(),
      render: (date) => date ? dayjs(date).format('DD MMM YYYY HH:mm') : '-',
    },
  ];

  const templateLength = (smsTemplate || '').length;
  const templateWarning = templateLength > 155;

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: 'var(--c-accent)' }}>
          <MessageOutlined style={{ marginRight: 8 }} />
          SMS Automations
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
        >
          Create Automation
        </Button>
      </div>

      <Card>
        <Table
          dataSource={automations}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            pageSizeOptions: ['10', '25', '50', '100'],
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} automations`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
          onChange={(pag, _filters, sorter) => {
            setPagination({ current: pag.current, pageSize: pag.pageSize });
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={
          <Space>
            <ThunderboltOutlined style={{ color: 'var(--c-accent)' }} />
            {editingRecord ? 'Edit Automation' : 'Create Automation'}
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={680}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>Cancel</Button>,
          <Button
            key="test"
            icon={<ExperimentOutlined />}
            disabled={!editingRecord}
            onClick={() => {
              if (editingRecord) {
                setTestAutomationId(editingRecord.id);
                setTestModalVisible(true);
              }
            }}
          >
            Send Test SMS
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleSave}
            loading={saving}
            disabled={saving}
            style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
          >
            Save
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" initialValues={{ scope: 'all', delay: 0 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g., Welcome SMS for new leads" />
          </Form.Item>

          <Form.Item name="scope" label="Scope">
            <Radio.Group>
              <Radio value="all">All Campaigns</Radio>
              <Radio value="specific">Specific Campaign</Radio>
            </Radio.Group>
          </Form.Item>

          {scopeValue === 'specific' && (
            <Form.Item name="campaign_id" label="Campaign" rules={[{ required: true, message: 'Select a campaign' }]}>
              <Select
                placeholder="Select campaign"
                showSearch
                optionFilterProp="label"
                options={campaigns.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>
          )}

          <Form.Item name="trigger_event" label="Trigger Event" rules={[{ required: true, message: 'Select a trigger' }]}>
            <Select placeholder="Select trigger event" options={TRIGGER_EVENTS} />
          </Form.Item>

          {triggerEvent === 'lead_stage_changed' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="from_stage" label="From Stage" style={{ flex: 1 }}>
                <Select
                  placeholder="Any stage"
                  allowClear
                  options={stages.map((s) => ({ label: `${s.pipeline_name} → ${s.name}`, value: s.id }))}
                />
              </Form.Item>
              <Form.Item name="to_stage" label="To Stage" style={{ flex: 1 }}>
                <Select
                  placeholder="Any stage"
                  allowClear
                  options={stages.map((s) => ({ label: `${s.pipeline_name} → ${s.name}`, value: s.id }))}
                />
              </Form.Item>
            </div>
          )}

          {triggerEvent === 'custom_field_value_changed' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="field_name" label="Field Name" style={{ flex: 1 }}>
                <Input placeholder="e.g., policy_type" />
              </Form.Item>
              <Form.Item name="field_value" label="Value" style={{ flex: 1 }}>
                <Input placeholder="e.g., Health Insurance" />
              </Form.Item>
            </div>
          )}

          <Form.Item
            name="delay"
            label="Send After (minutes)"
            extra="Set to 0 to send immediately"
          >
            <InputNumber min={0} max={10080} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="sms_template"
            label="SMS Template"
            rules={[{ required: true, message: 'Template is required' }]}
            extra={
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Text type={templateWarning ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                  {templateLength}/160 characters {templateWarning && '⚠ May be split into multiple SMS'}
                </Text>
              </div>
            }
          >
            <TextArea
              ref={templateRef}
              rows={4}
              placeholder="Hi {{lead_name}}, thank you for your interest in our insurance plans..."
              maxLength={320}
            />
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              <InfoCircleOutlined /> Click to insert merge tags at cursor position:
            </Text>
            <Space wrap>
              {MERGE_TAGS.map((tag) => (
                <Button key={tag} size="small" type="dashed" onClick={() => insertMergeTag(tag)}>
                  {tag}
                </Button>
              ))}
            </Space>
          </div>

          <Form.Item name="provider_id" label="SMS Provider">
            <Select
              placeholder="Select SMS provider"
              allowClear
              options={smsProviders.map((p) => ({
                label: (
                  <Space>
                    {p.name}
                    {p.connected && <Tag color="green" style={{ fontSize: 10 }}>Connected</Tag>}
                  </Space>
                ),
                value: p.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test SMS Modal */}
      <Modal
        title={<Space><ExperimentOutlined style={{ color: '#fa8c16' }} /> Send Test SMS</Space>}
        open={testModalVisible}
        onCancel={() => { setTestModalVisible(false); setTestPhone(''); }}
        footer={[
          <Button key="cancel" onClick={() => { setTestModalVisible(false); setTestPhone(''); }}>Cancel</Button>,
          <Button
            key="send"
            type="primary"
            icon={<SendOutlined />}
            onClick={handleTestSms}
            loading={testSending}
            disabled={testSending}
            style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
          >
            Send Test
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Test Phone Number">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+91 98765 43210"
              prefix={<SendOutlined />}
            />
          </Form.Item>
          <Card size="small" style={{ background: '#f6f8fa' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Preview with sample values:</Text>
            <Paragraph style={{ margin: 0 }}>
              {(editingRecord?.sms_template || form.getFieldValue('sms_template') || '')
                .replace(/\{\{lead_name\}\}/g, 'John Doe')
                .replace(/\{\{agent_name\}\}/g, 'Agent Smith')
                .replace(/\{\{company_name\}\}/g, 'IBC Insurance')
                .replace(/\{\{stage_name\}\}/g, 'Qualified')
                .replace(/\{\{campaign_name\}\}/g, 'Summer Campaign')
                || 'No template provided'}
            </Paragraph>
          </Card>
        </Form>
      </Modal>

      {/* Logs Drawer */}
      <Drawer
        title={
          <Space>
            <FileSearchOutlined style={{ color: 'var(--c-accent)' }} />
            <span>SMS Logs — {logsAutomation?.name || ''}</span>
          </Space>
        }
        open={logsDrawerVisible}
        onClose={() => { setLogsDrawerVisible(false); setLogsAutomation(null); setLogs([]); }}
        width={720}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <RangePicker
            onChange={(dates) => setLogsDateFilter(dates)}
            value={logsDateFilter}
            allowClear
            size="small"
          />
          <Select
            placeholder="Filter by status"
            allowClear
            onChange={(val) => setLogsStatusFilter(val)}
            value={logsStatusFilter}
            style={{ width: 140 }}
            size="small"
            options={[
              { label: 'Sent', value: 'sent' },
              { label: 'Failed', value: 'failed' },
              { label: 'Pending', value: 'pending' },
            ]}
          />
          <Button
            size="small"
            onClick={() => logsAutomation && fetchLogs(logsAutomation.id)}
            loading={logsLoading}
          >
            Refresh
          </Button>
        </div>
        <Table
          dataSource={logs}
          columns={logColumns}
          rowKey="id"
          loading={logsLoading}
          size="small"
          pagination={{
            ...logsPagination,
            pageSizeOptions: ['10', '25', '50', '100'],
            showSizeChanger: true,
            showTotal: (total) => `${total} log entries`,
            onChange: (page, pageSize) => setLogsPagination({ current: page, pageSize }),
          }}
        />
      </Drawer>
    </div>
  );
};

export default SmsAutomation;
