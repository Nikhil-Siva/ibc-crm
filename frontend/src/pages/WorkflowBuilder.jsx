import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Drawer, Form, Input, Select, Switch, Tag, Space,
  Typography, InputNumber, message, Spin, Tooltip, Popconfirm, Empty, Divider,
  Steps, Badge, Collapse, Radio, Descriptions,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FileSearchOutlined,
  ThunderboltOutlined, MessageOutlined, MailOutlined, SwapOutlined,
  UserSwitchOutlined, TagOutlined, ClockCircleOutlined, ApiOutlined,
  FileAddOutlined, ArrowLeftOutlined, SaveOutlined, PlayCircleOutlined,
  ArrowDownOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExperimentOutlined, BranchesOutlined, SettingOutlined, EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const TRIGGER_TYPES = [
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'lead_stage_changed', label: 'Lead Stage Changed' },
  { value: 'lead_assigned', label: 'Lead Assigned' },
  { value: 'call_ended', label: 'Call Ended' },
  { value: 'form_submitted', label: 'Form Submitted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'webhook_received', label: 'Webhook Received' },
];

const STEP_TYPES = [
  { type: 'send_sms', label: 'Send SMS', icon: <MessageOutlined />, color: 'var(--c-accent)' },
  { type: 'send_email', label: 'Send Email', icon: <MailOutlined />, color: '#fa8c16' },
  { type: 'send_whatsapp', label: 'Send WhatsApp', icon: <MessageOutlined />, color: '#25D366' },
  { type: 'change_stage', label: 'Change Lead Stage', icon: <SwapOutlined />, color: '#722ed1' },
  { type: 'assign_agent', label: 'Assign to Agent', icon: <UserSwitchOutlined />, color: 'var(--c-accent)' },
  { type: 'add_tag', label: 'Add Tag', icon: <TagOutlined />, color: '#eb2f96' },
  { type: 'wait', label: 'Wait', icon: <ClockCircleOutlined />, color: '#8c8c8c' },
  { type: 'send_webhook', label: 'Send Webhook', icon: <ApiOutlined />, color: '#13c2c2' },
  { type: 'create_task', label: 'Create Task', icon: <FileAddOutlined />, color: '#52c41a' },
];

const getStepMeta = (type) => STEP_TYPES.find((s) => s.type === type) || { label: type, icon: <SettingOutlined />, color: '#999' };

