import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Tabs, Descriptions, Button, Table, Modal, Form, Input, Select, DatePicker, Upload, message, Timeline, InputNumber, Row, Col, Space } from 'antd';
import { EditOutlined, PlusOutlined, InboxOutlined, PhoneOutlined, WhatsAppOutlined, MailOutlined } from '@ant-design/icons';
import axios from '../api/axios';
import { formatCurrency, formatDate, formatDateTime, formatMobile } from '../utils/formatters';
import { POLICY_TYPES, PREMIUM_FREQUENCIES, PAYMENT_MODES, POLICY_STATUSES, DOC_TYPES, GENDERS } from '../utils/constants';
import StatusBadge from '../components/StatusBadge';
import FollowupModal from '../components/FollowupModal';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { Dragger } = Upload;
const { TextArea } = Input;

const CustomerDetail = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isPolicyModalVisible, setIsPolicyModalVisible] = useState(false);
  const [isFollowupModalVisible, setIsFollowupModalVisible] = useState(false);
  
  const [editForm] = Form.useForm();
  const [policyForm] = Form.useForm();

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/customers/${id}`);
      setCustomer(data?.data || data?.customer || data);
    } catch (error) {
      console.error('Customer fetch error:', error);
      message.error('Failed to load customer details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const handleUpdateCustomer = async (values) => {
    try {
      const formattedValues = {
        ...values,
        dob: values.dob ? values.dob.format('YYYY-MM-DD') : null,
        nominee_dob: values.nominee_dob ? values.nominee_dob.format('YYYY-MM-DD') : null,
      };
      const { data } = await axios.put(`/customers/${id}`, formattedValues);
      message.success('Customer updated successfully');
      setIsEditModalVisible(false);
      fetchCustomer();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to update customer');
    }
  };

  const handleAddPolicy = async (values) => {
    try {
      const formattedValues = {
        ...values,
        customer_id: id,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        maturity_date: values.maturity_date ? values.maturity_date.format('YYYY-MM-DD') : null,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
      };
      const { data } = await axios.post('/policies', formattedValues);
      message.success('Policy added successfully');
      setIsPolicyModalVisible(false);
      policyForm.resetFields();
      fetchCustomer();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to add policy');
    }
  };

  const documentUploadProps = {
    name: 'file',
    multiple: false,
    action: `http://localhost:5000/api/customers/${id}/documents`, // Simplified for now, should ideally pass through axios but Upload component is tricky. Assuming a dedicated endpoint or we use customRequest
    customRequest: async ({ file, onSuccess, onError }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', 'Other'); // default, could be enhanced with a selector
      formData.append('customer_id', id);
      try {
        const { data } = await axios.post('/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        onSuccess(data);
        message.success(`${file.name} uploaded successfully.`);
        fetchCustomer();
      } catch (err) {
        onError(err);
        message.error(`${file.name} upload failed.`);
      }
    },
  };

  if (loading || !customer) {
    return <Card loading={true} />;
  }

  const policyColumns = [
    { title: 'Policy No', dataIndex: 'policy_number', key: 'policy_number' },
    { title: 'Insurer', dataIndex: 'insurer', key: 'insurer' },
    { title: 'Type', dataIndex: 'policy_type', key: 'policy_type' },
    { title: 'Premium', dataIndex: 'premium_amount', key: 'premium_amount', render: (val) => formatCurrency(val) },
    { title: 'Due Date', dataIndex: 'next_due_date', key: 'next_due_date', render: (val) => formatDate(val) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val) => <StatusBadge status={val} type="policy" /> },
  ];

  const followupColumns = [
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Scheduled At', dataIndex: 'scheduled_at', key: 'scheduled_at', render: (val) => formatDateTime(val) },
    { title: 'Notes', dataIndex: 'notes', key: 'notes' },
    { title: 'Status', dataIndex: 'is_done', key: 'is_done', render: (val) => val ? <StatusBadge status="Closed Won" text="Done" /> : <StatusBadge status="Follow-up" text="Pending" /> },
    { title: 'Outcome', dataIndex: 'outcome', key: 'outcome' },
  ];
  
  const documentColumns = [
    { title: 'Document Type', dataIndex: 'doc_type', key: 'doc_type' },
    { title: 'File Name', dataIndex: 'file_name', key: 'file_name' },
    { title: 'Uploaded At', dataIndex: 'createdAt', key: 'createdAt', render: (val) => formatDateTime(val) },
    { title: 'Action', key: 'action', render: (_, record) => <a href={`http://localhost:5000/${record.file_path}`} target="_blank" rel="noopener noreferrer">View/Download</a> },
  ];

  return (
    <div className="page-container">
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <h2 style={{ margin: 0 }}>{customer.name}</h2>
          <p style={{ color: '#666', margin: 0 }}>Customer ID: #{customer.id}</p>
        </Col>
        <Col>
          <Space>
            <Button icon={<WhatsAppOutlined />} href={`https://wa.me/${customer.mobile.replace(/\D/g, '')}`} target="_blank" />
            <Button icon={<PhoneOutlined />} href={`tel:${customer.mobile}`} />
            {customer.email && <Button icon={<MailOutlined />} href={`mailto:${customer.email}`} />}
            <Button type="primary" onClick={() => setIsFollowupModalVisible(true)}>Add Follow-up</Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <Tabs defaultActiveKey="1">
          <TabPane tab="Profile" key="1">
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="dashed" icon={<EditOutlined />} onClick={() => {
                editForm.setFieldsValue({
                  ...customer,
                  dob: customer.dob ? dayjs(customer.dob) : null,
                  nominee_dob: customer.nominee_dob ? dayjs(customer.nominee_dob) : null,
                });
                setIsEditModalVisible(true);
              }}>Edit Profile</Button>
            </div>
            <Descriptions bordered column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}>
              <Descriptions.Item label="Mobile">{formatMobile(customer.mobile)}</Descriptions.Item>
              <Descriptions.Item label="Alt Mobile">{customer.alternate_mobile ? formatMobile(customer.alternate_mobile) : '-'}</Descriptions.Item>
              <Descriptions.Item label="Email">{customer.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Date of Birth">{customer.dob ? formatDate(customer.dob) : '-'}</Descriptions.Item>
              <Descriptions.Item label="Gender">{customer.gender || '-'}</Descriptions.Item>
              <Descriptions.Item label="Occupation">{customer.occupation || '-'}</Descriptions.Item>
              <Descriptions.Item label="Annual Income">{customer.annual_income ? formatCurrency(customer.annual_income) : '-'}</Descriptions.Item>
              <Descriptions.Item label="PAN Number">{customer.pan_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="Aadhaar Number">{customer.aadhaar_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="Address" span={3}>{customer.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="City">{customer.city || '-'}</Descriptions.Item>
              <Descriptions.Item label="Pincode">{customer.pincode || '-'}</Descriptions.Item>
              <Descriptions.Item label="Assigned Agent">{customer.assignedAgent?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Nominee Name">{customer.nominee_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Nominee Relation">{customer.nominee_relation || '-'}</Descriptions.Item>
              <Descriptions.Item label="Nominee DOB">{customer.nominee_dob ? formatDate(customer.nominee_dob) : '-'}</Descriptions.Item>
            </Descriptions>
          </TabPane>

          <TabPane tab={`Policies (${customer.Policies?.length || 0})`} key="2">
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsPolicyModalVisible(true)}>Add Policy</Button>
            </div>
            <Table dataSource={customer.Policies} columns={policyColumns} rowKey="id" pagination={false} />
          </TabPane>

          <TabPane tab={`Documents (${customer.Documents?.length || 0})`} key="3">
            <Dragger {...documentUploadProps} style={{ padding: '20px', marginBottom: '24px' }}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Click or drag file to this area to upload</p>
              <p className="ant-upload-hint">Support for a single or bulk upload. Strictly prohibit from uploading company data or other band files</p>
            </Dragger>
            <Table dataSource={customer.Documents} columns={documentColumns} rowKey="id" pagination={false} />
          </TabPane>

          <TabPane tab={`Follow-ups (${customer.Followups?.length || 0})`} key="4">
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsFollowupModalVisible(true)}>Add Follow-up</Button>
            </div>
            <Table dataSource={customer.Followups} columns={followupColumns} rowKey="id" pagination={false} />
          </TabPane>
          
          <TabPane tab="Communication Log" key="5">
            <Card title="Recent Communications" bordered={false}>
              <Timeline>
                 {/* For now we just show a static message if no logs are populated, as per spec communication logs are handled by services */}
                 <Timeline.Item color="green">Welcome Message Sent - {formatDate(customer.createdAt)}</Timeline.Item>
              </Timeline>
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      {/* Edit Customer Modal */}
      <Modal title="Edit Customer" open={isEditModalVisible} onCancel={() => setIsEditModalVisible(false)} onOk={() => editForm.submit()} width={800}>
        <Form form={editForm} layout="vertical" onFinish={handleUpdateCustomer}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="mobile" label="Mobile" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="alternate_mobile" label="Alt Mobile"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="email" label="Email"><Input type="email" /></Form.Item></Col>
            <Col span={8}><Form.Item name="dob" label="Date of Birth"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="gender" label="Gender"><Select options={GENDERS.map(g => ({ label: g, value: g }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="occupation" label="Occupation"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="annual_income" label="Annual Income"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="pan_number" label="PAN Number"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="aadhaar_number" label="Aadhaar Number"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="pincode" label="Pincode"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="address" label="Address"><TextArea rows={2} /></Form.Item></Col>
            <Col span={8}><Form.Item name="nominee_name" label="Nominee Name"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="nominee_relation" label="Nominee Relation"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="nominee_dob" label="Nominee DOB"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Add Policy Modal */}
      <Modal title="Add Policy" open={isPolicyModalVisible} onCancel={() => setIsPolicyModalVisible(false)} onOk={() => policyForm.submit()} width={800}>
        <Form form={policyForm} layout="vertical" onFinish={handleAddPolicy}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="insurer" label="Insurer" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="policy_type" label="Policy Type"><Select options={POLICY_TYPES.map(t => ({ label: t, value: t }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="policy_number" label="Policy Number"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="plan_name" label="Plan Name"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="sum_assured" label="Sum Assured"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="premium_amount" label="Premium Amount"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="premium_frequency" label="Premium Frequency"><Select options={PREMIUM_FREQUENCIES.map(f => ({ label: f, value: f }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="payment_mode" label="Payment Mode"><Select options={PAYMENT_MODES.map(m => ({ label: m, value: m }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="Status" initialValue="Active"><Select options={POLICY_STATUSES.map(s => ({ label: s, value: s }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="start_date" label="Start Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="maturity_date" label="Maturity Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="due_date" label="Next Due Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="policy_term_years" label="Term (Years)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="commission_earned" label="Commission"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <FollowupModal
        open={isFollowupModalVisible}
        onClose={() => setIsFollowupModalVisible(false)}
        onSuccess={() => { setIsFollowupModalVisible(false); fetchCustomer(); }}
        customerId={customer.id}
      />
    </div>
  );
};

export default CustomerDetail;
