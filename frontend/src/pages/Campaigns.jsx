import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, Modal, Steps, Form,
  Transfer, Radio, Card, Typography, Badge, Popconfirm, Row, Col,
  Descriptions, message, Tooltip, Divider, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, PauseCircleOutlined, PlayCircleOutlined,
  TeamOutlined, RocketOutlined, InfoCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_BADGE = {
  active: { color: '#52c41a', text: 'Active' },
  paused: { color: '#fa8c16', text: 'Paused' },
  completed: { color: '#1890ff', text: 'Completed' },
  draft: { color: '#8c8c8c', text: 'Draft' },
};

const DISTRIBUTION_LABELS = {
  equal: 'Equal Distribution',
  conditional: 'Conditional Distribution',
  ai: 'AI-Powered Distribution',
};

const DUPLICACY_LABELS = {
  ignore: 'Ignore Duplicates',
  create: 'Create New Lead',
  merge: 'Merge with Existing',
};

const RULE_FIELDS = [
  { value: 'city', label: 'City' },
  { value: 'source', label: 'Source' },
  { value: 'priority', label: 'Priority' },
];

const RULE_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
];

const Campaigns = () => {
  const navigate = useNavigate();

  // List state
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [pipelineFilter, setPipelineFilter] = useState(undefined);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('descend');

  // Lookup data
  const [pipelines, setPipelines] = useState([]);
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Transfer state
  const [selectedAgentKeys, setSelectedAgentKeys] = useState([]);

  // Distribution rules state
  const [distributionType, setDistributionType] = useState('equal');
  const [duplicacyType, setDuplicacyType] = useState('ignore');
  const [conditionalRules, setConditionalRules] = useState([
    { field: 'city', operator: 'equals', value: '', assign_to: undefined },
  ]);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (pipelineFilter) params.pipeline_id = pipelineFilter;
      if (sortField) {
        params.sort_field = sortField;
        params.sort_order = sortOrder === 'ascend' ? 'asc' : 'desc';
      }
      const res = await api.get('/campaigns', { params });
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      const count = responseData?.count ?? list.length;
      setCampaigns(list);
      setTotal(count);
    } catch (err) {
      message.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, pipelineFilter, sortField, sortOrder]);

  // Fetch lookup data
  const fetchPipelines = useCallback(async () => {
    try {
      const res = await api.get('/pipelines');
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      setPipelines(list);
    } catch {
      setPipelines([]);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      setUsers(list);
    } catch {
      setUsers([]);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/users', { params: { role: 'agent' } });
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      setAgents(list);
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    fetchPipelines();
    fetchUsers();
    fetchAgents();
  }, [fetchPipelines, fetchUsers, fetchAgents]);

  // Table change
  const handleTableChange = (pagination, _filters, sorter) => {
    setPage(pagination.current);
    setPageSize(pagination.pageSize);
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order || 'ascend');
    }
  };

  // Actions
  const handlePauseResume = async (record) => {
    try {
      await api.put(`/campaigns/${record.id}/pause-resume`);
      message.success(record.status === 'active' ? 'Campaign paused' : 'Campaign resumed');
      fetchCampaigns();
    } catch {
      message.error('Failed to update campaign status');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/campaigns/${id}`);
      message.success('Campaign deleted');
      fetchCampaigns();
    } catch {
      message.error('Failed to delete campaign');
    }
  };

  // Wizard helpers
  const openCreateWizard = () => {
    setEditingCampaign(null);
    form.resetFields();
    setSelectedAgentKeys([]);
    setDistributionType('equal');
    setDuplicacyType('ignore');
    setConditionalRules([{ field: 'city', operator: 'equals', value: '', assign_to: undefined }]);
    setWizardStep(0);
    setWizardOpen(true);
  };

  const openEditWizard = (record) => {
    setEditingCampaign(record);
    form.setFieldsValue({
      name: record.name,
      pipeline_id: record.pipeline_id,
      description: record.description,
      manager_id: record.manager_id,
    });
    const agentIds = (record.agents || []).map((a) => String(a.id || a.user_id || a.agent_id));
    setSelectedAgentKeys(agentIds);
    setDistributionType(record.distribution_type || 'equal');
    setDuplicacyType(record.duplicacy || 'ignore');
    setConditionalRules(
      record.conditional_rules?.length
        ? record.conditional_rules
        : [{ field: 'city', operator: 'equals', value: '', assign_to: undefined }]
    );
    setWizardStep(0);
    setWizardOpen(true);
  };

  const handleWizardNext = async () => {
    if (wizardStep === 0) {
      try {
        await form.validateFields(['name', 'pipeline_id']);
        setWizardStep(1);
      } catch {
        return;
      }
    } else if (wizardStep === 1) {
      setWizardStep(2);
    } else if (wizardStep === 2) {
      setWizardStep(3);
    }
  };

  const handleWizardPrev = () => {
    setWizardStep((prev) => Math.max(0, prev - 1));
  };

  const handleWizardSubmit = async () => {
    setSubmitting(true);
    try {
      const values = form.getFieldsValue();
      const payload = {
        name: values.name,
        pipeline_id: values.pipeline_id,
        description: values.description || '',
        manager_id: values.manager_id,
        agent_ids: selectedAgentKeys.map(Number),
        distribution_type: distributionType,
        duplicacy: duplicacyType,
        conditional_rules: distributionType === 'conditional' ? conditionalRules : [],
      };

      if (editingCampaign) {
        await api.put(`/campaigns/${editingCampaign.id}`, payload);
        message.success('Campaign updated successfully');
      } else {
        await api.post('/campaigns', payload);
        message.success('Campaign created successfully');
      }
      setWizardOpen(false);
      fetchCampaigns();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save campaign');
    } finally {
      setSubmitting(false);
    }
  };

  // Conditional rules helpers
  const addRule = () => {
    setConditionalRules([
      ...conditionalRules,
      { field: 'city', operator: 'equals', value: '', assign_to: undefined },
    ]);
  };

  const removeRule = (index) => {
    setConditionalRules(conditionalRules.filter((_, i) => i !== index));
  };

  const updateRule = (index, field, value) => {
    setConditionalRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  // Transfer data source
  const transferDataSource = agents.map((agent) => ({
    key: String(agent.id),
    title: agent.name || agent.full_name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim(),
    description: agent.email || '',
    campaign_count: agent.campaign_count || 0,
  }));

  // Table columns
  const columns = [
    {
      title: 'Campaign Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (text, record) => (
        <Button
          type="link"
          style={{ padding: 0, color: 'var(--c-accent)', fontWeight: 600 }}
          onClick={() => navigate(`/campaigns/${record.id}`)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Pipeline',
      dataIndex: 'pipeline',
      key: 'pipeline',
      render: (pipeline, record) => {
        const name = pipeline?.name || record.pipeline_name || '-';
        return <Tag color="var(--c-accent)">{name}</Tag>;
      },
    },
    {
      title: 'Manager',
      dataIndex: 'manager',
      key: 'manager',
      render: (manager, record) =>
        manager?.name || record.manager_name || '-',
    },
    {
      title: 'Agent Count',
      dataIndex: 'agent_count',
      key: 'agent_count',
      sorter: true,
      align: 'center',
      render: (val) => val ?? 0,
    },
    {
      title: 'Lead Count',
      dataIndex: 'lead_count',
      key: 'lead_count',
      sorter: true,
      align: 'center',
      render: (val) => val ?? 0,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (status) => {
        const s = STATUS_BADGE[status] || { color: '#8c8c8c', text: status || 'Unknown' };
        return <Badge color={s.color} text={s.text} />;
      },
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      render: (val) => formatDate(val),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/campaigns/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditWizard(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? 'Pause' : 'Resume'}>
            <Button
              type="text"
              icon={record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handlePauseResume(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Campaign"
            description="Are you sure you want to delete this campaign?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Render wizard steps
  const renderStep1 = () => (
    <Form form={form} layout="vertical" style={{ maxWidth: 520, margin: '0 auto' }}>
      <Form.Item
        label="Campaign Name"
        name="name"
        rules={[{ required: true, message: 'Please enter a campaign name' }]}
      >
        <Input placeholder="e.g. Q3 Health Insurance Drive" />
      </Form.Item>
      <Form.Item
        label="Select Pipeline"
        name="pipeline_id"
        rules={[{ required: true, message: 'Please select a pipeline' }]}
      >
        <Select placeholder="Choose pipeline" allowClear showSearch optionFilterProp="children">
          {pipelines
            .filter((p) => p.status === 'active' || !p.status)
            .map((p) => (
              <Option key={p.id} value={p.id}>
                {p.name}
              </Option>
            ))}
        </Select>
      </Form.Item>
      <Form.Item label="Description" name="description">
        <TextArea rows={3} placeholder="Brief campaign description..." />
      </Form.Item>
      <Form.Item label="Select Manager" name="manager_id">
        <Select placeholder="Choose manager" allowClear showSearch optionFilterProp="children">
          {users.map((u) => (
            <Option key={u.id} value={u.id}>
              {u.name || u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim()}
            </Option>
          ))}
        </Select>
      </Form.Item>
    </Form>
  );

  const renderStep2 = () => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Transfer
        dataSource={transferDataSource}
        targetKeys={selectedAgentKeys}
        onChange={(nextKeys) => setSelectedAgentKeys(nextKeys)}
        titles={['Available Agents', 'Assigned Agents']}
        render={(item) => (
          <span>
            {item.title}
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              ({item.campaign_count} campaigns)
            </Text>
          </span>
        )}
        listStyle={{ width: 300, height: 340 }}
        showSearch
        filterOption={(inputValue, item) =>
          item.title.toLowerCase().includes(inputValue.toLowerCase())
        }
      />
    </div>
  );

  const renderStep3 = () => (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 12 }}>
          Lead Distribution Method
        </Text>
        <Radio.Group
          value={distributionType}
          onChange={(e) => setDistributionType(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Radio value="equal">
              <Text strong>Equal Distribution</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                Leads are distributed equally among all assigned agents in round-robin fashion.
              </Text>
            </Radio>
            <Radio value="conditional">
              <Text strong>Conditional Distribution</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                Assign leads to specific agents based on field rules you define.
              </Text>
            </Radio>
            <Radio value="ai">
              <Text strong>AI-Powered Distribution</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                Uses AI to match leads with the best-suited agent automatically.
              </Text>
            </Radio>
          </Space>
        </Radio.Group>

        {distributionType === 'equal' && (
          <Card
            size="small"
            style={{ marginTop: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}
          >
            <Text>
              All incoming leads will be distributed equally among the {selectedAgentKeys.length || 0}{' '}
              assigned agent(s) in a round-robin pattern.
            </Text>
          </Card>
        )}

        {distributionType === 'conditional' && (
          <div style={{ marginTop: 16 }}>
            {conditionalRules.map((rule, idx) => (
              <Row key={idx} gutter={8} style={{ marginBottom: 8 }} align="middle">
                <Col span={5}>
                  <Select
                    value={rule.field}
                    onChange={(v) => updateRule(idx, 'field', v)}
                    style={{ width: '100%' }}
                    size="small"
                  >
                    {RULE_FIELDS.map((f) => (
                      <Option key={f.value} value={f.value}>{f.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={5}>
                  <Select
                    value={rule.operator}
                    onChange={(v) => updateRule(idx, 'operator', v)}
                    style={{ width: '100%' }}
                    size="small"
                  >
                    {RULE_OPERATORS.map((o) => (
                      <Option key={o.value} value={o.value}>{o.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={5}>
                  <Input
                    size="small"
                    placeholder="Value"
                    value={rule.value}
                    onChange={(e) => updateRule(idx, 'value', e.target.value)}
                  />
                </Col>
                <Col span={6}>
                  <Select
                    size="small"
                    placeholder="Assign To"
                    value={rule.assign_to}
                    onChange={(v) => updateRule(idx, 'assign_to', v)}
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="children"
                  >
                    {agents
                      .filter((a) => selectedAgentKeys.includes(String(a.id)))
                      .map((a) => (
                        <Option key={a.id} value={a.id}>
                          {a.name || a.full_name || `${a.first_name || ''} ${a.last_name || ''}`.trim()}
                        </Option>
                      ))}
                  </Select>
                </Col>
                <Col span={3}>
                  {conditionalRules.length > 1 && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeRule(idx)}
                    />
                  )}
                </Col>
              </Row>
            ))}
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addRule}>
              Add Rule
            </Button>
          </div>
        )}

        {distributionType === 'ai' && (
          <Alert
            type="info"
            showIcon
            icon={<RocketOutlined />}
            style={{ marginTop: 16 }}
            message="AI-Powered Assignment"
            description="Our AI engine will analyze lead attributes (location, source, product interest) and agent performance history to automatically assign each lead to the best-suited agent for maximum conversion."
          />
        )}
      </div>

      <Divider />

      <div>
        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 12 }}>
          Duplicacy Handling
        </Text>
        <Radio.Group
          value={duplicacyType}
          onChange={(e) => setDuplicacyType(e.target.value)}
        >
          <Space direction="vertical">
            <Radio value="ignore">
              <Text strong>Ignore</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                Duplicate leads will be ignored and not added to the campaign.
              </Text>
            </Radio>
            <Radio value="create">
              <Text strong>Create New</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                A new lead entry will be created even if a duplicate exists.
              </Text>
            </Radio>
            <Radio value="merge">
              <Text strong>Merge</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                Duplicate lead data will be merged with the existing lead record.
              </Text>
            </Radio>
          </Space>
        </Radio.Group>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const formValues = form.getFieldsValue();
    const selectedPipeline = pipelines.find((p) => p.id === formValues.pipeline_id);
    const selectedManager = users.find((u) => u.id === formValues.manager_id);
    const assignedAgentNames = agents
      .filter((a) => selectedAgentKeys.includes(String(a.id)))
      .map((a) => a.name || a.full_name || `${a.first_name || ''} ${a.last_name || ''}`.trim());

    return (
      <Card style={{ maxWidth: 600, margin: '0 auto' }}>
        <Title level={5} style={{ color: 'var(--c-accent)', marginBottom: 16 }}>
          Campaign Summary
        </Title>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Campaign Name">{formValues.name}</Descriptions.Item>
          <Descriptions.Item label="Pipeline">
            <Tag color="var(--c-accent)">{selectedPipeline?.name || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Description">
            {formValues.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Manager">
            {selectedManager
              ? selectedManager.name ||
                selectedManager.full_name ||
                `${selectedManager.first_name || ''} ${selectedManager.last_name || ''}`.trim()
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Assigned Agents">
            {assignedAgentNames.length > 0
              ? assignedAgentNames.map((n) => <Tag key={n}>{n}</Tag>)
              : 'None'}
          </Descriptions.Item>
          <Descriptions.Item label="Lead Distribution">
            {DISTRIBUTION_LABELS[distributionType]}
          </Descriptions.Item>
          {distributionType === 'conditional' && (
            <Descriptions.Item label="Rules">
              {conditionalRules.length} rule(s) defined
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Duplicacy Handling">
            {DUPLICACY_LABELS[duplicacyType]}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  const wizardSteps = [
    { title: 'Basic Info', icon: <InfoCircleOutlined /> },
    { title: 'Assign Agents', icon: <TeamOutlined /> },
    { title: 'Settings', icon: <RocketOutlined /> },
    { title: 'Review', icon: <EyeOutlined /> },
  ];

  const stepContents = [renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: 'var(--c-accent)' }}>
          Campaigns
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateWizard} style={{ background: 'var(--c-accent)' }}>
          Create Campaign
        </Button>
      </div>

      {/* Filters */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={8}>
          <Input
            placeholder="Search campaigns..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            allowClear
          />
        </Col>
        <Col xs={12} sm={5} md={4}>
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            allowClear
            style={{ width: '100%' }}
          >
            <Option value="active">Active</Option>
            <Option value="paused">Paused</Option>
            <Option value="completed">Completed</Option>
            <Option value="draft">Draft</Option>
          </Select>
        </Col>
        <Col xs={12} sm={5} md={4}>
          <Select
            placeholder="Pipeline"
            value={pipelineFilter}
            onChange={(v) => {
              setPipelineFilter(v);
              setPage(1);
            }}
            allowClear
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="children"
          >
            {pipelines.map((p) => (
              <Option key={p.id} value={p.id}>{p.name}</Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={campaigns}
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100'],
          showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} campaigns`,
        }}
        scroll={{ x: 1000 }}
      />

      {/* Wizard Modal */}
      <Modal
        title={
          <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
            {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
          </span>
        }
        open={wizardOpen}
        onCancel={() => setWizardOpen(false)}
        width={780}
        destroyOnClose
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {wizardStep > 0 && (
                <Button onClick={handleWizardPrev}>Back</Button>
              )}
            </div>
            <Space>
              <Button onClick={() => setWizardOpen(false)}>Cancel</Button>
              {wizardStep < 3 ? (
                <Button type="primary" onClick={handleWizardNext} style={{ background: 'var(--c-accent)' }}>
                  Next
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={handleWizardSubmit}
                  loading={submitting}
                  disabled={submitting}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                </Button>
              )}
            </Space>
          </div>
        }
      >
        <Steps
          current={wizardStep}
          items={wizardSteps}
          style={{ marginBottom: 32 }}
          size="small"
        />
        {stepContents[wizardStep]()}
      </Modal>
    </div>
  );
};

export default Campaigns;
