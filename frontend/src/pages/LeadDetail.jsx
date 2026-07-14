import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Descriptions, Button, Tabs, Table, Timeline, Tag, Space,
  Form, Select, DatePicker, Input, message, Spin, Typography, Popconfirm, Divider, List,
} from 'antd';
import {
  EditOutlined, UserSwitchOutlined, PhoneOutlined, WhatsAppOutlined,
  MailOutlined, CalendarOutlined, ArrowLeftOutlined, CheckCircleOutlined,
  ClockCircleOutlined, MessageOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import { formatMobile, formatDate, formatDateTime, formatCurrency, timeAgo } from '../utils/formatters';
import { FOLLOWUP_TYPES, LEAD_STATUSES, PRIORITIES, PRIORITY_COLORS } from '../utils/constants';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followups, setFollowups] = useState([]);
  const [followupForm] = Form.useForm();
  const [followupLoading, setFollowupLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leads/${id}`);
      // Backend returns: { success, data: lead } where lead includes followups
      const leadData = res.data?.data || res.data?.lead || res.data;
      setLead(leadData);
      setFollowups(leadData?.Followups || leadData?.followups || []);

      // Also try to fetch followups separately
      try {
        const fRes = await api.get('/followups', { params: { lead_id: id } });
        const fResponseData = fRes.data?.data || fRes.data;
        const fData = fResponseData?.rows || fResponseData?.followups || (Array.isArray(fResponseData) ? fResponseData : []);
        if (fData.length > 0) setFollowups(fData);
      } catch { /* followups might be embedded in lead */ }
    } catch (err) {
      message.error('Failed to load lead details');
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    try {
      await api.post(`/leads/convert/${id}`);
      message.success('Lead converted to customer successfully!');
      fetchLead();
    } catch (err) {
      message.error(err.response?.data?.message || 'Conversion failed');
    }
  };

  const handleQuickFollowup = async () => {
    try {
      const values = await followupForm.validateFields();
      setFollowupLoading(true);
      await api.post('/followups', {
        lead_id: id,
        type: values.type,
        scheduled_at: values.scheduled_at.toISOString(),
        notes: values.notes || '',
      });
      message.success('Follow-up scheduled!');
      followupForm.resetFields();
      followupForm.setFieldsValue({ scheduled_at: dayjs().add(1, 'hour').startOf('hour') });
      fetchLead();
    } catch (err) {
      if (err.response) message.error(err.response.data?.message || 'Failed');
    } finally {
      setFollowupLoading(false);
    }
  };

  const handleMarkDone = async (followupId) => {
    try {
      await api.put(`/followups/${followupId}`, { status: 'Completed', outcome: 'Completed' });
      message.success('Follow-up marked as done');
      fetchLead();
    } catch {
      message.error('Failed to update');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!lead) return null;

  const mobile = lead.mobile ? lead.mobile.replace(/\D/g, '') : '';
  const whatsappNumber = mobile.length === 10 ? `91${mobile}` : mobile;

  // Follow-up columns
  const followupColumns = [
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag color="blue">{t}</Tag> },
    { title: 'Scheduled At', dataIndex: 'scheduled_at', key: 'scheduled_at', render: (d) => formatDateTime(d) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <StatusBadge status={s || 'Pending'} /> },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true },
    { title: 'Outcome', dataIndex: 'outcome', key: 'outcome', render: (o) => o || '-' },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => record.status !== 'Completed' ? (
        <Button
          size="small"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => handleMarkDone(record._id || record.id)}
        >
          Done
        </Button>
      ) : <Tag color="green">Done</Tag>,
    },
  ];

  // Upcoming followups (not completed)
  const upcomingFollowups = followups
    .filter((f) => f.status !== 'Completed' && f.status !== 'Cancelled')
    .sort((a, b) => dayjs(a.scheduled_at).unix() - dayjs(b.scheduled_at).unix());

  return (
    <div className="fade-in">
      {/* Back button + Title */}
      <Space style={{ marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/leads')}>Back to Leads</Button>
        <Title level={4} style={{ margin: 0 }}>{lead.name}</Title>
        <StatusBadge status={lead.status} />
        {lead.priority && (
          <Tag color={PRIORITY_COLORS[lead.priority]} style={{ border: 'none', fontWeight: 600 }}>
            {lead.priority}
          </Tag>
        )}
      </Space>

      <Row gutter={24}>
        {/* Left Column: Lead Info */}
        <Col xs={24} lg={16}>
          <Card
            bordered={false}
            style={{ marginBottom: 20 }}
            extra={
              <Space>
                <Button icon={<EditOutlined />} onClick={() => navigate(`/leads`, { state: { editLead: lead } })}>
                  Edit
                </Button>
                {lead.status !== 'Closed Won' && (
                  <Popconfirm title="Convert this lead to a customer?" onConfirm={handleConvert} okText="Convert">
                    <Button type="primary" icon={<UserSwitchOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                      Convert to Customer
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            }
          >
            <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered size="small">
              <Descriptions.Item label="Full Name">{lead.name}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{formatMobile(lead.mobile)}</Descriptions.Item>
              <Descriptions.Item label="Email">{lead.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Age">{lead.age || '-'}</Descriptions.Item>
              <Descriptions.Item label="Gender">{lead.gender || '-'}</Descriptions.Item>
              <Descriptions.Item label="Occupation">{lead.occupation || '-'}</Descriptions.Item>
              <Descriptions.Item label="City">{lead.city || '-'}</Descriptions.Item>
              <Descriptions.Item label="Source">
                {lead.source ? <Tag>{lead.source}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Insurance Interest">
                {Array.isArray(lead.insurance_interest)
                  ? lead.insurance_interest.map((i) => <Tag key={i} color="blue">{i}</Tag>)
                  : lead.insurance_interest || lead.insuranceInterest || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Assigned To">
                {lead.assigned_to_name || lead.assignedTo?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {formatDate(lead.createdAt || lead.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {formatDateTime(lead.updatedAt || lead.updated_at)}
              </Descriptions.Item>
              {lead.notes && (
                <Descriptions.Item label="Notes" span={2}>{lead.notes}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Tabs */}
          <Card bordered={false}>
            <Tabs defaultActiveKey="followups">
              <TabPane tab={<span><CalendarOutlined /> Follow-up History</span>} key="followups">
                <Table
                  columns={followupColumns}
                  dataSource={followups}
                  rowKey={(r) => r._id || r.id || Math.random()}
                  pagination={{ pageSize: 10 }}
                  size="small"
                  className="premium-table"
                />
              </TabPane>
              <TabPane tab={<span><ClockCircleOutlined /> Communication Log</span>} key="comms">
                {followups.length > 0 ? (
                  <Timeline
                    items={followups.map((f) => ({
                      color: f.status === 'Completed' ? 'green' : 'blue',
                      children: (
                        <div>
                          <Text strong>{f.type}</Text>
                          <Text type="secondary" style={{ marginLeft: 8 }}>{formatDateTime(f.scheduled_at)}</Text>
                          {f.notes && <div style={{ marginTop: 4 }}><Text type="secondary">{f.notes}</Text></div>}
                          {f.outcome && <div><Tag color="green" style={{ marginTop: 4 }}>{f.outcome}</Tag></div>}
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>No communication history</div>
                )}
              </TabPane>
              <TabPane tab={<span><MessageOutlined /> Notes</span>} key="notes">
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, minHeight: 100 }}>
                  {lead.notes || 'No notes added for this lead.'}
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>

        {/* Right Column: Quick Actions */}
        <Col xs={24} lg={8}>
          {/* Quick Follow-up */}
          <Card
            title={<span><CalendarOutlined style={{ marginRight: 8 }} />Quick Follow-up</span>}
            bordered={false}
            style={{ marginBottom: 20 }}
          >
            <Form form={followupForm} layout="vertical" initialValues={{ scheduled_at: dayjs().add(1, 'hour').startOf('hour') }}>
              <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Select type' }]}>
                <Select placeholder="Select type">
                  {FOLLOWUP_TYPES.map((t) => (
                    <Option key={t} value={t}>{t}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="scheduled_at" label="Date & Time" rules={[{ required: true }]}>
                <DatePicker
                  showTime={{ format: 'hh:mm A', use12Hours: true }}
                  format="DD MMM YYYY, hh:mm A"
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Quick notes..." />
              </Form.Item>
              <Button
                type="primary"
                block
                loading={followupLoading}
                onClick={handleQuickFollowup}
                icon={<CalendarOutlined />}
              >
                Schedule Follow-up
              </Button>
            </Form>
          </Card>

          {/* Upcoming Follow-ups */}
          {upcomingFollowups.length > 0 && (
            <Card
              title="Upcoming Follow-ups"
              bordered={false}
              style={{ marginBottom: 20 }}
              size="small"
            >
              <List
                dataSource={upcomingFollowups.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item
                    extra={
                      <Button
                        size="small"
                        type="link"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleMarkDone(item._id || item.id)}
                      />
                    }
                  >
                    <List.Item.Meta
                      title={<Space><Tag color="blue">{item.type}</Tag> <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(item.scheduled_at)}</Text></Space>}
                      description={item.notes}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* Quick Action Buttons */}
          <Card title="Quick Actions" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {lead.mobile && (
                <>
                  <Button
                    block
                    icon={<WhatsAppOutlined />}
                    style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
                    onClick={() => window.open(`https://wa.me/${whatsappNumber}`, '_blank')}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    block
                    icon={<PhoneOutlined />}
                    onClick={() => window.open(`tel:${lead.mobile}`, '_self')}
                  >
                    Call
                  </Button>
                </>
              )}
              {lead.email && (
                <Button
                  block
                  icon={<MailOutlined />}
                  onClick={() => window.open(`mailto:${lead.email}`, '_self')}
                >
                  Email
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LeadDetail;
