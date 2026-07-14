import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Tag, Badge, Space, Card, Row, Col, Table, Tabs,
  Statistic, Descriptions, message, Tooltip, Modal, Select, Empty,
  Timeline, Spin, Divider, List, Avatar,
} from 'antd';
import {
  ArrowLeftOutlined, PauseCircleOutlined, PlayCircleOutlined,
  EditOutlined, TeamOutlined, FileTextOutlined,
  UserOutlined, PhoneOutlined, SettingOutlined,
  FieldTimeOutlined, PlusOutlined, FormOutlined,
  BarChartOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/axios';
import { formatDate, formatMobile } from '../utils/formatters';

const { Title, Text, Paragraph } = Typography;
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

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Campaign data
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(true);

  // Leads tab
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPageSize, setLeadsPageSize] = useState(10);

  // Agents tab
  const [campaignAgents, setCampaignAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsPageSize, setAgentsPageSize] = useState(10);

  // Engagement form
  const [engagementForm, setEngagementForm] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Activity log
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Add agent modal
  const [addAgentModal, setAddAgentModal] = useState(false);
  const [allAgents, setAllAgents] = useState([]);
  const [selectedNewAgents, setSelectedNewAgents] = useState([]);
  const [addingAgents, setAddingAgents] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('leads');

  // Fetch campaign details
  const fetchCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/campaigns/${id}`);
      const data = res.data?.data || res.data;
      setCampaign(data);
    } catch {
      message.error('Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get(`/campaigns/${id}/stats`);
      const data = res.data?.data || res.data;
      setStats(data || {});
    } catch {
      setStats({});
    } finally {
      setStatsLoading(false);
    }
  }, [id]);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const res = await api.get(`/campaigns/${id}/leads`, {
        params: { page: leadsPage, limit: leadsPageSize },
      });
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      const count = responseData?.count ?? list.length;
      setLeads(list);
      setLeadsTotal(count);
    } catch {
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, [id, leadsPage, leadsPageSize]);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const res = await api.get(`/campaigns/${id}/agents`, {
        params: { page: agentsPage, limit: agentsPageSize },
      });
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      const count = responseData?.count ?? list.length;
      setCampaignAgents(list);
      setAgentsTotal(count);
    } catch {
      setCampaignAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  }, [id, agentsPage, agentsPageSize]);

  // Fetch engagement form
  const fetchEngagementForm = useCallback(async () => {
    setFormLoading(true);
    try {
      const res = await api.get(`/engagement-forms/campaign/${id}`);
      const data = res.data?.data || res.data;
      setEngagementForm(data);
    } catch {
      setEngagementForm(null);
    } finally {
      setFormLoading(false);
    }
  }, [id]);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const res = await api.get(`/campaigns/${id}/activities`);
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      setActivities(list);
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [id]);

  // Fetch all agents for "Add Agent"
  const fetchAllAgents = useCallback(async () => {
    try {
      const res = await api.get('/users', { params: { role: 'agent' } });
      const responseData = res.data?.data || res.data;
      const list = responseData?.rows || (Array.isArray(responseData) ? responseData : []);
      setAllAgents(list);
    } catch {
      setAllAgents([]);
    }
  }, []);

  useEffect(() => {
    fetchCampaign();
    fetchStats();
  }, [fetchCampaign, fetchStats]);

  useEffect(() => {
    if (activeTab === 'leads') fetchLeads();
  }, [activeTab, fetchLeads]);

  useEffect(() => {
    if (activeTab === 'agents') {
      fetchAgents();
      fetchAllAgents();
    }
  }, [activeTab, fetchAgents, fetchAllAgents]);

  useEffect(() => {
    if (activeTab === 'engagement') fetchEngagementForm();
  }, [activeTab, fetchEngagementForm]);

  useEffect(() => {
    if (activeTab === 'activity') fetchActivities();
  }, [activeTab, fetchActivities]);

  // Actions
  const handlePauseResume = async () => {
    try {
      await api.put(`/campaigns/${id}/pause-resume`);
      message.success(campaign?.status === 'active' ? 'Campaign paused' : 'Campaign resumed');
      fetchCampaign();
      fetchStats();
    } catch {
      message.error('Failed to update campaign status');
    }
  };

  const handleAddAgents = async () => {
    if (!selectedNewAgents.length) {
      message.warning('Please select at least one agent');
      return;
    }
    setAddingAgents(true);
    try {
      await api.post(`/campaigns/${id}/agents`, { agent_ids: selectedNewAgents });
      message.success('Agents added successfully');
      setAddAgentModal(false);
      setSelectedNewAgents([]);
      fetchAgents();
      fetchStats();
    } catch {
      message.error('Failed to add agents');
    } finally {
      setAddingAgents(false);
    }
  };

  // Leads columns
  const leadsColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (text, record) => {
        const displayName = text || record.full_name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || '-';
        return (
          <Button type="link" style={{ padding: 0, color: 'var(--c-accent)' }} onClick={() => navigate(`/leads/${record.id || record.lead_id}`)}>
            {displayName}
          </Button>
        );
      },
    },
    {
      title: 'Mobile',
      dataIndex: 'mobile',
      key: 'mobile',
      render: (val) => formatMobile(val),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (status) => {
        const colorMap = {
          New: 'blue', Interested: 'purple', 'Follow-up': 'orange',
          'Proposal Sent': 'cyan', 'Document Collection': 'geekblue',
          'Payment Pending': 'magenta', 'Closed Won': 'green', 'Closed Lost': 'red', Junk: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status || '-'}</Tag>;
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      sorter: true,
      render: (val) => {
        const colorMap = { Hot: '#f5222d', Warm: '#fa8c16', Cold: '#1890ff' };
        return val ? <Tag color={colorMap[val] || 'default'}>{val}</Tag> : '-';
      },
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (val) => val || '-',
    },
    {
      title: 'Assigned To',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      render: (val, record) => {
        const agentName = typeof val === 'object' ? (val?.name || val?.full_name) : record.assigned_agent_name || record.agent_name || val;
        return agentName || '-';
      },
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      render: (val) => formatDate(val),
    },
  ];

  // Agents columns
  const agentsColumns = [
    {
      title: 'Agent Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (text, record) => {
        const displayName = text || record.full_name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || '-';
        return (
          <Space>
            <Avatar size="small" icon={<UserOutlined />} style={{ background: 'var(--c-accent)' }} />
            {displayName}
          </Space>
        );
      },
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (val) => val || '-',
    },
    {
      title: 'Mobile',
      dataIndex: 'mobile',
      key: 'mobile',
      render: (val) => formatMobile(val),
    },
    {
      title: 'Assigned Date',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      sorter: true,
      render: (val, record) => formatDate(val || record.created_at),
    },
  ];

  // Stage tags for stats
  const renderStageTags = () => {
    const stages = stats.leads_per_stage || stats.stages || {};
    if (typeof stages === 'object' && !Array.isArray(stages)) {
      return Object.entries(stages).map(([stage, count]) => (
        <Tag key={stage} color="var(--c-accent)" style={{ marginBottom: 4 }}>
          {stage}: {count}
        </Tag>
      ));
    }
    if (Array.isArray(stages)) {
      return stages.map((s) => (
        <Tag key={s.name || s.stage} color="var(--c-accent)" style={{ marginBottom: 4 }}>
          {s.name || s.stage}: {s.count || 0}
        </Tag>
      ));
    }
    return <Text type="secondary">No stage data</Text>;
  };

  // Existing agent IDs to filter from add agent dropdown
  const existingAgentIds = campaignAgents.map(
    (a) => a.id || a.user_id || a.agent_id
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Campaign not found" />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={() => navigate('/campaigns')}>Back to Campaigns</Button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[campaign.status] || { color: '#8c8c8c', text: campaign.status || 'Unknown' };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/campaigns')}
          style={{ marginBottom: 8, color: 'var(--c-accent)' }}
        >
          Back to Campaigns
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Space align="center" size={16}>
              <Title level={3} style={{ margin: 0, color: 'var(--c-accent)' }}>
                {campaign.name}
              </Title>
              {campaign.pipeline?.name || campaign.pipeline_name ? (
                <Tag color="var(--c-accent)">{campaign.pipeline?.name || campaign.pipeline_name}</Tag>
              ) : null}
              <Badge color={statusInfo.color} text={statusInfo.text} />
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">
                Manager: {campaign.manager?.name || campaign.manager_name || '-'}
              </Text>
            </div>
          </div>
          <Space>
            <Button
              icon={campaign.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handlePauseResume}
            >
              {campaign.status === 'active' ? 'Pause' : 'Resume'}
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/campaigns?edit=${campaign.id}`)}
              style={{ color: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
            >
              Edit Settings
            </Button>
          </Space>
        </div>
      </div>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid var(--c-accent)' }}>
            <Statistic
              title="Total Leads"
              value={stats.total_leads ?? stats.lead_count ?? 0}
              prefix={<FileTextOutlined style={{ color: 'var(--c-accent)' }} />}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid var(--c-accent)' }}>
            <Spin spinning={statsLoading}>
              <Text type="secondary" style={{ fontSize: 14 }}>Leads per Stage</Text>
              <div style={{ marginTop: 8 }}>{renderStageTags()}</div>
            </Spin>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="Agents Assigned"
              value={stats.agent_count ?? stats.agents_assigned ?? campaign.agent_count ?? 0}
              prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid #fa8c16' }}>
            <Statistic
              title="Leads Called Today"
              value={stats.leads_called_today ?? 0}
              prefix={<PhoneOutlined style={{ color: '#fa8c16' }} />}
              loading={statsLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'leads',
            label: (
              <span><FileTextOutlined /> Leads</span>
            ),
            children: (
              <Table
                rowKey={(r) => r.id || r.lead_id || Math.random()}
                columns={leadsColumns}
                dataSource={leads}
                loading={leadsLoading}
                pagination={{
                  current: leadsPage,
                  pageSize: leadsPageSize,
                  total: leadsTotal,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '25', '50', '100'],
                  showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} leads`,
                  onChange: (p, ps) => {
                    setLeadsPage(p);
                    setLeadsPageSize(ps);
                  },
                }}
                scroll={{ x: 900 }}
              />
            ),
          },
          {
            key: 'agents',
            label: (
              <span><TeamOutlined /> Agents</span>
            ),
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      fetchAllAgents();
                      setAddAgentModal(true);
                    }}
                    style={{ background: 'var(--c-accent)' }}
                  >
                    Add Agent
                  </Button>
                </div>
                <Table
                  rowKey={(r) => r.id || r.user_id || r.agent_id || Math.random()}
                  columns={agentsColumns}
                  dataSource={campaignAgents}
                  loading={agentsLoading}
                  pagination={{
                    current: agentsPage,
                    pageSize: agentsPageSize,
                    total: agentsTotal,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '25', '50', '100'],
                    showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} agents`,
                    onChange: (p, ps) => {
                      setAgentsPage(p);
                      setAgentsPageSize(ps);
                    },
                  }}
                  scroll={{ x: 700 }}
                />
              </>
            ),
          },
          {
            key: 'settings',
            label: (
              <span><SettingOutlined /> Settings</span>
            ),
            children: (
              <Card style={{ maxWidth: 700 }}>
                <Descriptions
                  column={{ xs: 1, sm: 2 }}
                  bordered
                  size="small"
                  title={
                    <span style={{ color: 'var(--c-accent)' }}>Campaign Settings</span>
                  }
                  extra={
                    <Button
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => navigate(`/campaigns?edit=${campaign.id}`)}
                    >
                      Edit
                    </Button>
                  }
                >
                  <Descriptions.Item label="Campaign Name">{campaign.name}</Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Badge color={statusInfo.color} text={statusInfo.text} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Pipeline">
                    <Tag color="var(--c-accent)">{campaign.pipeline?.name || campaign.pipeline_name || '-'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Manager">
                    {campaign.manager?.name || campaign.manager_name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Description" span={2}>
                    {campaign.description || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Lead Distribution">
                    <Tag color="var(--c-accent)">
                      {DISTRIBUTION_LABELS[campaign.distribution_type] || campaign.distribution_type || 'Not Set'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Duplicacy Handling">
                    <Tag>
                      {DUPLICACY_LABELS[campaign.duplicacy] || campaign.duplicacy || 'Not Set'}
                    </Tag>
                  </Descriptions.Item>
                  {campaign.distribution_type === 'conditional' && campaign.conditional_rules?.length > 0 && (
                    <Descriptions.Item label="Conditional Rules" span={2}>
                      {campaign.conditional_rules.map((rule, idx) => (
                        <Tag key={idx} style={{ marginBottom: 4 }}>
                          {rule.field} {rule.operator} "{rule.value}" → Agent #{rule.assign_to}
                        </Tag>
                      ))}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="Created">
                    {formatDate(campaign.created_at)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Updated">
                    {formatDate(campaign.updated_at)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'engagement',
            label: (
              <span><FormOutlined /> Engagement Form</span>
            ),
            children: (
              <Spin spinning={formLoading}>
                {engagementForm ? (
                  <Card style={{ maxWidth: 700 }}>
                    <Title level={5} style={{ color: 'var(--c-accent)' }}>
                      {engagementForm.name || engagementForm.title || 'Engagement Form'}
                    </Title>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Form Name">
                        {engagementForm.name || engagementForm.title || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Badge
                          color={engagementForm.status === 'active' ? '#52c41a' : '#8c8c8c'}
                          text={engagementForm.status || 'Draft'}
                        />
                      </Descriptions.Item>
                      <Descriptions.Item label="Fields">
                        {engagementForm.fields?.length || engagementForm.field_count || 0} field(s)
                      </Descriptions.Item>
                      <Descriptions.Item label="Created">
                        {formatDate(engagementForm.created_at)}
                      </Descriptions.Item>
                    </Descriptions>
                    {engagementForm.fields && Array.isArray(engagementForm.fields) && (
                      <div style={{ marginTop: 16 }}>
                        <Text strong style={{ marginBottom: 8, display: 'block' }}>Form Fields:</Text>
                        {engagementForm.fields.map((field, idx) => (
                          <Tag key={idx} style={{ marginBottom: 4 }}>
                            {field.label || field.name || `Field ${idx + 1}`} ({field.type || 'text'})
                          </Tag>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => navigate(`/form-builder/${id}`)}
                        style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
                      >
                        Edit Form
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Card style={{ maxWidth: 500, textAlign: 'center', margin: '0 auto', padding: 40 }}>
                    <FormOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
                    <Title level={5} type="secondary">No Engagement Form</Title>
                    <Paragraph type="secondary">
                      Create an engagement form to collect lead information for this campaign.
                    </Paragraph>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => navigate(`/form-builder/${id}`)}
                      style={{ background: 'var(--c-accent)' }}
                    >
                      Create Form
                    </Button>
                  </Card>
                )}
              </Spin>
            ),
          },
          {
            key: 'activity',
            label: (
              <span><ClockCircleOutlined /> Activity Log</span>
            ),
            children: (
              <Spin spinning={activitiesLoading}>
                {activities.length > 0 ? (
                  <Timeline
                    style={{ maxWidth: 700, marginTop: 8 }}
                    items={activities.map((act) => ({
                      color: act.type === 'create' ? '#52c41a' : act.type === 'delete' ? '#f5222d' : 'var(--c-accent)',
                      children: (
                        <div>
                          <Text strong>{act.title || act.action || 'Activity'}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {act.description || act.message || ''}
                          </Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {act.user_name || act.performed_by || ''} · {formatDate(act.created_at || act.timestamp)}
                          </Text>
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Card style={{ maxWidth: 500, textAlign: 'center', margin: '0 auto' }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No activity recorded yet"
                    />
                    <List
                      size="small"
                      style={{ marginTop: 16, textAlign: 'left' }}
                      header={<Text type="secondary">Recent activities will appear here, such as:</Text>}
                      dataSource={[
                        'Campaign created',
                        'Agent assigned or removed',
                        'Lead distribution updated',
                        'Campaign paused or resumed',
                        'Settings modified',
                      ]}
                      renderItem={(item) => (
                        <List.Item style={{ padding: '4px 0', borderBottom: 'none' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>• {item}</Text>
                        </List.Item>
                      )}
                    />
                  </Card>
                )}
              </Spin>
            ),
          },
        ]}
      />

      {/* Add Agent Modal */}
      <Modal
        title={<span style={{ color: 'var(--c-accent)' }}>Add Agents to Campaign</span>}
        open={addAgentModal}
        onCancel={() => {
          setAddAgentModal(false);
          setSelectedNewAgents([]);
        }}
        onOk={handleAddAgents}
        confirmLoading={addingAgents}
        okText="Add Agents"
        okButtonProps={{ disabled: addingAgents || !selectedNewAgents.length, style: { background: 'var(--c-accent)' } }}
      >
        <Select
          mode="multiple"
          placeholder="Select agents to add"
          value={selectedNewAgents}
          onChange={setSelectedNewAgents}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) =>
            (option?.children || '').toLowerCase().includes(input.toLowerCase())
          }
        >
          {allAgents
            .filter((a) => !existingAgentIds.includes(a.id))
            .map((a) => (
              <Option key={a.id} value={a.id}>
                {a.name || a.full_name || `${a.first_name || ''} ${a.last_name || ''}`.trim()}
              </Option>
            ))}
        </Select>
      </Modal>
    </div>
  );
};

export default CampaignDetail;
