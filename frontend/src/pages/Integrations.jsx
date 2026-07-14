import React, { useState, useCallback, useEffect } from 'react';
import {
  Row, Col, Card, Button, Modal, Form, Input, Select, Switch, Tag, Badge,
  Table, Typography, Space, Tooltip, message, Spin, Divider, Empty
} from 'antd';
import {
  FacebookOutlined, FileExcelOutlined, ApiOutlined, SyncOutlined,
  LinkOutlined, CheckCircleFilled, CloseCircleFilled, CopyOutlined,
  SettingOutlined, HistoryOutlined, DisconnectOutlined, CloudSyncOutlined
} from '@ant-design/icons';
import api from '../api/axios';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const NAVY = 'var(--c-accent)';
const SKY_BLUE = 'var(--c-accent)';

const PLATFORMS = [
  { key: 'facebook', name: 'Facebook Lead Ads', icon: <FacebookOutlined style={{ fontSize: 32, color: '#1877F2' }} />, type: 'facebook' },
  { key: 'google_sheets', name: 'Google Sheets', icon: <FileExcelOutlined style={{ fontSize: 32, color: '#0F9D58' }} />, type: 'google_sheets' },
  { key: 'justdial', name: 'JustDial', icon: null, type: 'justdial', textLogo: 'JD' },
  { key: 'indiamart', name: 'IndiaMart', icon: null, type: 'indiamart', textLogo: 'IM' },
  { key: 'magicbricks', name: 'MagicBricks', icon: null, type: 'magicbricks', textLogo: 'MB' },
  { key: '99acres', name: '99acres', icon: null, type: '99acres', textLogo: '99' },
  { key: 'housing', name: 'Housing.com', icon: null, type: 'housing', textLogo: 'H' },
  { key: 'webhook', name: 'Generic Webhook', icon: <ApiOutlined style={{ fontSize: 32, color: SKY_BLUE }} />, type: 'webhook' },
];

