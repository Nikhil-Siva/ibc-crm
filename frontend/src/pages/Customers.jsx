import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Space, Modal, Form, Row, Col, Tag,
  message, Typography, Card, Tooltip, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, UserOutlined, FilterOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { formatMobile, formatCurrency, formatDate } from '../utils/formatters';
import { GENDERS } from '../utils/constants';
import { useAuth } from '../context/AuthContext';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const Customers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ assigned_to: '', city: '' });
  const [agents, setAgents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);

  const [searchTimeout, setSearchTimeout] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (search) params.search = search;
      if (filters.assigned_to) params.assigned_to = filters.assigned_to;
      if (filters.city) params.city = filters.city;

      const res = await api.get('/customers', { params });
      // Backend returns: { success, data: { rows, count, page, totalPages } }
      const responseData = res.data?.data || res.data;
      const customerArray = responseData?.rows || responseData?.customers || (Array.isArray(responseData) ? responseData : []);
      setCustomers(customerArray);
      setTotal(responseData?.count || responseData?.total || responseData?.totalCount || customerArray.length);
    } catch {
      console.error('Customers fetch error');
      message.error('Failed to fetch customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filters]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await api.get('/users', { params: { role: 'agent' } });
        // /api/users returns { data: { rows, count, ... } } — res.data.data is
        // the envelope, not the array.
        const payload = res.data?.data ?? res.data;
        const agentData = Array.isArray(payload)
          ? payload
          : (payload?.rows || payload?.users || []);
        setAgents(agentData);
      } catch {
        setAgents([]);
      }
    };
    fetchAgents();
  }, []);

  const handleSearch = (value) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
    setSearchTimeout(timeout);
  };

  const openModal = (customer = null) => {
    setEditingCustomer(customer);
    if (customer) {
      form.setFieldsValue({
        ...customer,
        assigned_to: customer.assigned_to?._id || customer.assigned_to || customer.assignedTo?._id || customer.assignedTo,
      });
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer._id || editingCustomer.id}`, values);
        message.success('Customer updated');
      } else {
        await api.post('/customers', values);
        message.success('Customer created');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingCustomer(null);
      fetchCustomers();
    } catch (err) {
      if (err.response) message.error(err.response.data?.message || 'Failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/customers/${id}`);
      message.success('Customer deleted');
      fetchCustomers();
    } catch {
      message.error('Failed to delete');
    }
  };

  const columns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, __, idx) => (page - 1) * pageSize + idx + 1,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/customers/${record._id || record.id}`)} style={{ fontWeight: 500 }}>
          <UserOutlined style={{ marginRight: 6 }} />
          {text}
        </a>
      ),
    },
    {
      title: 'Mobile',
      dataIndex: 'mobile',
      key: 'mobile',
      render: (m) => formatMobile(m),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (e) => e || '-',
      ellipsis: true,
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      render: (c) => c || '-',
    },
    {
      title: 'Policies',
      dataIndex: 'policies_count',
      key: 'policies',
      render: (v, record) => (
        <Tag color="blue">{v || record.policiesCount || record.policies?.length || 0}</Tag>
      ),
    },
    {
      title: 'Total Premium',
      dataIndex: 'total_premium',
      key: 'premium',
      render: (v, record) => formatCurrency(v || record.totalPremium || 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/customers/${record._id || record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          {isAdmin && (
            <Popconfirm title="Delete this customer?" onConfirm={() => handleDelete(record._id || record.id)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <Title level={4} style={{ margin: 0, color: 'var(--c-accent)' }}>Customer Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Add Customer
        </Button>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="Search by name, mobile, email..."
          prefix={<SearchOutlined />}
          style={{ width: 260 }}
          allowClear
          onChange={(e) => handleSearch(e.target.value)}
        />
        <Select
          placeholder="Assigned To"
          style={{ width: 170 }}
          allowClear
          value={filters.assigned_to || undefined}
          onChange={(v) => {
            setFilters((prev) => ({ ...prev, assigned_to: v || '' }));
            setPage(1);
          }}
          showSearch
          optionFilterProp="children"
        >
          {agents.map((a) => (
            <Option key={a._id || a.id} value={a._id || a.id}>{a.name}</Option>
          ))}
        </Select>
        <Input
          placeholder="Filter by city"
          style={{ width: 150 }}
          allowClear
          value={filters.city || undefined}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, city: e.target.value || '' }));
            setPage(1);
          }}
        />
        <Button
          onClick={() => { setFilters({ assigned_to: '', city: '' }); setSearch(''); setPage(1); }}
          icon={<FilterOutlined />}
        >
          Clear
        </Button>
      </div>

      <Card bordered={false} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={customers}
          rowKey={(r) => r._id || r.id}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} customers`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          size="middle"
          className="premium-table"
          scroll={{ x: 900 }}
          onRow={(record) => ({
            onDoubleClick: () => navigate(`/customers/${record._id || record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Add/Edit Customer Modal */}
      <Modal
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingCustomer(null); form.resetFields(); }}
        onOk={handleSubmit}
        confirmLoading={submitLoading}
        okText={editingCustomer ? 'Update' : 'Create'}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="Full name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="mobile"
                label="Mobile"
                rules={[
                  { required: true, message: 'Required' },
                  { pattern: /^[6-9]\d{9}$/, message: 'Enter valid 10-digit mobile' },
                ]}
              >
                <Input placeholder="9876543210" maxLength={10} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
                <Input placeholder="email@example.com" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="age" label="Age">
                <Input type="number" placeholder="30" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="gender" label="Gender">
                <Select placeholder="Select">
                  {GENDERS.map((g) => (
                    <Option key={g} value={g}>{g}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="occupation" label="Occupation">
                <Input placeholder="Occupation" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="City">
                <Input placeholder="City" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <TextArea rows={2} placeholder="Full address" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="pan_number" label="PAN Number">
                <Input placeholder="ABCDE1234F" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="aadhaar_number" label="Aadhaar Number">
                <Input placeholder="1234 5678 9012" maxLength={14} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assigned_to" label="Assign To">
                <Select placeholder="Select agent" allowClear showSearch optionFilterProp="children">
                  {agents.map((a) => (
                    <Option key={a._id || a.id} value={a._id || a.id}>{a.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Customers;
