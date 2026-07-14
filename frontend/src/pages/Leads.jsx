import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Input, Select, Space, Modal, Form, Row, Col, Tag, Popconfirm,
  message, Dropdown, Typography, Card, Tooltip, DatePicker,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  PhoneOutlined, WhatsAppOutlined, CalendarOutlined, DownloadOutlined,
  SwapOutlined, UserSwitchOutlined, FilterOutlined, ExportOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import FollowupModal from '../components/FollowupModal';
import {
  LEAD_STATUSES, LEAD_SOURCES, INSURANCE_INTERESTS, PRIORITIES, PRIORITY_COLORS,
} from '../utils/constants';
import { formatMobile, formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const Leads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', source: '', priority: '', assigned_to: '' });
  const [agents, setAgents] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [followupLeadId, setFollowupLeadId] = useState(null);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
      };
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.source) params.source = filters.source;
      if (filters.priority) params.priority = filters.priority;
      if (filters.assigned_to) params.assigned_to = filters.assigned_to;

      const res = await api.get('/leads', { params });
      // Backend returns: { success, data: { rows, count, page, totalPages } }
      const responseData = res.data?.data || res.data;
      const leadsArray = responseData?.rows || responseData?.leads || (Array.isArray(responseData) ? responseData : []);
      setLeads(leadsArray);
      setTotal(responseData?.count || responseData?.total || responseData?.totalCount || leadsArray.length);
    } catch (err) {
      console.error('Leads fetch error:', err);
      message.error('Failed to fetch leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await api.get('/users', { params: { role: 'agent' } });
        // /api/users returns { data: { rows, count, page, totalPages } }, so
        // res.data.data is the envelope — not the array. Assigning it straight
        // to state crashed the page on agents.map().
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

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: '', source: '', priority: '', assigned_to: '' });
    setSearch('');
    setPage(1);
  };

  // Add / Edit Lead
  const openModal = (lead = null) => {
    setEditingLead(lead);
    if (lead) {
      form.setFieldsValue({
        ...lead,
        assigned_to: lead.assigned_to?._id || lead.assigned_to || lead.assignedTo?._id || lead.assignedTo,
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
      if (editingLead) {
        await api.put(`/leads/${editingLead._id || editingLead.id}`, values);
        message.success('Lead updated successfully');
      } else {
        await api.post('/leads', values);
        message.success('Lead created successfully');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingLead(null);
      fetchLeads();
    } catch (err) {
      if (err.response) {
        message.error(err.response.data?.message || 'Operation failed');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete lead
  const handleDelete = async (id) => {
    try {
      await api.delete(`/leads/${id}`);
      message.success('Lead deleted');
      fetchLeads();
    } catch {
      message.error('Failed to delete lead');
    }
  };

  // Convert to customer
  const handleConvert = async (lead) => {
    try {
      await api.post(`/leads/convert/${lead._id || lead.id}`);
      message.success(`${lead.name} converted to customer!`);
      fetchLeads();
    } catch (err) {
      message.error(err.response?.data?.message || 'Conversion failed');
    }
  };

  // Bulk actions
  const handleBulkAssign = async (agentId) => {
    try {
      await Promise.all(
        selectedRowKeys.map((id) => api.put(`/leads/${id}`, { assigned_to: agentId }))
      );
      message.success(`${selectedRowKeys.length} leads assigned`);
      setSelectedRowKeys([]);
      fetchLeads();
    } catch {
      message.error('Bulk assign failed');
    }
  };

  const handleBulkStatus = async (status) => {
    try {
      await Promise.all(
        selectedRowKeys.map((id) => api.put(`/leads/${id}`, { status }))
      );
      message.success(`${selectedRowKeys.length} leads updated to ${status}`);
      setSelectedRowKeys([]);
      fetchLeads();
    } catch {
      message.error('Bulk status update failed');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedRowKeys.map((id) => api.delete(`/leads/${id}`)));
      message.success(`${selectedRowKeys.length} leads deleted`);
      setSelectedRowKeys([]);
      fetchLeads();
    } catch {
      message.error('Bulk delete failed');
    }
  };

  // Export to CSV (opens in Excel/Sheets)
  const handleExport = async () => {
    try {
      const { downloadCsv } = await import('../utils/exportCsv');
      const exportData = leads.map((lead, idx) => ({
        '#': (page - 1) * pageSize + idx + 1,
        Name: lead.name,
        Mobile: lead.mobile,
        Email: lead.email || '',
        Source: lead.source || '',
        Priority: lead.priority || '',
        Status: lead.status || '',
        'Assigned To': lead.assigned_to_name || lead.assignedTo?.name || '',
        City: lead.city || '',
        'Insurance Interest': lead.insurance_interest || lead.insuranceInterest || '',
        'Created Date': formatDate(lead.createdAt || lead.created_at),
      }));
      downloadCsv(exportData, `leads_export_${new Date().toISOString().slice(0, 10)}`);
      message.success('Exported successfully');
    } catch {
      message.error('Export failed.');
    }
  };

  // Columns
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
        <a
          onClick={() => navigate(`/leads/${record._id || record.id}`)}
          style={{ fontWeight: 500 }}
        >
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
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (s) => s ? <Tag>{s}</Tag> : '-',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => p ? (
        <Tag color={PRIORITY_COLORS[p]} style={{ borderRadius: 4, border: 'none', fontWeight: 600 }}>
          {p}
        </Tag>
      ) : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <StatusBadge status={s} />,
    },
    {
      title: 'Assigned To',
      dataIndex: 'assigned_to_name',
      key: 'assigned_to',
      render: (text, record) => text || record.assignedTo?.name || '-',
    },
    {
      title: 'Last Contact',
      dataIndex: 'last_contact',
      key: 'last_contact',
      render: (d, record) => formatDate(d || record.lastContact || record.updatedAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/leads/${record._id || record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openModal(record)}
            />
          </Tooltip>
          <Tooltip title="Add Follow-up">
            <Button
              type="text"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => {
                setFollowupLeadId(record._id || record.id);
                setFollowupModalOpen(true);
              }}
            />
          </Tooltip>
          {record.status !== 'Closed Won' && (
            <Tooltip title="Convert to Customer">
              <Popconfirm
                title="Convert this lead to a customer?"
                onConfirm={() => handleConvert(record)}
                okText="Convert"
              >
                <Button type="text" size="small" icon={<UserSwitchOutlined />} style={{ color: '#52c41a' }} />
              </Popconfirm>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip title="Delete">
              <Popconfirm
                title="Are you sure?"
                onConfirm={() => handleDelete(record._id || record.id)}
                okText="Delete"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <Title level={4} style={{ margin: 0, color: 'var(--c-accent)' }}>Lead Management</Title>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Export Excel</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Add Lead
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <Input
          placeholder="Search by name, mobile, email..."
          prefix={<SearchOutlined />}
          style={{ width: 260 }}
          allowClear
          onChange={(e) => handleSearch(e.target.value)}
        />
        <Select
          placeholder="Status"
          style={{ width: 160 }}
          allowClear
          value={filters.status || undefined}
          onChange={(v) => handleFilterChange('status', v || '')}
        >
          {LEAD_STATUSES.map((s) => (
            <Option key={s} value={s}>{s}</Option>
          ))}
        </Select>
        <Select
          placeholder="Source"
          style={{ width: 150 }}
          allowClear
          value={filters.source || undefined}
          onChange={(v) => handleFilterChange('source', v || '')}
        >
          {LEAD_SOURCES.map((s) => (
            <Option key={s} value={s}>{s}</Option>
          ))}
        </Select>
        <Select
          placeholder="Priority"
          style={{ width: 130 }}
          allowClear
          value={filters.priority || undefined}
          onChange={(v) => handleFilterChange('priority', v || '')}
        >
          {PRIORITIES.map((p) => (
            <Option key={p} value={p}>{p}</Option>
          ))}
        </Select>
        <Select
          placeholder="Assigned To"
          style={{ width: 170 }}
          allowClear
          value={filters.assigned_to || undefined}
          onChange={(v) => handleFilterChange('assigned_to', v || '')}
          showSearch
          optionFilterProp="children"
        >
          {agents.map((a) => (
            <Option key={a._id || a.id} value={a._id || a.id}>{a.name}</Option>
          ))}
        </Select>
        <Button onClick={clearFilters} icon={<FilterOutlined />}>Clear</Button>
      </div>

      {/* Bulk Actions */}
      {selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, background: '#f0f7ff' }}>
          <Space>
            <span>{selectedRowKeys.length} selected</span>
            <Select
              placeholder="Assign to..."
              style={{ width: 160 }}
              onChange={handleBulkAssign}
              size="small"
            >
              {agents.map((a) => (
                <Option key={a._id || a.id} value={a._id || a.id}>{a.name}</Option>
              ))}
            </Select>
            <Select
              placeholder="Change status..."
              style={{ width: 160 }}
              onChange={handleBulkStatus}
              size="small"
            >
              {LEAD_STATUSES.map((s) => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
            {isAdmin && (
              <Popconfirm title="Delete selected leads?" onConfirm={handleBulkDelete}>
                <Button size="small" danger>Delete Selected</Button>
              </Popconfirm>
            )}
          </Space>
        </Card>
      )}

      {/* Table */}
      <Card bordered={false} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={leads}
          rowKey={(record) => record._id || record.id}
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} leads`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          size="middle"
          className="premium-table"
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingLead ? 'Edit Lead' : 'Add New Lead'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingLead(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={submitLoading}
        okText={editingLead ? 'Update' : 'Create'}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Name is required' }]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="mobile"
                label="Mobile"
                rules={[
                  { required: true, message: 'Mobile is required' },
                  { pattern: /^[6-9]\d{9}$/, message: 'Enter valid 10-digit mobile' },
                ]}
              >
                <Input placeholder="9876543210" maxLength={10} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter valid email' }]}>
                <Input placeholder="email@example.com" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="age" label="Age">
                <Input type="number" placeholder="30" min={1} max={120} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="gender" label="Gender">
                <Select placeholder="Select">
                  <Option value="Male">Male</Option>
                  <Option value="Female">Female</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="occupation" label="Occupation">
                <Input placeholder="Business / Service / etc." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="City">
                <Input placeholder="City name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="source" label="Lead Source" rules={[{ required: true, message: 'Select source' }]}>
                <Select placeholder="Select source">
                  {LEAD_SOURCES.map((s) => (
                    <Option key={s} value={s}>{s}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="insurance_interest" label="Insurance Interest">
                <Select placeholder="Select interest" mode="multiple" maxTagCount={2}>
                  {INSURANCE_INTERESTS.map((i) => (
                    <Option key={i} value={i}>{i}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="Priority" rules={[{ required: true, message: 'Select priority' }]}>
                <Select placeholder="Select">
                  {PRIORITIES.map((p) => (
                    <Option key={p} value={p}>{p}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="New">
                <Select>
                  {LEAD_STATUSES.map((s) => (
                    <Option key={s} value={s}>{s}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
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
            <TextArea rows={3} placeholder="Additional notes..." maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Follow-up Modal */}
      <FollowupModal
        open={followupModalOpen}
        onClose={() => {
          setFollowupModalOpen(false);
          setFollowupLeadId(null);
        }}
        onSuccess={fetchLeads}
        leadId={followupLeadId}
      />
    </div>
  );
};

export default Leads;
