import React from 'react';
import { Card, Tag, Typography, Space, Tooltip } from 'antd';
import {
  SafetyCertificateOutlined,
  CalendarOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { formatCurrency, formatDate, daysUntil } from '../utils/formatters';
import { POLICY_STATUS_COLORS } from '../utils/constants';

const { Text, Title } = Typography;

const PolicyCard = ({ policy, onClick }) => {
  const daysLeft = daysUntil(policy.next_due_date || policy.end_date);
  
  let urgencyColor = '#e6f7ff';
  let urgencyBorder = '#91d5ff';
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      urgencyColor = '#fff1f0';
      urgencyBorder = '#ffa39e';
    } else if (daysLeft <= 7) {
      urgencyColor = '#fff7e6';
      urgencyBorder = '#ffd591';
    } else if (daysLeft <= 30) {
      urgencyColor = '#fffbe6';
      urgencyBorder = '#ffe58f';
    }
  }

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        borderRadius: 12,
        borderLeft: `4px solid ${POLICY_STATUS_COLORS[policy.status] || '#1890ff'}`,
        background: urgencyColor,
        borderColor: urgencyBorder,
      }}
      styles={{ body: { padding: 16 } }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 15 }}>
            <SafetyCertificateOutlined style={{ marginRight: 6, color: 'var(--c-accent)' }} />
            {policy.insurer || 'Unknown Insurer'}
          </Text>
          <Tag color={POLICY_STATUS_COLORS[policy.status] || '#8c8c8c'} style={{ borderRadius: 6, border: 'none' }}>
            {policy.status}
          </Tag>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {policy.type || 'Insurance'} • {policy.plan_name || 'Standard Plan'}
          </Text>
        </div>

        {policy.policy_number && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Policy No: {policy.policy_number}
          </Text>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Tooltip title="Premium Amount">
            <Text strong style={{ color: 'var(--c-accent)', fontSize: 16 }}>
              <DollarOutlined style={{ marginRight: 4 }} />
              {formatCurrency(policy.premium)}
            </Text>
          </Tooltip>
          {policy.frequency && (
            <Tag color="blue" style={{ borderRadius: 4, fontSize: 11 }}>{policy.frequency}</Tag>
          )}
        </div>

        {(policy.next_due_date || policy.end_date) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              Due: {formatDate(policy.next_due_date || policy.end_date)}
            </Text>
            {daysLeft !== null && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: daysLeft < 0 ? '#f5222d' : daysLeft <= 7 ? '#fa8c16' : '#52c41a',
                }}
              >
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
              </Text>
            )}
          </div>
        )}
      </Space>
    </Card>
  );
};

export default PolicyCard;
