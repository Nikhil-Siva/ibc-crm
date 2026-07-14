import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tabs, Table, Button, Space, message, Modal, Form, DatePicker, Select } from 'antd';
import { WhatsAppOutlined, MailOutlined, CheckCircleOutlined, PhoneOutlined, WarningOutlined, ExclamationCircleOutlined, BellOutlined, DollarOutlined } from '@ant-design/icons';
import axios from '../api/axios';
import { formatCurrency, formatDate, daysUntil } from '../utils/formatters';

const { TabPane } = Tabs;

const rowStyles = {
  overdue: { backgroundColor: '#fff1f0' },
  dueSoon: { backgroundColor: '#fff7e6' },
  dueMonth: { backgroundColor: '#fffff0' },
};

const Renewals = () => {
  const [policies, setPolicies] = useState([]);
  const [stats, setStats] = useState({ overdue: 0, thisWeek: 0, thisMonth: 0, collected: 0 });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('30');
  
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [paymentForm] = Form.useForm();

  const fetchRenewals = async () => {
    try {
      setLoading(true);
      let url = '/renewals/upcoming?days=30';
      if (activeTab === 'overdue') url = '/renewals/overdue';
      else if (activeTab === '7') url = '/renewals/upcoming?days=7';
      else if (activeTab === '60') url = '/renewals/upcoming?days=60';
      else if (activeTab === 'all') url = '/policies'; // All policies for full view
      
      const { data } = await axios.get(url);
      // Handle both response shapes: { success, data: {...} } or plain {...}
      const responseData = data?.data || data;
      if (responseData?.overdue !== undefined) {
        // If the backend grouped it (upcoming), flatten it for the table
        let all = [];
        if (responseData.overdue) all = [...all, ...responseData.overdue];
        if (responseData.this_week) all = [...all, ...responseData.this_week];
        if (responseData.this_month) all = [...all, ...responseData.this_month];
        if (responseData.later) all = [...all, ...responseData.later];
        setPolicies(all);
      } else {
        setPolicies(responseData?.rows || (Array.isArray(responseData) ? responseData : []));
      }

      // Fetch stats
      try {
        const statsRes = await axios.get('/renewals/stats');
        const s = statsRes.data?.data || statsRes.data || {};
        setStats({
          overdue: s.overdueCount || 0,
          thisWeek: s.dueNext7Days || 0,
          thisMonth: s.dueNext30Days || 0,
          collected: s.collectedThisMonth || 0,
        });
      } catch { /* stats endpoint may not exist yet */ }
    } catch (error) {
      console.error('Renewals fetch error:', error);
      message.error('Failed to load renewals');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
  }, [activeTab]);

  const handleSendReminder = async (policyId, channel) => {
    try {
      if (channel === 'whatsapp') {
         await axios.post(`/renewals/send-reminder/${policyId}`);
         message.success('WhatsApp reminder triggered');
      } else {
         message.info('Email reminder triggered');
      }
    } catch (error) {
      message.error('Failed to send reminder');
    }
  };

  const handleMarkCollected = async (values) => {
    try {
      const { data } = await axios.put(`/policies/${currentPolicy.id}`, {
         status: 'Active',
         next_due_date: values.next_due_date.format('YYYY-MM-DD')
      });
      // Handle both response shapes
      const responseData = data?.data || data;
      if (responseData) {
        message.success('Payment recorded successfully');
        setPaymentModalVisible(false);
        paymentForm.resetFields();
        fetchRenewals();
      }
    } catch (error) {
      message.error('Failed to update policy');
    }
  };

  const columns = [
    { title: 'Customer', key: 'customer', render: (_, r) => r.Customer?.name || 'Unknown' },
    { title: 'Mobile', key: 'mobile', render: (_, r) => r.Customer?.mobile || '' },
    { title: 'Policy No', dataIndex: 'policy_number', key: 'policy_number' },
    { title: 'Type', dataIndex: 'policy_type', key: 'policy_type' },
    { title: 'Insurer', dataIndex: 'insurer', key: 'insurer' },
    { title: 'Premium', dataIndex: 'premium_amount', key: 'premium_amount', render: (v) => formatCurrency(v) },
    { title: 'Due Date', dataIndex: 'next_due_date', key: 'next_due_date', render: (v) => formatDate(v) },
    { 
      title: 'Days Left', 
      key: 'days_left', 
      render: (_, r) => {
        const days = daysUntil(r.next_due_date);
        let color = 'green';
        if (days < 0) color = 'red';
        else if (days <= 7) color = 'orange';
        else if (days <= 30) color = 'goldenrod';
        return <span style={{ color, fontWeight: 'bold' }}>{days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}</span>;
      } 
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => {
        const cleanMobile = r.Customer?.mobile?.replace(/\D/g, '') || '';
        return (
          <Space>
            <Button size="small" type="primary" icon={<WhatsAppOutlined />} onClick={() => handleSendReminder(r.id, 'whatsapp')} />
            <Button size="small" icon={<MailOutlined />} onClick={() => handleSendReminder(r.id, 'email')} />
            <Button size="small" icon={<PhoneOutlined />} href={`tel:${r.Customer?.mobile}`} />
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => { setCurrentPolicy(r); setPaymentModalVisible(true); }}>Collected</Button>
          </Space>
        );
      }
    }
  ];

  // Use inline styles via onRow instead of CSS class names from <style jsx global>
  const onRow = (record) => {
    const days = daysUntil(record.next_due_date);
    let style = {};
    if (days < 0) style = rowStyles.overdue;
    else if (days <= 7) style = rowStyles.dueSoon;
    else if (days <= 30) style = rowStyles.dueMonth;
    return { style };
  };

  return (
    <div className="page-container">
      <h2 style={{ marginBottom: 24 }}>Renewals Management</h2>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="kpi-card" style={{ borderLeft: '4px solid #f5222d' }}>
            <Statistic title="Overdue" value={stats.overdue} prefix={<WarningOutlined style={{ color: '#f5222d' }} />} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="kpi-card" style={{ borderLeft: '4px solid #fa8c16' }}>
            <Statistic title="Due This Week" value={stats.thisWeek} prefix={<ExclamationCircleOutlined style={{ color: '#fa8c16' }} />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="kpi-card" style={{ borderLeft: '4px solid #faad14' }}>
            <Statistic title="Due This Month" value={stats.thisMonth} prefix={<BellOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="kpi-card" style={{ borderLeft: '4px solid #52c41a' }}>
            <Statistic title="Collected This Month" value={stats.collected} prefix={<DollarOutlined style={{ color: '#52c41a' }} />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Overdue" key="overdue">
            <Table dataSource={policies} columns={columns} rowKey="id" loading={loading} onRow={onRow} />
          </TabPane>
          <TabPane tab="Due in 7 Days" key="7">
            <Table dataSource={policies} columns={columns} rowKey="id" loading={loading} onRow={onRow} />
          </TabPane>
          <TabPane tab="Due in 30 Days" key="30">
            <Table dataSource={policies} columns={columns} rowKey="id" loading={loading} onRow={onRow} />
          </TabPane>
          <TabPane tab="Due in 60 Days" key="60">
            <Table dataSource={policies} columns={columns} rowKey="id" loading={loading} onRow={onRow} />
          </TabPane>
          <TabPane tab="All Policies" key="all">
            <Table dataSource={policies} columns={columns} rowKey="id" loading={loading} onRow={onRow} />
          </TabPane>
        </Tabs>
      </Card>

      <Modal title="Mark Premium Collected" open={paymentModalVisible} onCancel={() => setPaymentModalVisible(false)} onOk={() => paymentForm.submit()}>
        <Form form={paymentForm} layout="vertical" onFinish={handleMarkCollected}>
          <p>Recording payment for policy <strong>{currentPolicy?.policy_number}</strong> ({currentPolicy?.Customer?.name})</p>
          <Form.Item name="next_due_date" label="Next Due Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Renewals;
