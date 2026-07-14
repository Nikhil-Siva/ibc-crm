import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Button, Input, Switch, Modal, Form, Space, Typography, Empty,
  Row, Col, Divider, Tag, Tooltip, message, Spin, Radio, Checkbox, Select,
  DatePicker, InputNumber, List,
} from 'antd';
import {
  FontSizeOutlined, AlignLeftOutlined, NumberOutlined, PhoneOutlined,
  MailOutlined, CalendarOutlined, CheckCircleOutlined, CheckSquareOutlined,
  DownCircleOutlined, SendOutlined, UpOutlined, DownOutlined, EditOutlined,
  DeleteOutlined, PlusOutlined, MinusCircleOutlined, SaveOutlined,
  EyeOutlined, DragOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const FIELD_TYPES = [
  { type: 'short_text', label: 'Short Text', icon: <FontSizeOutlined /> },
  { type: 'long_text', label: 'Long Text', icon: <AlignLeftOutlined /> },
  { type: 'number', label: 'Number', icon: <NumberOutlined /> },
  { type: 'phone', label: 'Phone', icon: <PhoneOutlined /> },
  { type: 'email', label: 'Email', icon: <MailOutlined /> },
  { type: 'date_picker', label: 'Date Picker', icon: <CalendarOutlined /> },
  { type: 'radio', label: 'Single Choice - Radio', icon: <CheckCircleOutlined /> },
  { type: 'checkbox', label: 'Multiple Choice - Checkbox', icon: <CheckSquareOutlined /> },
  { type: 'dropdown', label: 'Dropdown', icon: <DownCircleOutlined /> },
  { type: 'multi_channel', label: 'Multi-Channel Button', icon: <SendOutlined /> },
];

const DEFAULT_FIELD = (type, label) => ({
  id: Date.now() + Math.random(),
  type,
  label: label || 'Untitled Field',
  placeholder: '',
  required: false,
  options: ['radio', 'checkbox', 'dropdown'].includes(type) ? ['Option 1', 'Option 2'] : [],
  channel_config: type === 'multi_channel'
    ? {
        button_display_name: 'Send Message',
        whatsapp_template: 'Hi {{lead_name}}, thank you for your interest.',
        sms_template: 'Hi {{lead_name}}, thank you for your interest.',
        email_subject: 'Follow-up',
        email_body: 'Hi {{lead_name}},\n\nThank you for your interest.\n\nBest regards',
      }
    : null,
});

const FormBuilder = () => {
  const { campaignId } = useParams();
  const [fields, setFields] = useState([]);
  const [formTitle, setFormTitle] = useState('Untitled Form');
  const [formId, setFormId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [propertiesForm] = Form.useForm();
  const templateRef = useRef(null);

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const fetchForm = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await api.get(`/engagement-forms/campaign/${campaignId}`);
      const data = res.data?.data || res.data;
      if (data) {
        setFormId(data.id);
        setFormTitle(data.title || 'Untitled Form');
        setFields(data.fields || []);
      }
    } catch {
      // No existing form — start fresh
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  useEffect(() => {
    if (selectedField) {
      propertiesForm.setFieldsValue({
        label: selectedField.label,
        placeholder: selectedField.placeholder,
        required: selectedField.required,
        options: selectedField.options,
        ...(selectedField.channel_config || {}),
      });
    }
  }, [selectedFieldId, selectedField, propertiesForm]);

  const addField = useCallback((type, label) => {
    const newField = DEFAULT_FIELD(type, label);
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    message.success(`${label} field added`);
  }, []);

  const updateField = useCallback((id, updates) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const deleteField = useCallback((id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    message.info('Field removed');
  }, [selectedFieldId]);

  const moveField = useCallback((index, direction) => {
    setFields((prev) => {
      const arr = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= arr.length) return arr;
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return arr;
    });
  }, []);

  const handlePropertiesChange = useCallback(
    (changedValues) => {
      if (!selectedFieldId) return;
      const updates = {};
      if ('label' in changedValues) updates.label = changedValues.label;
      if ('placeholder' in changedValues) updates.placeholder = changedValues.placeholder;
      if ('required' in changedValues) updates.required = changedValues.required;
      if ('options' in changedValues) updates.options = changedValues.options;
      if (
        'button_display_name' in changedValues ||
        'whatsapp_template' in changedValues ||
        'sms_template' in changedValues ||
        'email_subject' in changedValues ||
        'email_body' in changedValues
      ) {
        const prev = fields.find((f) => f.id === selectedFieldId);
        updates.channel_config = {
          ...(prev?.channel_config || {}),
          ...Object.fromEntries(
            Object.entries(changedValues).filter(([k]) =>
              ['button_display_name', 'whatsapp_template', 'sms_template', 'email_subject', 'email_body'].includes(k)
            )
          ),
        };
      }
      if (Object.keys(updates).length > 0) updateField(selectedFieldId, updates);
    },
    [selectedFieldId, fields, updateField]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = { campaign_id: campaignId, title: formTitle, fields };
      if (formId) {
        await api.put(`/engagement-forms/${formId}`, payload);
      } else {
        const res = await api.post('/engagement-forms', payload);
        const data = res.data?.data || res.data;
        if (data?.id) setFormId(data.id);
      }
      message.success('Form saved successfully');
    } catch {
      message.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  }, [campaignId, formTitle, fields, formId]);

  const renderFieldPreview = (field) => {
    switch (field.type) {
      case 'short_text':
        return <Input placeholder={field.placeholder || 'Enter text...'} disabled style={{ maxWidth: 320 }} />;
      case 'long_text':
        return <TextArea placeholder={field.placeholder || 'Enter text...'} disabled rows={2} style={{ maxWidth: 400 }} />;
      case 'number':
        return <InputNumber placeholder={field.placeholder || '0'} disabled style={{ width: 200 }} />;
      case 'phone':
        return <Input placeholder={field.placeholder || '+91 XXXXX XXXXX'} disabled style={{ maxWidth: 260 }} prefix={<PhoneOutlined />} />;
      case 'email':
        return <Input placeholder={field.placeholder || 'email@example.com'} disabled style={{ maxWidth: 300 }} prefix={<MailOutlined />} />;
      case 'date_picker':
        return <DatePicker disabled style={{ width: 200 }} />;
      case 'radio':
        return (
          <Radio.Group disabled>
            {(field.options || []).map((opt, i) => (
              <Radio key={i} value={opt}>{opt}</Radio>
            ))}
          </Radio.Group>
        );
      case 'checkbox':
        return (
          <Checkbox.Group disabled options={(field.options || []).map((opt) => ({ label: opt, value: opt }))} />
        );
      case 'dropdown':
        return (
          <Select disabled placeholder="Select an option" style={{ width: 250 }} options={(field.options || []).map((opt) => ({ label: opt, value: opt }))} />
        );
      case 'multi_channel':
        return (
          <Space>
            <Button style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}>
              WhatsApp
            </Button>
            <Button style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)', color: '#fff' }}>
              SMS
            </Button>
            <Button style={{ background: '#fa8c16', borderColor: '#fa8c16', color: '#fff' }}>
              Email
            </Button>
          </Space>
        );
      default:
        return <Input disabled placeholder="Field preview" />;
    }
  };

  const renderPreviewModal = () => (
    <Modal
      title={formTitle || 'Form Preview'}
      open={previewVisible}
      onCancel={() => setPreviewVisible(false)}
      footer={[
        <Button key="close" onClick={() => setPreviewVisible(false)}>Close</Button>,
        <Button key="submit" type="primary" style={{ background: 'var(--c-accent)' }}>Submit</Button>,
      ]}
      width={640}
    >
      {fields.length === 0 ? (
        <Empty description="No fields added yet" />
      ) : (
        <Form layout="vertical">
          {fields.map((field) => (
            <Form.Item
              key={field.id}
              label={
                <span>
                  {field.label}
                  {field.required && <span style={{ color: '#f5222d', marginLeft: 4 }}>*</span>}
                </span>
              }
            >
              {renderFieldPreview(field)}
            </Form.Item>
          ))}
        </Form>
      )}
    </Modal>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading form..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: 'var(--c-accent)' }}>
          <DragOutlined style={{ marginRight: 8 }} />
          Form Builder
        </Title>
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewVisible(true)}>
            Preview Form
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={saving}
            style={{ background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
          >
            Save Form
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left Panel — Field Palette */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <Card
            title={<Text strong style={{ color: 'var(--c-accent)' }}>Field Types</Text>}
            size="small"
            styles={{ body: { padding: 8 } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FIELD_TYPES.map((ft) => (
                <div
                  key={ft.type}
                  onClick={() => addField(ft.type, ft.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #e8e8e8',
                    cursor: 'pointer',
                    background: '#fff',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e6f4ff';
                    e.currentTarget.style.borderColor = 'var(--c-accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e8e8e8';
                  }}
                >
                  <span style={{ fontSize: 16, color: 'var(--c-accent)' }}>{ft.icon}</span>
                  <Text style={{ fontSize: 13 }}>{ft.label}</Text>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center Panel — Canvas */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Text strong style={{ color: 'var(--c-accent)', whiteSpace: 'nowrap' }}>Form Preview</Text>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Enter form title..."
                  style={{ maxWidth: 360 }}
                  size="small"
                />
              </div>
            }
            styles={{ body: { minHeight: 400 } }}
          >
            {fields.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary">Click a field type from the left panel to add it</Text>
                }
                style={{ marginTop: 100 }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    onClick={() => setSelectedFieldId(field.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 14,
                      borderRadius: 8,
                      border: selectedFieldId === field.id ? '2px solid var(--c-accent)' : '1px solid #e8e8e8',
                      background: selectedFieldId === field.id ? '#f0f9ff' : '#fafafa',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                      <Button
                        type="text"
                        size="small"
                        icon={<UpOutlined />}
                        disabled={index === 0}
                        onClick={(e) => { e.stopPropagation(); moveField(index, -1); }}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<DownOutlined />}
                        disabled={index === fields.length - 1}
                        onClick={(e) => { e.stopPropagation(); moveField(index, 1); }}
                      />
                    </div>

                    {/* Field Preview */}
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Text strong style={{ fontSize: 14 }}>{field.label}</Text>
                        {field.required && <Tag color="red" style={{ fontSize: 10 }}>Required</Tag>}
                        <Tag color="blue" style={{ fontSize: 10 }}>
                          {FIELD_TYPES.find((ft) => ft.type === field.type)?.label || field.type}
                        </Tag>
                      </div>
                      {renderFieldPreview(field)}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Tooltip title="Edit">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
                        />
                      </Tooltip>
                      <Tooltip title={field.required ? 'Required' : 'Optional'}>
                        <Switch
                          size="small"
                          checked={field.required}
                          onChange={(checked) => { updateField(field.id, { required: checked }); }}
                          onClick={(_, e) => e.stopPropagation()}
                        />
                      </Tooltip>
                      <Tooltip title="Delete">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => { e.stopPropagation(); deleteField(field.id); }}
                        />
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Panel — Properties */}
        {selectedField && (
          <div style={{ width: 280, flexShrink: 0 }}>
            <Card
              title={<Text strong style={{ color: 'var(--c-accent)' }}>Field Properties</Text>}
              size="small"
              extra={
                <Button type="text" size="small" onClick={() => setSelectedFieldId(null)}>
                  ✕
                </Button>
              }
            >
              <Form
                form={propertiesForm}
                layout="vertical"
                size="small"
                onValuesChange={handlePropertiesChange}
              >
                <Form.Item label="Label" name="label">
                  <Input placeholder="Field label" />
                </Form.Item>

                {selectedField.type !== 'multi_channel' && (
                  <Form.Item label="Placeholder" name="placeholder">
                    <Input placeholder="Placeholder text" />
                  </Form.Item>
                )}

                <Form.Item label="Required" name="required" valuePropName="checked">
                  <Switch />
                </Form.Item>

                {['radio', 'checkbox', 'dropdown'].includes(selectedField.type) && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Options</Text>
                    <Form.List name="options">
                      {(optFields, { add, remove, move }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {optFields.map((optField, optIdx) => (
                            <div key={optField.key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<UpOutlined style={{ fontSize: 10 }} />}
                                  disabled={optIdx === 0}
                                  onClick={() => move(optIdx, optIdx - 1)}
                                  style={{ padding: 0, height: 16 }}
                                />
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<DownOutlined style={{ fontSize: 10 }} />}
                                  disabled={optIdx === optFields.length - 1}
                                  onClick={() => move(optIdx, optIdx + 1)}
                                  style={{ padding: 0, height: 16 }}
                                />
                              </div>
                              <Form.Item {...optField} noStyle>
                                <Input placeholder={`Option ${optIdx + 1}`} style={{ flex: 1 }} />
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<MinusCircleOutlined />}
                                onClick={() => remove(optField.name)}
                              />
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => add(`Option ${optFields.length + 1}`)}
                            icon={<PlusOutlined />}
                            block
                          >
                            Add Option
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </>
                )}

                {selectedField.type === 'multi_channel' && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Channel Configuration</Text>

                    <Form.Item label="Button Display Name" name="button_display_name">
                      <Input placeholder="Send Message" />
                    </Form.Item>

                    <Form.Item
                      label="WhatsApp Template"
                      name="whatsapp_template"
                      extra={<Text type="secondary" style={{ fontSize: 11 }}>Use {'{{lead_name}}'} for merge tags</Text>}
                    >
                      <TextArea rows={3} placeholder="WhatsApp message template..." />
                    </Form.Item>

                    <Form.Item label="SMS Template" name="sms_template">
                      <TextArea rows={2} placeholder="SMS message template..." />
                    </Form.Item>

                    <Form.Item label="Email Subject" name="email_subject">
                      <Input placeholder="Email subject line" />
                    </Form.Item>

                    <Form.Item label="Email Body" name="email_body">
                      <TextArea rows={3} placeholder="Email body content..." />
                    </Form.Item>
                  </>
                )}
              </Form>
            </Card>
          </div>
        )}
      </div>

      {renderPreviewModal()}
    </div>
  );
};

export default FormBuilder;
