import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, Select, DatePicker, message, Row, Col, Statistic, Radio, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, TrophyOutlined, ScheduleOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { AGENT_INTERVIEW_STATUSES, AGENT_TRAINING_STATUSES, AGENT_IRDA_STATUSES } from '../utils/constants';
import { formatDate } from '../utils/formatters';

const Agents = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'kanban'
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form] = Form.useForm();

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/agents');
      const agentData = data?.data?.rows || data?.data || data?.agents || (Array.isArray(data) ? data : []);
      setAgents(agentData);
      try {
        const statsRes = await axios.get('/agents/stats');
        setStats(statsRes.data?.data || statsRes.data || {});
      } catch { /* stats endpoint may not exist */ }
    } catch (error) {
      message.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleSave = async (values) => {
    try {
      const formattedValues = {
        ...values,
        interview_date: values.interview_date ? values.interview_date.format('YYYY-MM-DD') : null,
      };

      if (editingAgent) {
        await axios.put(`/agents/${editingAgent.id}`, formattedValues);
        message.success('Agent updated successfully');
      } else {
        await axios.post('/agents', formattedValues);
        message.success('Agent added successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      fetchAgents();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to save agent');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/agents/${id}`);
      message.success('Agent deleted successfully');
      fetchAgents();
    } catch (error) {
      message.error('Failed to delete agent');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile' },
    { title: 'City', dataIndex: 'city', key: 'city' },
    { title: 'Referred By', key: 'referrer', render: (_, r) => r.referrer?.name || '-' },
    { title: 'Interview Status', dataIndex: 'interview_status', key: 'interview_status', render: (val) => <Tag color="blue">{val}</Tag> },
    { title: 'Training Status', dataIndex: 'training_status', key: 'training_status', render: (val) => <Tag color="orange">{val}</Tag> },
    { title: 'IRDA Status', dataIndex: 'irda_exam_status', key: 'irda_exam_status', render: (val) => <Tag color="purple">{val}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => {
            setEditingAgent(record);
            form.setFieldsValue({ ...record, interview_date: record.interview_date ? dayjs(record.interview_date) : null });
            setIsModalVisible(true);
          }} />
          {user?.role === 'admin' && (
             <Button danger icon={<DeleteOutlined />} onClick={() => {
                Modal.confirm({ title: 'Delete Agent?', onOk: () => handleDelete(record.id) });
             }} />
          )}
        </Space>
      )
    }
  ];

  const kanbanColumns = AGENT_INTERVIEW_STATUSES.map(status => ({
    title: status,
    agents: agents.filter(a => a.interview_status === status)
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>Agent Recruitment</h2>
        <Space>
          <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)}>
            <Radio.Button value="table">Table View</Radio.Button>
            <Radio.Button value="kanban">Kanban View</Radio.Button>
          </Radio.Group>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAgent(null); form.resetFields(); setIsModalVisible(true); }}>
            Add Candidate
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card className="kpi-card"><Statistic title="Total Candidates" value={agents.length} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col span={5}>
          <Card className="kpi-card"><Statistic title="Scheduled Interviews" value={agents.filter(a => a.interview_status === 'Scheduled').length} prefix={<ScheduleOutlined />} /></Card>
        </Col>
        <Col span={5}>
          <Card className="kpi-card"><Statistic title="Passed Interviews" value={agents.filter(a => a.interview_status === 'Passed').length} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col span={5}>
          <Card className="kpi-card"><Statistic title="Joined" value={agents.filter(a => a.interview_status === 'Joined').length} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col span={5}>
          <Card className="kpi-card"><Statistic title="Active Agents" value={agents.filter(a => a.activation_status === 'Active').length} prefix={<TrophyOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      {viewMode === 'table' ? (
        <Card>
          <Table dataSource={agents} columns={columns} rowKey="id" loading={loading} />
        </Card>
      ) : (
        <div style={{ display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 16 }}>
          {kanbanColumns.map(col => (
            <div key={col.title} style={{ minWidth: 300, background: '#f0f2f5', borderRadius: 8, padding: 16 }}>
              <h3 style={{ marginBottom: 16 }}>{col.title} <Tag>{col.agents.length}</Tag></h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {col.agents.map(agent => (
                  <Card key={agent.id} size="small" hoverable onClick={() => {
                    setEditingAgent(agent);
                    form.setFieldsValue({ ...agent, interview_date: agent.interview_date ? dayjs(agent.interview_date) : null });
                    setIsModalVisible(true);
                  }}>
                    <div style={{ fontWeight: 500 }}>{agent.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{agent.mobile}</div>
                    <div style={{ marginTop: 8 }}>
                      <Tag color="orange">{agent.training_status}</Tag>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal title={editingAgent ? "Edit Agent" : "Add Agent"} open={isModalVisible} onCancel={() => setIsModalVisible(false)} onOk={() => form.submit()} width={800}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="mobile" label="Mobile" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="email" label="Email"><Input type="email" /></Form.Item></Col>
            <Col span={8}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="age" label="Age"><Input type="number" /></Form.Item></Col>
            <Col span={8}><Form.Item name="education" label="Education"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="occupation" label="Current Occupation"><Input /></Form.Item></Col>
            
            <Col span={8}><Form.Item name="interview_status" label="Interview Status" initialValue="Not Scheduled"><Select options={AGENT_INTERVIEW_STATUSES.map(s => ({ label: s, value: s }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="interview_date" label="Interview Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="training_status" label="Training Status" initialValue="Not Started"><Select options={AGENT_TRAINING_STATUSES.map(s => ({ label: s, value: s }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="irda_exam_status" label="IRDA Exam Status" initialValue="Not Registered"><Select options={AGENT_IRDA_STATUSES.map(s => ({ label: s, value: s }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="activation_status" label="Activation Status" initialValue="Inactive"><Select options={[{ label: 'Inactive', value: 'Inactive' }, { label: 'Active', value: 'Active' }]} /></Form.Item></Col>
            
            <Col span={24}><Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default Agents;
