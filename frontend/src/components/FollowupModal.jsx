import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, message } from 'antd';
import dayjs from 'dayjs';
import api from '../api/axios';
import { FOLLOWUP_TYPES } from '../utils/constants';

const { TextArea } = Input;
const { Option } = Select;

const FollowupModal = ({ open, onClose, onSuccess, leadId, customerId, leads = [], customers = [] }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [searchLeads, setSearchLeads] = useState([]);
  const [searchCustomers, setSearchCustomers] = useState([]);
  const [entityType, setEntityType] = useState(leadId ? 'lead' : customerId ? 'customer' : 'lead');

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (leadId) {
        form.setFieldsValue({ lead_id: leadId, entity_type: 'lead' });
        setEntityType('lead');
      }
      if (customerId) {
        form.setFieldsValue({ customer_id: customerId, entity_type: 'customer' });
        setEntityType('customer');
      }
      form.setFieldsValue({
        scheduled_at: dayjs().add(1, 'hour').startOf('hour'),
      });
    }
  }, [open, leadId, customerId, form]);

  const handleSearchLeads = async (value) => {
    if (value && value.length >= 2) {
      try {
        const res = await api.get('/leads', { params: { search: value, limit: 10 } });
        setSearchLeads(res.data.leads || res.data.data || []);
      } catch {
        setSearchLeads([]);
      }
    }
  };

  const handleSearchCustomers = async (value) => {
    if (value && value.length >= 2) {
      try {
        const res = await api.get('/customers', { params: { search: value, limit: 10 } });
        setSearchCustomers(res.data.customers || res.data.data || []);
      } catch {
        setSearchCustomers([]);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        type: values.type,
        scheduled_at: values.scheduled_at.toISOString(),
        notes: values.notes || '',
      };

      if (entityType === 'lead') {
        payload.lead_id = values.lead_id || leadId;
      } else {
        payload.customer_id = values.customer_id || customerId;
      }

      await api.post('/followups', payload);
      message.success('Follow-up scheduled successfully!');
      form.resetFields();
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      if (err.response) {
        message.error(err.response.data?.message || 'Failed to create follow-up');
      }
    } finally {
      setLoading(false);
    }
  };

  const availableLeads = leads.length > 0 ? leads : searchLeads;
  const availableCustomers = customers.length > 0 ? customers : searchCustomers;

  return (
    <Modal
      title="Schedule Follow-up"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Schedule"
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {!leadId && !customerId && (
          <>
            <Form.Item label="Entity Type" name="entity_type" initialValue="lead">
              <Select onChange={(val) => setEntityType(val)}>
                <Option value="lead">Lead</Option>
                <Option value="customer">Customer</Option>
              </Select>
            </Form.Item>

            {entityType === 'lead' ? (
              <Form.Item
                label="Select Lead"
                name="lead_id"
                rules={[{ required: true, message: 'Please select a lead' }]}
              >
                <Select
                  showSearch
                  placeholder="Search lead by name or mobile..."
                  filterOption={false}
                  onSearch={handleSearchLeads}
                  notFoundContent="Type to search leads"
                >
                  {availableLeads.map((lead) => (
                    <Option key={lead._id || lead.id} value={lead._id || lead.id}>
                      {lead.name} — {lead.mobile}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            ) : (
              <Form.Item
                label="Select Customer"
                name="customer_id"
                rules={[{ required: true, message: 'Please select a customer' }]}
              >
                <Select
                  showSearch
                  placeholder="Search customer by name or mobile..."
                  filterOption={false}
                  onSearch={handleSearchCustomers}
                  notFoundContent="Type to search customers"
                >
                  {availableCustomers.map((cust) => (
                    <Option key={cust._id || cust.id} value={cust._id || cust.id}>
                      {cust.name} — {cust.mobile}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}
          </>
        )}

        <Form.Item
          label="Follow-up Type"
          name="type"
          rules={[{ required: true, message: 'Please select follow-up type' }]}
        >
          <Select placeholder="Select type">
            {FOLLOWUP_TYPES.map((t) => (
              <Option key={t} value={t}>{t}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Scheduled Date & Time"
          name="scheduled_at"
          rules={[{ required: true, message: 'Please pick a date and time' }]}
        >
          <DatePicker
            showTime={{ format: 'hh:mm A', use12Hours: true }}
            format="DD MMM YYYY, hh:mm A"
            style={{ width: '100%' }}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        </Form.Item>

        <Form.Item label="Notes" name="notes">
          <TextArea
            rows={3}
            placeholder="Add notes about this follow-up..."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FollowupModal;