const Integrations = () => {
  const [integrations, setIntegrations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState({});
  const [form] = Form.useForm();

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/integrations');
      const data = res.data?.data || res.data;
      setIntegrations(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/campaigns');
      const data = res.data?.data || res.data;
      setCampaigns(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    fetchCampaigns();
  }, [fetchIntegrations, fetchCampaigns]);

  const getConnectionStatus = useCallback((platformKey) => {
    return integrations.find(
      (i) => i.platform === platformKey || i.type === platformKey || i.key === platformKey
    );
  }, [integrations]);

  const handleConnect = (platform) => {
    setSelectedPlatform(platform);
    const existing = getConnectionStatus(platform.key);
    if (existing) {
      form.setFieldsValue({
        campaign_id: existing.campaign_id,
        api_key: existing.api_key,
        api_secret: existing.api_secret,
        access_token: existing.access_token,
        page_id: existing.page_id,
        sheet_url: existing.sheet_url,
      });
    } else {
      form.resetFields();
    }
    setConnectModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.post('/integrations', {
        platform: selectedPlatform.key,
        type: selectedPlatform.type,
        ...values,
      });
      message.success(`${selectedPlatform.name} connected successfully`);
      setConnectModalOpen(false);
      form.resetFields();
      fetchIntegrations();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (integration) => {
    const id = integration.id;
    setSyncing((prev) => ({ ...prev, [id]: true }));
    try {
      await api.post(`/integrations/${id}/sync`);
      message.success('Sync initiated successfully');
      fetchIntegrations();
    } catch {
      message.error('Sync failed');
    } finally {
      setSyncing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleViewLogs = async (integration) => {
    setSelectedIntegration(integration);
    setLogsModalOpen(true);
    setLogsLoading(true);
    try {
      const res = await api.get(`/integrations/${integration.id}/logs`);
      const data = res.data?.data || res.data;
      setLogs(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleToggle = async (integration, checked) => {
    try {
      await api.put(`/integrations/${integration.id}`, { is_active: checked });
      message.success(`Integration ${checked ? 'activated' : 'deactivated'}`);
      fetchIntegrations();
    } catch {
      message.error('Failed to update integration');
    }
  };

  const webhookUrl = selectedPlatform?.type === 'webhook'
    ? `${window.location.origin}/api/webhook/${selectedPlatform.key}/${Date.now()}`
    : '';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    message.success('Webhook URL copied to clipboard');
  };

  const renderFormFields = () => {
    if (!selectedPlatform) return null;
    switch (selectedPlatform.type) {
      case 'facebook':
        return (
          <>
            <Form.Item name="page_id" label="FB Page ID" rules={[{ required: true, message: 'Enter FB Page ID' }]}>
              <Input placeholder="Enter Facebook Page ID" />
            </Form.Item>
            <Form.Item name="access_token" label="Access Token" rules={[{ required: true, message: 'Enter Access Token' }]}>
              <Input.Password placeholder="Enter Access Token" />
            </Form.Item>
          </>
        );
      case 'google_sheets':
        return (
          <Form.Item name="sheet_url" label="Sheet URL" rules={[{ required: true, message: 'Enter Sheet URL' }]}>
            <Input placeholder="https://docs.google.com/spreadsheets/d/..." />
          </Form.Item>
        );
      case 'justdial':
        return (
          <>
            <Form.Item name="api_key" label="API Key" rules={[{ required: true, message: 'Enter API Key' }]}>
              <Input placeholder="Enter JustDial API Key" />
            </Form.Item>
            <Form.Item name="api_secret" label="API Secret" rules={[{ required: true, message: 'Enter API Secret' }]}>
              <Input.Password placeholder="Enter API Secret" />
            </Form.Item>
          </>
        );
      case 'indiamart':
        return (
          <Form.Item name="api_key" label="CRM API Key" rules={[{ required: true, message: 'Enter CRM API Key' }]}>
            <Input placeholder="Enter IndiaMart CRM API Key" />
          </Form.Item>
        );
      case 'magicbricks':
      case '99acres':
      case 'housing':
        return (
          <>
            <Form.Item name="api_key" label="API Key" rules={[{ required: true, message: 'Enter API Key' }]}>
              <Input placeholder="Enter API Key" />
            </Form.Item>
            <Form.Item name="api_secret" label="API Secret">
              <Input.Password placeholder="Enter API Secret (if applicable)" />
            </Form.Item>
          </>
        );
      case 'webhook':
        return (
          <Form.Item label="Webhook URL">
            <Input.Group compact>
              <Input
                style={{ width: 'calc(100% - 40px)' }}
                value={webhookUrl}
                readOnly
              />
              <Tooltip title="Copy URL">
                <Button icon={<CopyOutlined />} onClick={copyWebhookUrl} />
              </Tooltip>
            </Input.Group>
          </Form.Item>
        );
      default:
        return (
          <Form.Item name="api_key" label="API Key" rules={[{ required: true, message: 'Enter API Key' }]}>
            <Input placeholder="Enter API Key" />
          </Form.Item>
        );
    }
  };

  const connectedIntegrations = integrations.filter((i) => i.is_active !== false);

  const logColumns = [
    { title: 'Timestamp', dataIndex: 'created_at', key: 'created_at', render: (v) => v ? dayjs(v).format('DD MMM YYYY HH:mm:ss') : '-', sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix() },
    { title: 'Action', dataIndex: 'action', key: 'action' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'success' ? 'green' : v === 'error' ? 'red' : 'blue'}>{v || 'N/A'}</Tag> },
    { title: 'Records', dataIndex: 'records_count', key: 'records_count', render: (v) => v ?? '-' },
    { title: 'Message', dataIndex: 'message', key: 'message', ellipsis: true },
  ];

  const renderTextLogo = (text) => (
    <div style={{
      width: 48, height: 48, borderRadius: 8, background: 'var(--c-accent-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontWeight: 700, fontSize: 16
    }}>
      {text}
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ color: NAVY, marginBottom: 24 }}>
        <LinkOutlined style={{ marginRight: 8 }} />
        Integrations
      </Title>

      <Spin spinning={loading}>
        {/* Platform Cards Grid */}
        <Card title={<Text strong style={{ color: NAVY }}>Available Platforms</Text>} style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {PLATFORMS.map((platform) => {
              const connected = getConnectionStatus(platform.key);
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={platform.key}>
                  <Card
                    hoverable
                    style={{ textAlign: 'center', borderColor: connected ? '#52c41a' : '#d9d9d9', borderWidth: 2 }}
                    bodyStyle={{ padding: 20 }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      {platform.icon || renderTextLogo(platform.textLogo)}
                    </div>
                    <Title level={5} style={{ margin: '8px 0' }}>{platform.name}</Title>
                    <div style={{ marginBottom: 12 }}>
                      {connected ? (
                        <Badge status="success" text={<Text type="success">Connected</Text>} />
                      ) : (
                        <Badge status="default" text={<Text type="secondary">Not Connected</Text>} />
                      )}
                    </div>
                    <Button
                      type={connected ? 'default' : 'primary'}
                      icon={connected ? <SettingOutlined /> : <LinkOutlined />}
                      onClick={() => handleConnect(platform)}
                      style={connected ? {} : { background: SKY_BLUE, borderColor: SKY_BLUE }}
                      block
                    >
                      {connected ? 'Configure' : 'Connect'}
                    </Button>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>

        {/* Connected Integrations Section */}
        {connectedIntegrations.length > 0 && (
          <Card title={<Text strong style={{ color: NAVY }}>Connected Integrations</Text>}>
            <Row gutter={[16, 16]}>
              {connectedIntegrations.map((integration) => {
                const platformInfo = PLATFORMS.find((p) => p.key === integration.platform || p.key === integration.type) || {};
                return (
                  <Col xs={24} sm={12} md={8} key={integration.id}>
                    <Card
                      size="small"
                      style={{ borderLeft: `4px solid #52c41a` }}
                      actions={[
                        <Tooltip title="Sync Now" key="sync">
                          <Button
                            type="text"
                            icon={<SyncOutlined spin={syncing[integration.id]} />}
                            onClick={() => handleSync(integration)}
                            loading={syncing[integration.id]}
                          >
                            Sync
                          </Button>
                        </Tooltip>,
                        <Tooltip title="View Logs" key="logs">
                          <Button type="text" icon={<HistoryOutlined />} onClick={() => handleViewLogs(integration)}>
                            Logs
                          </Button>
                        </Tooltip>,
                      ]}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          {platformInfo.icon || (platformInfo.textLogo && renderTextLogo(platformInfo.textLogo))}
                          <div>
                            <Text strong>{platformInfo.name || integration.platform}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Last Synced: {integration.last_synced_at ? dayjs(integration.last_synced_at).format('DD MMM YYYY HH:mm') : 'Never'}
                            </Text>
                          </div>
                        </Space>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Total Leads: <Text strong>{integration.total_leads_pulled ?? 0}</Text>
                          </Text>
                          <Switch
                            checked={integration.is_active !== false}
                            onChange={(checked) => handleToggle(integration, checked)}
                            checkedChildren="Active"
                            unCheckedChildren="Inactive"
                            size="small"
                          />
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>
        )}
      </Spin>

      {/* Connect Modal */}
      <Modal
        title={
          <Space>
            {selectedPlatform?.icon || (selectedPlatform?.textLogo && renderTextLogo(selectedPlatform?.textLogo))}
            <span>Connect {selectedPlatform?.name}</span>
          </Space>
        }
        open={connectModalOpen}
        onCancel={() => { setConnectModalOpen(false); form.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setConnectModalOpen(false); form.resetFields(); }}>Cancel</Button>,
          <Button key="save" type="primary" loading={saving} onClick={handleSave} style={{ background: SKY_BLUE, borderColor: SKY_BLUE }}>
            Save & Connect
          </Button>,
        ]}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {renderFormFields()}
          <Form.Item name="campaign_id" label="Target Campaign">
            <Select placeholder="Select a campaign" allowClear showSearch optionFilterProp="children">
              {campaigns.map((c) => (
                <Option key={c.id} value={c.id}>{c.name || c.title}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Logs Modal */}
      <Modal
        title={`Integration Logs - ${selectedIntegration?.platform || ''}`}
        open={logsModalOpen}
        onCancel={() => setLogsModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Table
          columns={logColumns}
          dataSource={logs}
          loading={logsLoading}
          rowKey={(r) => r.id || r.created_at}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'] }}
          locale={{ emptyText: <Empty description="No logs found" /> }}
        />
      </Modal>
    </div>
  );
};

export default Integrations;