const WorkflowBuilder = () => {
  // View state
  const [view, setView] = useState('list'); // 'list' | 'builder'

  // List state
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // Builder state
  const [workflowId, setWorkflowId] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [triggerType, setTriggerType] = useState(null);
  const [triggerConfig, setTriggerConfig] = useState({});
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);

  // Trigger config modal
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [triggerForm] = Form.useForm();

  // Step modals
  const [addStepModalVisible, setAddStepModalVisible] = useState(false);
  const [addStepIndex, setAddStepIndex] = useState(null);
  const [editStepModalVisible, setEditStepModalVisible] = useState(false);
  const [editStepIndex, setEditStepIndex] = useState(null);
  const [stepForm] = Form.useForm();

  // Test modal
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testLeadId, setTestLeadId] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [leads, setLeads] = useState([]);

  // Logs drawer
  const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
  const [logsWorkflow, setLogsWorkflow] = useState(null);
  const [runLogs, setRunLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedRunLog, setSelectedRunLog] = useState(null);
  const [logsPagination, setLogsPagination] = useState({ current: 1, pageSize: 10 });

  // Reference data
  const [stages, setStages] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [agents, setAgents] = useState([]);
  const [smsProviders, setSmsProviders] = useState([]);
  const [whatsappProviders, setWhatsappProviders] = useState([]);

  // ─── Data fetching ───
  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/workflows');
      const data = res.data?.data || res.data;
      setWorkflows(Array.isArray(data) ? data : data?.rows || []);
    } catch {
      message.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [pipeRes, agentRes, smsRes, waRes] = await Promise.allSettled([
        api.get('/pipelines'),
        api.get('/users', { params: { role: 'agent' } }),
        api.get('/marketplace', { params: { category: 'bulk_sms' } }),
        api.get('/marketplace', { params: { category: 'whatsapp' } }),
      ]);
      if (pipeRes.status === 'fulfilled') {
        const d = pipeRes.value.data?.data || pipeRes.value.data;
        const pList = Array.isArray(d) ? d : d?.rows || [];
        setPipelines(pList);
        const allStages = [];
        pList.forEach((p) => (p.stages || []).forEach((s) => allStages.push({ ...s, pipeline_name: p.name, pipeline_id: p.id })));
        setStages(allStages);
      }
      if (agentRes.status === 'fulfilled') {
        const d = agentRes.value.data?.data || agentRes.value.data;
        setAgents(Array.isArray(d) ? d : d?.rows || []);
      }
      if (smsRes.status === 'fulfilled') {
        const d = smsRes.value.data?.data || smsRes.value.data;
        setSmsProviders(Array.isArray(d) ? d : d?.rows || []);
      }
      if (waRes.status === 'fulfilled') {
        const d = waRes.value.data?.data || waRes.value.data;
        setWhatsappProviders(Array.isArray(d) ? d : d?.rows || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchLogs = useCallback(async (wfId) => {
    setLogsLoading(true);
    try {
      const res = await api.get(`/workflows/${wfId}/logs`);
      const data = res.data?.data || res.data;
      setRunLogs(Array.isArray(data) ? data : data?.rows || []);
    } catch {
      message.error('Failed to load workflow logs');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await api.get('/leads', { params: { page: 1, per_page: 50 } });
      const data = res.data?.data || res.data;
      setLeads(Array.isArray(data) ? data : data?.rows || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    fetchReferenceData();
  }, [fetchWorkflows, fetchReferenceData]);

  // ─── List handlers ───
  const handleToggleStatus = useCallback(async (record) => {
    try {
      await api.put(`/workflows/${record.id}`, {
        ...record,
        status: record.status === 'active' ? 'inactive' : 'active',
      });
      message.success('Status updated');
      fetchWorkflows();
    } catch {
      message.error('Failed to update status');
    }
  }, [fetchWorkflows]);

  const handleDelete = useCallback(async (id) => {
    try {
      await api.delete(`/workflows/${id}`);
      message.success('Workflow deleted');
      fetchWorkflows();
    } catch {
      message.error('Failed to delete workflow');
    }
  }, [fetchWorkflows]);

  const handleCreate = () => {
    setWorkflowId(null);
    setWorkflowName('');
    setWorkflowDescription('');
    setTriggerType(null);
    setTriggerConfig({});
    setSteps([]);
    setView('builder');
  };

  const handleEditWorkflow = (record) => {
    setWorkflowId(record.id);
    setWorkflowName(record.name || '');
    setWorkflowDescription(record.description || '');
    setTriggerType(record.trigger_type || null);
    setTriggerConfig(record.trigger_config || {});
    setSteps(record.steps || []);
    setView('builder');
  };

  // ─── Trigger handlers ───
  const openTriggerConfig = () => {
    triggerForm.setFieldsValue({
      trigger_type: triggerType,
      from_stage: triggerConfig.from_stage,
      to_stage: triggerConfig.to_stage,
      ...(triggerConfig || {}),
    });
    setTriggerModalVisible(true);
  };

  const saveTriggerConfig = () => {
    const values = triggerForm.getFieldsValue();
    setTriggerType(values.trigger_type);
    const config = { ...values };
    delete config.trigger_type;
    setTriggerConfig(config);
    setTriggerModalVisible(false);
    message.success('Trigger configured');
  };

  // ─── Step handlers ───
  const openAddStep = (index) => {
    setAddStepIndex(index);
    setAddStepModalVisible(true);
  };

  const selectStepType = (type) => {
    setAddStepModalVisible(false);
    const meta = getStepMeta(type);
    const newStep = { id: Date.now(), type, label: meta.label, config: {} };
    const idx = addStepIndex !== null ? addStepIndex + 1 : steps.length;
    const newSteps = [...steps];
    newSteps.splice(idx, 0, newStep);
    setSteps(newSteps);
    // Immediately open config
    setEditStepIndex(idx);
    stepForm.resetFields();
    setEditStepModalVisible(true);
  };

  const openEditStep = (index) => {
    setEditStepIndex(index);
    const step = steps[index];
    stepForm.setFieldsValue(step.config || {});
    setEditStepModalVisible(true);
  };

  const saveStepConfig = () => {
    const values = stepForm.getFieldsValue();
    setSteps((prev) => prev.map((s, i) => (i === editStepIndex ? { ...s, config: values } : s)));
    setEditStepModalVisible(false);
    message.success('Step configured');
  };

  const deleteStep = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    message.info('Step removed');
  };

  // ─── Save & Test ───
  const handleSave = useCallback(async () => {
    if (!workflowName.trim()) {
      message.warning('Please enter a workflow name');
      return;
    }
    if (!triggerType) {
      message.warning('Please configure a trigger');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: workflowName,
        description: workflowDescription,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        steps,
      };
      if (workflowId) {
        await api.put(`/workflows/${workflowId}`, payload);
      } else {
        const res = await api.post('/workflows', payload);
        const data = res.data?.data || res.data;
        if (data?.id) setWorkflowId(data.id);
      }
      message.success('Workflow saved successfully');
    } catch {
      message.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }, [workflowName, workflowDescription, triggerType, triggerConfig, steps, workflowId]);

  const openTestModal = () => {
    if (!workflowId) {
      message.warning('Save the workflow before testing');
      return;
    }
    fetchLeads();
    setTestResults(null);
    setTestLeadId(null);
    setTestModalVisible(true);
  };

  const handleTestRun = useCallback(async () => {
    if (!testLeadId) {
      message.warning('Please select a lead');
      return;
    }
    setTestRunning(true);
    setTestResults(null);
    try {
      const res = await api.post('/workflows/test-run', {
        workflow_id: workflowId,
        lead_id: testLeadId,
      });
      const data = res.data?.data || res.data;
      setTestResults(data);
      message.success('Test run completed');
    } catch {
      message.error('Test run failed');
    } finally {
      setTestRunning(false);
    }
  }, [workflowId, testLeadId]);

  // ─── Step summary ───
  const getStepSummary = (step) => {
    const c = step.config || {};
    switch (step.type) {
      case 'send_sms':
        return c.template ? `SMS: "${c.template.substring(0, 40)}..."` : 'Configure SMS template';
      case 'send_email':
        return c.subject ? `Email: ${c.subject}` : 'Configure email';
      case 'send_whatsapp':
        return c.template ? `WhatsApp: "${c.template.substring(0, 40)}..."` : 'Configure WhatsApp template';
      case 'change_stage': {
        const st = stages.find((s) => s.id === c.target_stage);
        return st ? `Move to: ${st.pipeline_name} → ${st.name}` : 'Select target stage';
      }
      case 'assign_agent':
        if (c.assignment_type === 'round_robin') return 'Round Robin assignment';
        const ag = agents.find((a) => a.id === c.agent_id);
        return ag ? `Assign to: ${ag.name || ag.email}` : 'Select agent';
      case 'add_tag':
        return c.tag_name ? `Tag: ${c.tag_name}` : 'Enter tag name';
      case 'wait':
        return c.duration ? `Wait ${c.duration} ${c.unit || 'minutes'}` : 'Set wait duration';
      case 'send_webhook':
        return c.url ? `${(c.method || 'POST').toUpperCase()} ${c.url}` : 'Configure webhook';
      case 'create_task':
        return c.title ? `Task: ${c.title}` : 'Configure task';
      default:
        return 'Configure step';
    }
  };

  // ─── Step config form ───
  const renderStepConfigFields = () => {
    if (editStepIndex === null || !steps[editStepIndex]) return null;
    const step = steps[editStepIndex];
    switch (step.type) {
      case 'send_sms':
        return (
          <>
            <Form.Item name="provider_id" label="SMS Provider">
              <Select
                placeholder="Select provider"
                allowClear
                options={smsProviders.map((p) => ({ label: p.name, value: p.id }))}
              />
            </Form.Item>
            <Form.Item name="template" label="SMS Template" rules={[{ required: true, message: 'Template is required' }]}>
              <TextArea rows={4} placeholder="Hi {{lead_name}}, ..." />
            </Form.Item>
          </>
        );
      case 'send_email':
        return (
          <>
            <Form.Item name="subject" label="Subject" rules={[{ required: true, message: 'Subject is required' }]}>
              <Input placeholder="Email subject" />
            </Form.Item>
            <Form.Item name="body" label="Body" rules={[{ required: true, message: 'Body is required' }]}>
              <TextArea rows={6} placeholder="Email body content..." />
            </Form.Item>
          </>
        );
      case 'send_whatsapp':
        return (
          <>
            <Form.Item name="provider_id" label="WhatsApp Provider">
              <Select
                placeholder="Select provider"
                allowClear
                options={whatsappProviders.map((p) => ({ label: p.name, value: p.id }))}
              />
            </Form.Item>
            <Form.Item name="template" label="WhatsApp Template" rules={[{ required: true, message: 'Template is required' }]}>
              <TextArea rows={4} placeholder="Hi {{lead_name}}, ..." />
            </Form.Item>
          </>
        );
      case 'change_stage':
        return (
          <>
            <Form.Item name="pipeline_id" label="Pipeline">
              <Select
                placeholder="Select pipeline"
                options={pipelines.map((p) => ({ label: p.name, value: p.id }))}
              />
            </Form.Item>
            <Form.Item name="target_stage" label="Target Stage" rules={[{ required: true, message: 'Select a stage' }]}>
              <Select
                placeholder="Select stage"
                options={stages.map((s) => ({ label: `${s.pipeline_name} → ${s.name}`, value: s.id }))}
              />
            </Form.Item>
          </>
        );
      case 'assign_agent':
        return (
          <>
            <Form.Item name="assignment_type" label="Assignment Type" initialValue="specific">
              <Radio.Group>
                <Radio value="specific">Specific Agent</Radio>
                <Radio value="round_robin">Round Robin</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.assignment_type !== cur.assignment_type}>
              {({ getFieldValue }) =>
                getFieldValue('assignment_type') === 'specific' ? (
                  <Form.Item name="agent_id" label="Agent" rules={[{ required: true, message: 'Select an agent' }]}>
                    <Select
                      placeholder="Select agent"
                      showSearch
                      optionFilterProp="label"
                      options={agents.map((a) => ({ label: a.name || a.email, value: a.id }))}
                    />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </>
        );
      case 'add_tag':
        return (
          <Form.Item name="tag_name" label="Tag Name" rules={[{ required: true, message: 'Enter a tag name' }]}>
            <Input placeholder="e.g., hot-lead" />
          </Form.Item>
        );
      case 'wait':
        return (
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="duration" label="Duration" style={{ flex: 1 }} rules={[{ required: true, message: 'Enter duration' }]}>
              <InputNumber min={1} max={10080} style={{ width: '100%' }} placeholder="e.g., 30" />
            </Form.Item>
            <Form.Item name="unit" label="Unit" style={{ flex: 1 }} initialValue="minutes">
              <Select options={[
                { label: 'Minutes', value: 'minutes' },
                { label: 'Hours', value: 'hours' },
                { label: 'Days', value: 'days' },
              ]} />
            </Form.Item>
          </div>
        );
      case 'send_webhook':
        return (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="method" label="Method" style={{ width: 120 }} initialValue="POST">
                <Select options={[
                  { label: 'POST', value: 'POST' },
                  { label: 'GET', value: 'GET' },
                  { label: 'PUT', value: 'PUT' },
                  { label: 'PATCH', value: 'PATCH' },
                ]} />
              </Form.Item>
              <Form.Item name="url" label="URL" style={{ flex: 1 }} rules={[{ required: true, message: 'Enter URL' }]}>
                <Input placeholder="https://api.example.com/webhook" />
              </Form.Item>
            </div>
            <Form.Item name="headers" label="Headers (JSON)">
              <TextArea rows={2} placeholder='{"Authorization": "Bearer ..."}' />
            </Form.Item>
            <Form.Item name="body" label="Body (JSON)">
              <TextArea rows={3} placeholder='{"lead_id": "{{lead_id}}"}' />
            </Form.Item>
          </>
        );
      case 'create_task':
        return (
          <>
            <Form.Item name="title" label="Task Title" rules={[{ required: true, message: 'Enter task title' }]}>
              <Input placeholder="Follow up with lead" />
            </Form.Item>
            <Form.Item name="assign_to" label="Assign To">
              <Select
                placeholder="Select agent"
                allowClear
                showSearch
                optionFilterProp="label"
                options={agents.map((a) => ({ label: a.name || a.email, value: a.id }))}
              />
            </Form.Item>
            <Form.Item name="due_date_offset_days" label="Due Date (days from now)">
              <InputNumber min={0} max={365} style={{ width: '100%' }} placeholder="e.g., 3" />
            </Form.Item>
          </>
        );
      default:
        return <Text type="secondary">No configuration needed for this step type.</Text>;
    }
  };

  // ─── List View ───
  const listColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Trigger',
      dataIndex: 'trigger_type',
      render: (type) => {
        const found = TRIGGER_TYPES.find((t) => t.value === type);
        return <Tag color="blue" icon={<ThunderboltOutlined />}>{found?.label || type || 'Not set'}</Tag>;
      },
    },
    {
      title: 'Steps',
      dataIndex: 'steps',
      render: (stps) => <Badge count={(stps || []).length} showZero color="var(--c-accent)" overflowCount={99} />,
    },
    {
      title: 'Total Runs',
      dataIndex: 'total_runs',
      sorter: (a, b) => (a.total_runs || 0) - (b.total_runs || 0),
      render: (val) => val || 0,
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
      title: 'Last Run',
      dataIndex: 'last_run_at',
      sorter: (a, b) => dayjs(a.last_run_at).unix() - dayjs(b.last_run_at).unix(),
      render: (date) => date ? dayjs(date).format('DD MMM YYYY HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEditWorkflow(record)} />
          </Tooltip>
          <Popconfirm title="Delete this workflow?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
          <Tooltip title="View Logs">
            <Button
              type="text"
              icon={<FileSearchOutlined />}
              onClick={() => { setLogsWorkflow(record); setLogsDrawerVisible(true); fetchLogs(record.id); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: 'Lead',
      dataIndex: 'lead_name',
      render: (text, record) => text || record.lead_id || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => {
        const map = { completed: 'green', failed: 'red', running: 'blue', pending: 'orange' };
        return <Tag color={map[status] || 'default'}>{(status || 'unknown').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Steps Executed',
      dataIndex: 'steps_executed',
      render: (val) => val || 0,
    },
    {
      title: 'Started At',
      dataIndex: 'started_at',
      sorter: (a, b) => dayjs(a.started_at).unix() - dayjs(b.started_at).unix(),
      render: (date) => date ? dayjs(date).format('DD MMM YYYY HH:mm') : '-',
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      render: (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
      },
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedRunLog(record)}>
          View
        </Button>
      ),
    },
  ];

  // ─── Render List View ───
  if (view === 'list') {
    return (
      <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Title level={3} style={{ margin: 0, color: 'var(--c-accent)' }}>
            <BranchesOutlined style={{ marginRight: 8 }} />
            Workflow Automations
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
          >
            Create Workflow
          </Button>
        </div>

        <Card>
          <Table
            dataSource={workflows}
            columns={listColumns}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              pageSizeOptions: ['10', '25', '50', '100'],
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} workflows`,
              onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
            }}
          />
        </Card>

        {/* Logs Drawer */}
        <Drawer
          title={
            <Space>
              <FileSearchOutlined style={{ color: 'var(--c-accent)' }} />
              <span>Workflow Logs — {logsWorkflow?.name || ''}</span>
            </Space>
          }
          open={logsDrawerVisible}
          onClose={() => { setLogsDrawerVisible(false); setLogsWorkflow(null); setRunLogs([]); setSelectedRunLog(null); }}
          width={800}
        >
          {selectedRunLog ? (
            <div>
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => setSelectedRunLog(null)}
                style={{ marginBottom: 12, padding: 0 }}
              >
                Back to logs
              </Button>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="Lead">{selectedRunLog.lead_name || selectedRunLog.lead_id}</Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color={selectedRunLog.status === 'completed' ? 'green' : 'red'}>{selectedRunLog.status?.toUpperCase()}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Started">{selectedRunLog.started_at ? dayjs(selectedRunLog.started_at).format('DD MMM YYYY HH:mm:ss') : '-'}</Descriptions.Item>
                  <Descriptions.Item label="Duration">{selectedRunLog.duration_ms ? `${selectedRunLog.duration_ms}ms` : '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
              <Title level={5} style={{ color: 'var(--c-accent)' }}>Step Execution Details</Title>
              <Steps
                direction="vertical"
                size="small"
                current={(selectedRunLog.step_details || []).length}
                items={(selectedRunLog.step_details || []).map((sd, i) => ({
                  title: (
                    <Space>
                      <Text strong>{sd.step_name || `Step ${i + 1}`}</Text>
                      <Tag color={sd.status === 'completed' ? 'green' : sd.status === 'failed' ? 'red' : 'blue'}>
                        {sd.status?.toUpperCase() || 'UNKNOWN'}
                      </Tag>
                    </Space>
                  ),
                  description: (
                    <div>
                      {sd.message && <Text type="secondary">{sd.message}</Text>}
                      {sd.executed_at && (
                        <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                          {dayjs(sd.executed_at).format('HH:mm:ss')}
                        </Text>
                      )}
                    </div>
                  ),
                  status: sd.status === 'completed' ? 'finish' : sd.status === 'failed' ? 'error' : 'process',
                  icon: sd.status === 'completed' ? <CheckCircleOutlined /> : sd.status === 'failed' ? <CloseCircleOutlined /> : <ClockCircleOutlined />,
                }))}
              />
              {(!selectedRunLog.step_details || selectedRunLog.step_details.length === 0) && (
                <Empty description="No step details available" style={{ marginTop: 24 }} />
              )}
            </div>
          ) : (
            <Table
              dataSource={runLogs}
              columns={logColumns}
              rowKey="id"
              loading={logsLoading}
              size="small"
              pagination={{
                ...logsPagination,
                pageSizeOptions: ['10', '25', '50', '100'],
                showSizeChanger: true,
                showTotal: (total) => `${total} runs`,
                onChange: (page, pageSize) => setLogsPagination({ current: page, pageSize }),
              }}
            />
          )}
        </Drawer>
      </div>
    );
  }

  // ─── Render Builder View ───
  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => { setView('list'); fetchWorkflows(); }}>
            Back
          </Button>
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow name"
            style={{ width: 260, fontWeight: 600, fontSize: 16 }}
          />
          <Input
            value={workflowDescription}
            onChange={(e) => setWorkflowDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{ width: 300 }}
          />
        </Space>
        <Space>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={openTestModal}
            disabled={!workflowId}
          >
            Test Workflow
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={saving}
            style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
          >
            Save Workflow
          </Button>
        </Space>
      </div>

      {/* Canvas */}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Trigger Block */}
        <Card
          hoverable
          onClick={openTriggerConfig}
          style={{
            background: 'var(--c-accent)',
            borderRadius: 12,
            cursor: 'pointer',
            marginBottom: 0,
          }}
          styles={{ body: { padding: '16px 20px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ThunderboltOutlined style={{ fontSize: 20, color: '#fff' }} />
            </div>
            <div>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>TRIGGER</Text>
              <Text strong style={{ color: '#fff', fontSize: 15 }}>
                {triggerType
                  ? TRIGGER_TYPES.find((t) => t.value === triggerType)?.label || triggerType
                  : 'Click to configure trigger'}
              </Text>
            </div>
            <EditOutlined style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)' }} />
          </div>
        </Card>

        {/* Arrow connector */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <div style={{ width: 2, height: 24, background: '#d9d9d9', position: 'relative' }}>
            <ArrowDownOutlined style={{ position: 'absolute', bottom: -8, left: -7, color: '#d9d9d9', fontSize: 16 }} />
          </div>
        </div>

        {/* Step Blocks */}
        {steps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => openAddStep(-1)}
              style={{ borderRadius: 20, padding: '4px 24px' }}
            >
              Add First Step
            </Button>
          </div>
        ) : (
          steps.map((step, index) => {
            const meta = getStepMeta(step.type);
            return (
              <React.Fragment key={step.id}>
                {/* Step Card */}
                <Card
                  hoverable
                  style={{ borderRadius: 10, borderLeft: `4px solid ${meta.color}` }}
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: `${meta.color}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, fontSize: 18,
                    }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 13, display: 'block' }}>{meta.label}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{getStepSummary(step)}</Text>
                    </div>
                    <Space size={4}>
                      <Tooltip title="Edit">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditStep(index)} />
                      </Tooltip>
                      <Popconfirm title="Remove this step?" onConfirm={() => deleteStep(index)} placement="left">
                        <Tooltip title="Delete">
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>

                {/* Arrow + Add button */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 2, height: 16, background: '#d9d9d9' }} />
                    <Tooltip title="Add step here">
                      <Button
                        shape="circle"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => openAddStep(index)}
                        style={{ border: '1px dashed #d9d9d9', color: '#999', width: 24, height: 24, minWidth: 24 }}
                      />
                    </Tooltip>
                    <div style={{ width: 2, height: 8, background: '#d9d9d9' }} />
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Trigger Config Modal */}
      <Modal
        title={<Space><ThunderboltOutlined style={{ color: 'var(--c-accent)' }} /> Configure Trigger</Space>}
        open={triggerModalVisible}
        onCancel={() => setTriggerModalVisible(false)}
        onOk={saveTriggerConfig}
        okText="Save"
        okButtonProps={{ style: { background: 'var(--c-accent)', borderColor: 'var(--c-accent)' } }}
      >
        <Form form={triggerForm} layout="vertical">
          <Form.Item name="trigger_type" label="Trigger Type" rules={[{ required: true, message: 'Select a trigger type' }]}>
            <Select placeholder="Select trigger type" options={TRIGGER_TYPES} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.trigger_type !== cur.trigger_type}>
            {({ getFieldValue }) => {
              const tt = getFieldValue('trigger_type');
              if (tt === 'lead_stage_changed') {
                return (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Form.Item name="from_stage" label="From Stage" style={{ flex: 1 }}>
                      <Select placeholder="Any" allowClear options={stages.map((s) => ({ label: `${s.pipeline_name} → ${s.name}`, value: s.id }))} />
                    </Form.Item>
                    <Form.Item name="to_stage" label="To Stage" style={{ flex: 1 }}>
                      <Select placeholder="Any" allowClear options={stages.map((s) => ({ label: `${s.pipeline_name} → ${s.name}`, value: s.id }))} />
                    </Form.Item>
                  </div>
                );
              }
              if (tt === 'scheduled') {
                return (
                  <Form.Item name="cron_expression" label="Cron Expression">
                    <Input placeholder="e.g., 0 9 * * 1 (Every Monday at 9am)" />
                  </Form.Item>
                );
              }
              if (tt === 'webhook_received') {
                return (
                  <Form.Item name="webhook_path" label="Webhook Path">
                    <Input placeholder="/webhooks/my-trigger" addonBefore="POST" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Step Modal */}
      <Modal
        title={<Space><PlusOutlined style={{ color: 'var(--c-accent)' }} /> Add Step</Space>}
        open={addStepModalVisible}
        onCancel={() => setAddStepModalVisible(false)}
        footer={null}
        width={560}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '8px 0' }}>
          {STEP_TYPES.map((st) => (
            <Card
              key={st.type}
              hoverable
              onClick={() => selectStepType(st.type)}
              style={{ textAlign: 'center', borderRadius: 10, cursor: 'pointer' }}
              styles={{ body: { padding: '16px 8px' } }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: `${st.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px', color: st.color, fontSize: 22,
              }}>
                {st.icon}
              </div>
              <Text strong style={{ fontSize: 12 }}>{st.label}</Text>
            </Card>
          ))}
        </div>
      </Modal>

      {/* Edit Step Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: 'var(--c-accent)' }} />
            Configure {editStepIndex !== null && steps[editStepIndex] ? getStepMeta(steps[editStepIndex].type).label : 'Step'}
          </Space>
        }
        open={editStepModalVisible}
        onCancel={() => setEditStepModalVisible(false)}
        onOk={saveStepConfig}
        okText="Save"
        okButtonProps={{ style: { background: 'var(--c-accent)', borderColor: 'var(--c-accent)' } }}
        width={520}
      >
        <Form form={stepForm} layout="vertical">
          {renderStepConfigFields()}
        </Form>
      </Modal>

      {/* Test Workflow Modal */}
      <Modal
        title={<Space><ExperimentOutlined style={{ color: '#fa8c16' }} /> Test Workflow</Space>}
        open={testModalVisible}
        onCancel={() => { setTestModalVisible(false); setTestResults(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setTestModalVisible(false); setTestResults(null); }}>Close</Button>,
          <Button
            key="run"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleTestRun}
            loading={testRunning}
            disabled={testRunning}
            style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
          >
            Run Test
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Select a Lead to test with">
            <Select
              placeholder="Search and select a lead"
              showSearch
              optionFilterProp="label"
              value={testLeadId}
              onChange={setTestLeadId}
              options={leads.map((l) => ({
                label: l.name || l.email || `Lead #${l.id}`,
                value: l.id,
              }))}
            />
          </Form.Item>
        </Form>
        {testResults && (
          <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f', marginTop: 12 }}>
            <Text strong style={{ color: '#52c41a', display: 'block', marginBottom: 6 }}>
              <CheckCircleOutlined /> Test Run Results
            </Text>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Status">
                <Tag color={testResults.status === 'completed' ? 'green' : 'red'}>{testResults.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Steps Executed">{testResults.steps_executed || 0}</Descriptions.Item>
              <Descriptions.Item label="Duration">{testResults.duration_ms ? `${testResults.duration_ms}ms` : '-'}</Descriptions.Item>
              {testResults.error && (
                <Descriptions.Item label="Error"><Text type="danger">{testResults.error}</Text></Descriptions.Item>
              )}
            </Descriptions>
            {testResults.step_results && (
              <div style={{ marginTop: 8 }}>
                <Text strong style={{ fontSize: 12 }}>Step Details:</Text>
                {testResults.step_results.map((sr, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                    {sr.status === 'completed'
                      ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      : <CloseCircleOutlined style={{ color: '#f5222d' }} />
                    }
                    <Text style={{ fontSize: 12 }}>{sr.step_name || `Step ${i + 1}`}: {sr.message || sr.status}</Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default WorkflowBuilder;
