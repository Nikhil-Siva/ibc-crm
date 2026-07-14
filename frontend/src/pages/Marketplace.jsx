import React, { useState, useCallback, useEffect } from 'react';
import {
  Row, Col, Card, Button, Modal, Form, Input, Select, Tabs, Tag, Typography,
  Space, message, Spin, Badge, Empty, Tooltip, Divider, Result
} from 'antd';
import {
  PhoneOutlined, MessageOutlined, ApiOutlined, CloudOutlined,
  LinkOutlined, DisconnectOutlined, CheckCircleFilled, SettingOutlined,
  GlobalOutlined, ThunderboltOutlined, SafetyOutlined, ExperimentOutlined
} from '@ant-design/icons';
import api from '../api/axios';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const NAVY = 'var(--c-accent)';
const SKY_BLUE = 'var(--c-accent)';

const CATEGORIES = [
  { key: 'cloud_telephony', label: 'Cloud Telephony', icon: <PhoneOutlined /> },
  { key: 'softphone', label: 'Softphone', icon: <CloudOutlined /> },
  { key: 'bulk_sms', label: 'Bulk SMS', icon: <MessageOutlined /> },
  { key: 'bulk_whatsapp', label: 'Bulk WhatsApp', icon: <MessageOutlined style={{ color: '#25D366' }} /> },
];

const DEFAULT_PROVIDERS = {
  cloud_telephony: [
    { id: 'ct_1', name: 'Exotel', description: 'Cloud telephony platform for call center solutions with IVR, call tracking and analytics.', category: 'cloud_telephony', website: 'https://exotel.com', fields: ['api_key', 'api_secret', 'subdomain'] },
    { id: 'ct_2', name: 'Knowlarity', description: 'Smart cloud communication platform with virtual numbers and call management.', category: 'cloud_telephony', website: 'https://knowlarity.com', fields: ['api_key', 'api_secret'] },
    { id: 'ct_3', name: 'MyOperator', description: 'Cloud-based call management system with IVR, call routing and analytics.', category: 'cloud_telephony', website: 'https://myoperator.com', fields: ['api_key', 'api_secret'] },
    { id: 'ct_4', name: 'Ozonetel', description: 'Enterprise-grade cloud communication platform with omnichannel capabilities.', category: 'cloud_telephony', website: 'https://ozonetel.com', fields: ['api_key', 'api_secret', 'username'] },
  ],
  softphone: [
    { id: 'sp_1', name: 'Twilio', description: 'Programmable voice, SMS, and video cloud communications platform.', category: 'softphone', website: 'https://twilio.com', fields: ['account_sid', 'auth_token'] },
    { id: 'sp_2', name: 'Asterisk', description: 'Open source PBX platform for building communications applications.', category: 'softphone', website: 'https://asterisk.org', fields: ['server_url', 'username', 'password'] },
    { id: 'sp_3', name: 'Zoiper', description: 'Cross-platform VoIP softphone for SIP and IAX protocol support.', category: 'softphone', website: 'https://zoiper.com', fields: ['sip_server', 'username', 'password'] },
  ],
  bulk_sms: [
    { id: 'sms_1', name: 'MSG91', description: 'Bulk SMS and transactional messaging platform with template management.', category: 'bulk_sms', website: 'https://msg91.com', fields: ['api_key', 'sender_id'] },
    { id: 'sms_2', name: 'Textlocal', description: 'SMS marketing and communication platform for businesses in India.', category: 'bulk_sms', website: 'https://textlocal.in', fields: ['api_key', 'sender_id'] },
    { id: 'sms_3', name: 'Kaleyra', description: 'Cloud-based business messaging platform for SMS, voice and WhatsApp.', category: 'bulk_sms', website: 'https://kaleyra.com', fields: ['api_key', 'api_secret', 'sender_id'] },
  ],
  bulk_whatsapp: [
    { id: 'wa_1', name: 'WhatsApp Business API', description: 'Official WhatsApp Business API for transactional and promotional messaging.', category: 'bulk_whatsapp', website: 'https://business.whatsapp.com', fields: ['api_key', 'phone_number_id', 'waba_id'] },
    { id: 'wa_2', name: 'Gupshup', description: 'Conversational messaging platform with WhatsApp Business API integration.', category: 'bulk_whatsapp', website: 'https://gupshup.io', fields: ['api_key', 'app_name'] },
    { id: 'wa_3', name: 'Wati', description: 'WhatsApp Business API solution with chatbot builder and team inbox.', category: 'bulk_whatsapp', website: 'https://wati.io', fields: ['api_key', 'api_secret'] },
  ],
};

