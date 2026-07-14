import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Space, Tag, Badge, Typography,
  Card, Popconfirm, message, ColorPicker, Checkbox, Tooltip, Spin,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, HolderOutlined,
  MinusCircleOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ExclamationCircleOutlined, FunnelPlotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PipelineManagement = () => {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [stages, setStages] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const fetchPipelines = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const res = await api.get('/pipelines', { params: { page, limit: pageSize } });
      const data = res.data?.data || res.data;
      const rows = data?.rows || (Array.isArray(data) ? data : []);
      const count = data?.count ?? rows.length;
      setPipelines(rows);
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: count }));
    } catch (err) {
      console.error('Failed to load pipelines:', err);
      message.error('Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const handleTableChange = (pag, _filters, _sorter) => {
    fetchPipelines(pag.current, pag.pageSize);
  };

  const openCreateModal = () => {
    setEditingPipeline(null);
    form.resetFields();
    setStages([
      { id: Date.now(), name: 'New', color: '#1890ff', is_terminal_won: false, is_terminal_lost: false },
      { id: Date.now() + 1, name: 'In Progress', color: '#fa8c16', is_terminal_won: false, is_terminal_lost: false },
      { id: Date.now() + 2, name: 'Won', color: '#52c41a', is_terminal_won: true, is_terminal_lost: false },
      { id: Date.now() + 3, name: 'Lost', color: '#f5222d', is_terminal_won: false, is_terminal_lost: true },
    ]);
    setModalOpen(true);
  };

  const openEditModal = (pipeline) => {
    setEditingPipeline(pipeline);
    form.setFieldsValue({ name: pipeline.name, description: pipeline.description });
    const existingStages = (pipeline.stages || [])
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((s, idx) => ({
        id: s.id || Date.now() + idx,
        name: s.name,
        color: s.color || '#1890ff',
        is_terminal_won: !!s.is_terminal_won,
        is_terminal_lost: !!s.is_terminal_lost,
      }));
    setStages(existingStages.length > 0 ? existingStages : [
      { id: Date.now(), name: '', color: '#1890ff', is_terminal_won: false, is_terminal_lost: false },
    ]);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (stages.length === 0) {
        message.warning('Please add at least one stage');
        return;
      }
      const emptyStage = stages.find((s) => !s.name?.trim());
      if (emptyStage) {
        message.warning('All stages must have a name');
        return;
      }

      setSaving(true);
      const payload = {
        name: values.name,
        description: values.description || '',
        stages: stages.map((s, idx) => ({
          name: s.name.trim(),
          color: typeof s.color === 'string' ? s.color : s.color?.toHexString?.() || '#1890ff',
          order_index: idx,
          is_terminal_won: !!s.is_terminal_won,
          is_terminal_lost: !!s.is_terminal_lost,
        })),
      };

      if (editingPipeline) {
        await api.put(`/pipelines/${editingPipeline.id}`, payload);
        message.success('Pipeline updated successfully');
      } else {
        await api.post('/pipelines', payload);
        message.success('Pipeline created successfully');
      }

      setModalOpen(false);
      fetchPipelines(pagination.current, pagination.pageSize);
    } catch (err) {
      if (err?.errorFields) return;
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to save pipeline';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pipeline) => {
    try {
      await api.delete(`/pipelines/${pipeline.id}`);
      message.success('Pipeline deleted successfully');
      fetchPipelines(pagination.current, pagination.pageSize);
    } catch (err) {
      if (err?.response?.status === 400) {
        const errorMsg = err?.response?.data?.message || err?.response?.data?.error || 'Cannot delete this pipeline';
        Modal.warning({
          title: 'Cannot Delete Pipeline',
          icon: <ExclamationCircleOutlined />,
          content: errorMsg,
          okText: 'Understood',
        });
      } else {
        message.error('Failed to delete pipeline');
      }
    }
  };

  const handleToggleActive = async (pipeline) => {
    try {
      await api.put(`/pipelines/${pipeline.id}/toggle`);
      message.success(`Pipeline ${pipeline.is_active ? 'deactivated' : 'activated'}`);
      fetchPipelines(pagination.current, pagination.pageSize);
    } catch (err) {
      message.error('Failed to toggle pipeline status');
    }
  };

  // Stage builder helpers
  const addStage = () => {
    setStages((prev) => [
      ...prev,
      { id: Date.now(), name: '', color: '#1890ff', is_terminal_won: false, is_terminal_lost: false },
    ]);
  };

  const removeStage = (id) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStage = (id, field, value) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const moveStage = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[newIndex];
    newStages[newIndex] = temp;
    setStages(newStages);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (name) => (
        <Text strong style={{ color: 'var(--c-accent)' }}>{name}</Text>
      ),
    },
    {
      title: 'Stages',
      dataIndex: 'stages',
      key: 'stages',
      render: (stagesList) => {
        const count = Array.isArray(stagesList) ? stagesList.length : 0;
        return (
          <Space size={4}>
            <Badge
              count={count}
              style={{ backgroundColor: 'var(--c-accent)' }}
              showZero
            />
            {Array.isArray(stagesList) && stagesList.length > 0 && (
              <Space size={2} wrap>
                {stagesList
                  .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                  .slice(0, 5)
                  .map((stage, idx) => (
                    <Tag
                      key={idx}
                      color={stage.color || '#1890ff'}
                      style={{ fontSize: 11, margin: 0 }}
                    >
                      {stage.name}
                    </Tag>
                  ))}
                {stagesList.length > 5 && (
                  <Tag style={{ fontSize: 11, margin: 0 }}>+{stagesList.length - 5}</Tag>
                )}
              </Space>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Campaigns',
      dataIndex: 'campaign_count',
      key: 'campaign_count',
      sorter: (a, b) => (a.campaign_count || 0) - (b.campaign_count || 0),
      render: (count) => (
        <Badge count={count || 0} showZero style={{ backgroundColor: count ? '#52c41a' : '#d9d9d9' }} />
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      render: (name, record) => name || record.creator?.name || '-',
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-',
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive, record) => (
        <Switch
          checked={!!isActive}
          size="small"
          onChange={() => handleToggleActive(record)}
          checkedChildren="On"
          unCheckedChildren="Off"
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              style={{ color: 'var(--c-accent)' }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Pipeline"
            description="Are you sure you want to delete this pipeline?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: 'var(--c-accent)' }}>
            <FunnelPlotOutlined style={{ marginRight: 8 }} />
            Pipeline Management
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Create and manage sales pipelines with custom stages
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
          style={{ background: 'var(--c-accent)' }}
        >
          Create Pipeline
        </Button>
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={pipelines}
          columns={columns}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} pipelines`,
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={
          <Space>
            <FunnelPlotOutlined style={{ color: 'var(--c-accent)' }} />
            <span>{editingPipeline ? 'Edit Pipeline' : 'Create Pipeline'}</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saving}
            disabled={saving}
            onClick={handleSave}
            style={{ background: 'var(--c-accent)' }}
          >
            {editingPipeline ? 'Update Pipeline' : 'Create Pipeline'}
          </Button>,
        ]}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Pipeline Name"
            rules={[{ required: true, message: 'Pipeline name is required' }]}
          >
            <Input placeholder="e.g., Insurance Sales Pipeline" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Describe this pipeline's purpose..." />
          </Form.Item>
        </Form>

        {/* Stage Builder */}
        <div style={{ marginTop: 8 }}>
          <Text strong style={{ fontSize: 14, color: 'var(--c-accent)', display: 'block', marginBottom: 12 }}>
            Pipeline Stages
          </Text>
          <div
            style={{
              background: '#fafafa',
              borderRadius: 8,
              padding: 12,
              border: '1px solid #f0f0f0',
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {stages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                No stages added. Click "Add Stage" below.
              </div>
            )}
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  padding: '8px 10px',
                  background: '#fff',
                  borderRadius: 6,
                  border: '1px solid #e8e8e8',
                }}
              >
                <HolderOutlined style={{ color: '#bbb', fontSize: 16, cursor: 'grab' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Tooltip title="Move up">
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={index === 0}
                      onClick={() => moveStage(index, -1)}
                      style={{ padding: '0 4px', height: 18, fontSize: 10 }}
                    />
                  </Tooltip>
                  <Tooltip title="Move down">
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={index === stages.length - 1}
                      onClick={() => moveStage(index, 1)}
                      style={{ padding: '0 4px', height: 18, fontSize: 10 }}
                    />
                  </Tooltip>
                </div>

                <Tag
                  style={{
                    width: 8,
                    height: 28,
                    padding: 0,
                    border: 'none',
                    borderRadius: 4,
                    flexShrink: 0,
                    background: typeof stage.color === 'string' ? stage.color : '#1890ff',
                  }}
                />

                <ColorPicker
                  value={stage.color}
                  size="small"
                  onChange={(color) => updateStage(stage.id, 'color', color.toHexString())}
                  presets={[
                    {
                      label: 'Recommended',
                      colors: [
                        '#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1',
                        '#13c2c2', '#eb2f96', 'var(--c-accent)', 'var(--c-accent)', '#faad14',
                      ],
                    },
                  ]}
                />

                <Input
                  value={stage.name}
                  placeholder="Stage name"
                  size="small"
                  onChange={(e) => updateStage(stage.id, 'name', e.target.value)}
                  style={{ flex: 1, minWidth: 120 }}
                />

                <Checkbox
                  checked={stage.is_terminal_won}
                  onChange={(e) => updateStage(stage.id, 'is_terminal_won', e.target.checked)}
                >
                  <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Won</Text>
                </Checkbox>

                <Checkbox
                  checked={stage.is_terminal_lost}
                  onChange={(e) => updateStage(stage.id, 'is_terminal_lost', e.target.checked)}
                >
                  <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Lost</Text>
                </Checkbox>

                <Tooltip title="Remove stage">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => removeStage(stage.id)}
                  />
                </Tooltip>
              </div>
            ))}
          </div>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addStage}
            style={{ width: '100%', marginTop: 10 }}
          >
            Add Stage
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default PipelineManagement;
