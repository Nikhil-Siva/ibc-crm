import React, { useState, useEffect } from 'react';
import { Card, Tabs, Button, Table, Space, Modal, Form, Input, DatePicker, message, Badge, Calendar, Switch } from 'antd';
import { PhoneOutlined, WhatsAppOutlined, CheckCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import axios from '../api/axios';
import { formatDateTime } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import FollowupModal from '../components/FollowupModal';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { TextArea } = Input;

const Followups = () => {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [isCalendarView, setIsCalendarView] = useState(false);
  
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  
  const [outcomeModalVisible, setOutcomeModalVisible] = useState(false);
  const [currentFollowup, setCurrentFollowup] = useState(null);
  const [outcomeForm] = Form.useForm();
  
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleForm] = Form.useForm();

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      let url = '/followups';
      if (activeTab === 'today') {
        url = '/followups/today';
      } else if (activeTab === 'week') {
        const from = dayjs().startOf('week').format('YYYY-MM-DD');
        const to = dayjs().endOf('week').format('YYYY-MM-DD');
        url = `/followups?from=${from}&to=${to}`;
      }
      
      const { data } = await axios.get(url);
      // Handle both response shapes: { success, data } and flat array/object
      const rows = data?.data?.rows || data?.data || data?.followups || (Array.isArray(data) ? data : []);
      setFollowups(rows);
    } catch (error) {
      console.error('Followups fetch error:', error);
      message.error('Failed to load follow-ups');
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, [activeTab]);

  const handleMarkDone = async (values) => {
    try {
      await axios.put(`/followups/${currentFollowup.id}/done`, { outcome: values.outcome });
      message.success('Follow-up marked as done');
      setOutcomeModalVisible(false);
      outcomeForm.resetFields();
      fetchFollowups();
    } catch (error) {
      message.error('Failed to update follow-up');
    }
  };

  const handleReschedule = async (values) => {
    try {
      await axios.put(`/followups/${currentFollowup.id}`, { 
        scheduled_at: values.scheduled_at.format('YYYY-MM-DD HH:mm:ss')
      });
      message.success('Follow-up rescheduled');
      setRescheduleModalVisible(false);
      rescheduleForm.resetFields();
      fetchFollowups();
    } catch (error) {
      message.error('Failed to reschedule');
    }
  };

  const columns = [
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => {
        const person = record.Lead || record.Customer || {};
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{person.name || 'Unknown'}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{person.mobile || ''}</div>
          </div>
        );
      }
    },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Scheduled At', dataIndex: 'scheduled_at', key: 'scheduled_at', render: (val) => formatDateTime(val) },
    { title: 'Notes', dataIndex: 'notes', key: 'notes' },
    { 
      title: 'Status', 
      dataIndex: 'is_done', 
      key: 'is_done', 
      render: (val) => val ? <StatusBadge status="Closed Won" text="Done" /> : <StatusBadge status="Follow-up" text="Pending" /> 
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const mobile = (record.Lead || record.Customer || {}).mobile || '';
        const cleanMobile = mobile.replace(/\D/g, '');
        return (
          <Space>
            {!record.is_done && (
              <>
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<CheckCircleOutlined />} 
                  onClick={() => { setCurrentFollowup(record); setOutcomeModalVisible(true); }}
                >
                  Done
                </Button>
                <Button 
                  size="small" 
                  onClick={() => { setCurrentFollowup(record); setRescheduleModalVisible(true); }}
                >
                  Reschedule
                </Button>
              </>
            )}
            <Button size="small" icon={<WhatsAppOutlined />} href={`https://wa.me/${cleanMobile}`} target="_blank" />
            <Button size="small" icon={<PhoneOutlined />} href={`tel:${mobile}`} />
          </Space>
        );
      }
    }
  ];

  const cellRender = (current) => {
    const listData = followups.filter(f => dayjs(f.scheduled_at).format('YYYY-MM-DD') === current.format('YYYY-MM-DD'));
    return (
      <ul className="events" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {listData.map((item) => (
          <li key={item.id}>
            <Badge status={item.is_done ? 'success' : 'warning'} text={`${item.type} - ${item.Lead?.name || item.Customer?.name}`} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Follow-ups</h2>
        <Space>
          <span>Calendar View</span>
          <Switch checked={isCalendarView} onChange={setIsCalendarView} />
          <Button type="primary" icon={<CalendarOutlined />} onClick={() => setIsAddModalVisible(true)}>
            Add Follow-up
          </Button>
        </Space>
      </div>

      <Card>
        {!isCalendarView ? (
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="Today" key="today">
              <h3 style={{ marginBottom: 16 }}>{followups.filter(f => !f.is_done).length} tasks due today</h3>
              <Table dataSource={followups} columns={columns} rowKey="id" loading={loading} />
            </TabPane>
            <TabPane tab="This Week" key="week">
              <Table dataSource={followups} columns={columns} rowKey="id" loading={loading} />
            </TabPane>
            <TabPane tab="All" key="all">
              <Table dataSource={followups} columns={columns} rowKey="id" loading={loading} />
            </TabPane>
          </Tabs>
        ) : (
          <Calendar cellRender={cellRender} />
        )}
      </Card>

      <FollowupModal
        open={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSuccess={() => { setIsAddModalVisible(false); fetchFollowups(); }}
      />

      <Modal title="Mark as Done" open={outcomeModalVisible} onCancel={() => setOutcomeModalVisible(false)} onOk={() => outcomeForm.submit()}>
        <Form form={outcomeForm} layout="vertical" onFinish={handleMarkDone}>
          <Form.Item name="outcome" label="Outcome / Notes" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="What happened during this follow-up?" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Reschedule Follow-up" open={rescheduleModalVisible} onCancel={() => setRescheduleModalVisible(false)} onOk={() => rescheduleForm.submit()}>
        <Form form={rescheduleForm} layout="vertical" onFinish={handleReschedule}>
          <Form.Item name="scheduled_at" label="New Date & Time" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Followups;
