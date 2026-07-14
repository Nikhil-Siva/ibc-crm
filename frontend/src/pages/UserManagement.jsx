import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Button, Table, Input, Select, Tag, Switch, Avatar,
  Modal, Form, Typography, Tooltip, Space, message, Alert, Divider,
} from 'antd';
import {
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import api from '../api/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin: { label: 'Admin', color: 'red' },
  manager: { label: 'Manager', color: 'blue' },
  agent: { label: 'Telecaller', color: 'green' },
};

// ─── Mini Stat Card ───────────────────────────────────────────────────────────
// `color` is still accepted so call sites didn't all need touching, but it is
// no longer used: five tinted variants for five counts was decoration, and the
// hex-alpha concatenation it relied on breaks once colours become tokens.
const MiniStat = ({ icon, label, value }) => (
  <Card className="kpi-card" style={{ height: '100%' }} bodyStyle={{ padding: 'var(--s-4)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
      <div style={{
        color: 'var(--c-text-muted)',
        fontSize: 16,
        display: 'flex', alignItems: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div className="kpi-value">{value ?? 0}</div>
        <div className="kpi-label" style={{ marginBottom: 0, marginTop: 'var(--s-1)' }}>{label}</div>
      </div>
    </div>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [form] = Form.useForm();

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const activeCount = users.filter(u => u.is_active).length;
  const telecallerCount = users.filter(u => u.role === 'agent').length;

  // ─── Fetch Users ───────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (p = page, ps = pageSize, s = search, r = roleFilter, st = statusFilter) => {
    try {
      setLoading(true);
      const params = { page: p, limit: ps };
      if (s) params.search = s;
      if (r) params.role = r;
      if (st !== '') params.is_active = st;

      const res = await api.get('/users', { params });
      const data = res.data?.data || res.data;
      setUsers(data?.rows || data?.users || []);
      setTotal(data?.count || data?.total || 0);
    } catch (err) {
      console.error('[UserManagement] fetch error:', err);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize]);

  const handleApplyFilters = () => {
    setPage(1);
    fetchUsers(1, pageSize, search, roleFilter, statusFilter);
  };

  // ─── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async (userId, newValue) => {
    try {
      await api.put(`/users/${userId}`, { is_active: newValue });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: newValue } : u));
      message.success(`User ${newValue ? 'activated' : 'deactivated'} successfully.`);
    } catch (err) {
      message.error('Failed to update user status.');
    }
  };

  // ─── Open Add Modal ─────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingUser(null);
    setModalError('');
    form.resetFields();
    form.setFieldsValue({ role: 'agent' });
    setModalOpen(true);
  };

  // ─── Open Edit Modal ────────────────────────────────────────────────────────
  const openEditModal = (record) => {
    setEditingUser(record);
    setModalError('');
    form.setFieldsValue({
      name: record.name,
      email: record.email,
      mobile: record.mobile,
      role: record.role,
      password: '',
    });
    setModalOpen(true);
  };

  // ─── Save User ──────────────────────────────────────────────────────────────
  const handleSave = async (values) => {
    setModalLoading(true);
    setModalError('');
    try {
      const payload = {
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        role: values.role,
      };
      if (values.password) payload.password = values.password;

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        message.success('User updated successfully.');
      } else {
        await api.post('/users', payload);
        message.success('User created successfully.');
      }
      setModalOpen(false);
      fetchUsers(1, pageSize, search, roleFilter, statusFilter);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to save user.';
      setModalError(errorMsg);
    } finally {
      setModalLoading(false);
    }
  };

  // ─── Get initials ───────────────────────────────────────────────────────────
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // ─── Table Columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Avatar
            size={36}
            style={{
              background: `hsl(${(name?.charCodeAt(0) || 0) * 7 % 360}, 60%, 40%)`,
              fontWeight: 600, fontSize: 13,
            }}
          >
            {getInitials(name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--c-accent)', fontSize: 14 }}>{name}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (v) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Mobile',
      dataIndex: 'mobile',
      key: 'mobile',
      render: (v) => <Text style={{ fontSize: 13 }}>{v || '—'}</Text>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const cfg = ROLE_CONFIG[role] || { label: role, color: 'default' };
        return <Tag color={cfg.color} style={{ borderRadius: 20, fontWeight: 500 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active, record) => (
        <Tooltip title={active ? 'Click to deactivate' : 'Click to activate'}>
          <Switch
            checked={active}
            checkedChildren="Active"
            unCheckedChildren="Inactive"
            onChange={(val) => handleToggleStatus(record.id, val)}
            style={{ background: active ? 'var(--c-accent)' : undefined }}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (v) => (
        <Text style={{ fontSize: 12, color: '#888' }}>
          {v ? dayjs(v).format('DD MMM YYYY, hh:mm A') : 'Never'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit user">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              style={{ color: 'var(--c-accent)' }}
            />
          </Tooltip>
          <Tooltip title={record.is_active ? 'Deactivate' : 'Activate'}>
            <Button
              type="text"
              icon={record.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleStatus(record.id, !record.is_active)}
              style={{ color: record.is_active ? '#f5222d' : '#52c41a' }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f4f8', minHeight: '100vh' }}>

      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0, color: 'var(--c-accent)' }}>
            <TeamOutlined style={{ marginRight: 10, color: 'var(--c-accent)' }} />
            User Management
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {total} user{total !== 1 ? 's' : ''} registered
          </Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAddModal}
          >
            Add User
          </Button>
          <Tooltip title="Refresh">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchUsers()}
              loading={loading}
              style={{ marginLeft: 8 }}
            />
          </Tooltip>
        </Col>
      </Row>

      {/* ─── Mini Stats ───────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <MiniStat
            icon={<TeamOutlined />}
            label="Total Users"
            value={total}
            color="var(--c-accent)"
          />
        </Col>
        <Col span={8}>
          <MiniStat
            icon={<CheckCircleOutlined />}
            label="Active Users"
            value={activeCount}
            color="#52c41a"
          />
        </Col>
        <Col span={8}>
          <MiniStat
            icon={<UserOutlined />}
            label="Telecallers"
            value={telecallerCount}
            color="var(--c-accent)"
          />
        </Col>
      </Row>

      {/* ─── Filter Bar ───────────────────────────────────────────────────── */}
      <Card
        bordered={false}
        style={{ marginBottom: 'var(--s-5)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onPressEnter={handleApplyFilters}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="All Roles"
              value={roleFilter || undefined}
              onChange={setRoleFilter}
              allowClear
              style={{ width: 160 }}
            >
              <Option value="admin">Admin</Option>
              <Option value="manager">Manager</Option>
              <Option value="agent">Telecaller</Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="All Status"
              value={statusFilter || undefined}
              onChange={setStatusFilter}
              allowClear
              style={{ width: 140 }}
            >
              <Option value="true">Active</Option>
              <Option value="false">Inactive</Option>
            </Select>
          </Col>
          <Col>
            <Button
              type="primary"
              onClick={handleApplyFilters}
              style={{ background: 'var(--c-accent)', border: 'none' }}
            >
              Apply
            </Button>
          </Col>
        </Row>
      </Card>

      {/* ─── Users Table ──────────────────────────────────────────────────── */}
      <Card
        bordered={false}
        style={{ width: '100%' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            pageSizeOptions: [10, 25, 50],
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} users`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          rowClassName={(_, idx) => idx % 2 === 0 ? '' : 'table-row-alt'}
          style={{ borderRadius: 14, overflow: 'hidden' }}
        />
      </Card>

      {/* ─── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={
          <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
            {editingUser ? 'Edit User' : 'Add New User'}
          </span>
        }
        footer={null}
        destroyOnClose
        width={480}
      >
        {modalError && (
          <Alert
            message={modalError}
            type="error"
            showIcon
            closable
            onClose={() => setModalError('')}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          autoComplete="off"
          initialValues={{ role: 'agent' }}
        >
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="Full Name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Email address" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item name="mobile" label="Mobile">
            <Input placeholder="Mobile number" maxLength={10} />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? 'Password (leave blank to keep current)' : 'Password'}
            rules={
              editingUser
                ? []
                : [
                    { required: true, message: 'Please enter a password' },
                    { min: 6, message: 'Password must be at least 6 characters' },
                  ]
            }
          >
            <Input.Password placeholder={editingUser ? 'Leave blank to keep current' : 'Password'} />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="admin">Admin</Option>
              <Option value="manager">Manager</Option>
              <Option value="agent">Telecaller</Option>
            </Select>
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          <Row justify="end" gutter={10}>
            <Col>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            </Col>
            <Col>
              <Button
                type="primary"
                htmlType="submit"
                loading={modalLoading}
              >
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>

    </div>
  );
};

export default UserManagement;