const FIELD_LABELS = {
  api_key: 'API Key',
  api_secret: 'API Secret',
  sender_id: 'Sender ID',
  subdomain: 'Subdomain',
  username: 'Username',
  password: 'Password',
  account_sid: 'Account SID',
  auth_token: 'Auth Token',
  server_url: 'Server URL',
  sip_server: 'SIP Server',
  phone_number_id: 'Phone Number ID',
  waba_id: 'WABA ID',
  app_name: 'App Name',
};

const CATEGORY_COLORS = {
  cloud_telephony: 'blue',
  softphone: 'purple',
  bulk_sms: 'orange',
  bulk_whatsapp: 'green',
};

const Marketplace = () => {
  const [activeCategory, setActiveCategory] = useState('cloud_telephony');
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [connectedProviders, setConnectedProviders] = useState({});
  const [loading, setLoading] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [form] = Form.useForm();

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketplace', { params: { category: activeCategory } });
      const data = res.data?.data || res.data;
      if (Array.isArray(data) && data.length > 0) {
        setProviders((prev) => ({ ...prev, [activeCategory]: data }));
      }
    } catch {
      // Use default providers on error
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  const fetchConnected = useCallback(async () => {
    try {
      const res = await api.get('/marketplace/connected');
      const data = res.data?.data || res.data;
      const map = {};
      (Array.isArray(data) ? data : (data?.rows || [])).forEach((c) => {
        map[c.provider_id || c.id] = c;
      });
      setConnectedProviders(map);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    fetchConnected();
  }, [fetchConnected]);

  const handleConnect = (provider) => {
    setSelectedProvider(provider);
    setTestResult(null);
    form.resetFields();
    const existing = connectedProviders[provider.id];
    if (existing) {
      const vals = {};
      (provider.fields || []).forEach((f) => {
        if (existing[f]) vals[f] = existing[f];
      });
      form.setFieldsValue(vals);
    }
    setConnectModalOpen(true);
  };

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);
      const res = await api.post(`/marketplace/test/${selectedProvider.id}`, values);
      const data = res.data?.data || res.data;
      setTestResult({ success: true, message: data?.message || 'Connection successful!' });
      message.success('Connection test passed');
    } catch (err) {
      if (err?.errorFields) return;
      setTestResult({ success: false, message: err?.response?.data?.message || 'Connection test failed' });
      message.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.post('/marketplace/connect', {
        provider_id: selectedProvider.id,
        provider_name: selectedProvider.name,
        category: selectedProvider.category,
        ...values,
      });
      message.success(`${selectedProvider.name} connected successfully`);
      setConnectModalOpen(false);
      form.resetFields();
      fetchConnected();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to connect provider');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (provider) => {
    const connection = connectedProviders[provider.id];
    if (!connection) return;
    try {
      await api.delete(`/marketplace/disconnect/${connection.id || provider.id}`);
      message.success(`${provider.name} disconnected`);
      fetchConnected();
    } catch {
      message.error('Failed to disconnect');
    }
  };

  const currentProviders = providers[activeCategory] || [];

  const categoryTabs = CATEGORIES.map((cat) => ({
    key: cat.key,
    label: (
      <span>
        {cat.icon}
        <span style={{ marginLeft: 8 }}>{cat.label}</span>
      </span>
    ),
  }));

  const renderProviderIcon = (provider) => {
    const initials = provider.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: 'var(--c-accent-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 18, margin: '0 auto 12px'
      }}>
        {initials}
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ color: NAVY, marginBottom: 24 }}>
        <ThunderboltOutlined style={{ marginRight: 8 }} />
        Marketplace
      </Title>

      <Tabs
        activeKey={activeCategory}
        onChange={setActiveCategory}
        items={categoryTabs}
        style={{ marginBottom: 24 }}
        size="large"
      />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {currentProviders.map((provider) => {
            const connection = connectedProviders[provider.id];
            const isConnected = !!connection;
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={provider.id}>
                <Card
                  hoverable
                  style={{
                    height: '100%',
                    borderTop: `3px solid ${isConnected ? '#52c41a' : SKY_BLUE}`,
                  }}
                  bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}
                >
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    {renderProviderIcon(provider)}
                    <Title level={5} style={{ margin: '0 0 4px' }}>{provider.name}</Title>
                    <Tag color={CATEGORY_COLORS[provider.category] || 'blue'} style={{ marginBottom: 8 }}>
                      {CATEGORIES.find((c) => c.key === provider.category)?.label || provider.category}
                    </Tag>
                    <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 13, marginBottom: 8 }}>
                      {provider.description}
                    </Paragraph>
                    {provider.website && (
                      <a href={provider.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                        <GlobalOutlined style={{ marginRight: 4 }} />
                        Visit Website
                      </a>
                    )}
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  {isConnected ? (
                    <div>
                      <Badge status="success" text={<Text type="success" style={{ fontSize: 12 }}>Connected</Text>} />
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        <Text type="secondary">
                          Connected: {connection.connected_at ? dayjs(connection.connected_at).format('DD MMM YYYY') : 'N/A'}
                        </Text>
                        <br />
                        <Text type="secondary">
                          Last Used: {connection.last_used_at ? dayjs(connection.last_used_at).format('DD MMM YYYY HH:mm') : 'Never'}
                        </Text>
                      </div>
                      <Space style={{ marginTop: 12, width: '100%' }}>
                        <Button
                          size="small"
                          icon={<SettingOutlined />}
                          onClick={() => handleConnect(provider)}
                        >
                          Reconfigure
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<DisconnectOutlined />}
                          onClick={() => handleDisconnect(provider)}
                        >
                          Disconnect
                        </Button>
                      </Space>
                    </div>
                  ) : (
                    <Button
                      type="primary"
                      icon={<LinkOutlined />}
                      onClick={() => handleConnect(provider)}
                      style={{ background: SKY_BLUE, borderColor: SKY_BLUE }}
                      block
                    >
                      Connect
                    </Button>
                  )}
                </Card>
              </Col>
            );
          })}
          {currentProviders.length === 0 && !loading && (
            <Col span={24}>
              <Empty description="No providers available in this category" />
            </Col>
          )}
        </Row>
      </Spin>

      {/* Connect Modal */}
      <Modal
        title={
          <Space>
            <ApiOutlined />
            <span>{connectedProviders[selectedProvider?.id] ? 'Reconfigure' : 'Connect'} {selectedProvider?.name}</span>
          </Space>
        }
        open={connectModalOpen}
        onCancel={() => { setConnectModalOpen(false); form.resetFields(); setTestResult(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setConnectModalOpen(false); form.resetFields(); setTestResult(null); }}>
            Cancel
          </Button>,
          <Button key="test" icon={<ExperimentOutlined />} loading={testing} onClick={handleTestConnection}>
            Test Connection
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saving}
            onClick={handleSave}
            style={{ background: SKY_BLUE, borderColor: SKY_BLUE }}
          >
            Save & Connect
          </Button>,
        ]}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {selectedProvider?.fields?.map((field) => {
            const isSecret = ['api_secret', 'auth_token', 'password'].includes(field);
            return (
              <Form.Item
                key={field}
                name={field}
                label={FIELD_LABELS[field] || field}
                rules={[{ required: true, message: `Enter ${FIELD_LABELS[field] || field}` }]}
              >
                {isSecret ? (
                  <Input.Password placeholder={`Enter ${FIELD_LABELS[field] || field}`} />
                ) : (
                  <Input placeholder={`Enter ${FIELD_LABELS[field] || field}`} />
                )}
              </Form.Item>
            );
          })}
        </Form>

        {testResult && (
          <div style={{ marginTop: 16 }}>
            {testResult.success ? (
              <Result
                status="success"
                title="Connection Successful"
                subTitle={testResult.message}
                style={{ padding: '16px 0' }}
              />
            ) : (
              <Result
                status="error"
                title="Connection Failed"
                subTitle={testResult.message}
                style={{ padding: '16px 0' }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Marketplace;
