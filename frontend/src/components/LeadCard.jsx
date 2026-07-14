import React from 'react';
import { Card, Tag, Typography, Space, Tooltip } from 'antd';
import {
  PhoneOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PRIORITY_COLORS } from '../utils/constants';
import { timeAgo } from '../utils/formatters';

const { Text } = Typography;

const LeadCard = ({ lead, isDragging = false }) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    // Don't navigate if we're dragging
    if (isDragging) return;
    navigate(`/leads/${lead._id || lead.id}`);
  };

  return (
    <div
      className={`pipeline-card ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
    >
      <div className="card-name">{lead.name || 'Unnamed Lead'}</div>
      <div className="card-mobile">
        <PhoneOutlined style={{ marginRight: 4, fontSize: 12 }} />
        {lead.mobile || 'No mobile'}
      </div>
      <Space size={4} wrap style={{ marginBottom: 6 }}>
        {lead.priority && (
          <Tag
            color={PRIORITY_COLORS[lead.priority] || '#8c8c8c'}
            style={{ borderRadius: 4, fontSize: 11, margin: 0, border: 'none' }}
          >
            {lead.priority}
          </Tag>
        )}
        {lead.source && (
          <Tag
            style={{ borderRadius: 4, fontSize: 11, margin: 0, color: '#666', background: '#f5f5f5', border: '1px solid #e8e8e8' }}
          >
            {lead.source}
          </Tag>
        )}
      </Space>
      <div className="card-footer">
        {lead.assigned_to_name || lead.assignedTo?.name ? (
          <Tooltip title="Assigned Agent">
            <Text type="secondary" style={{ fontSize: 12 }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {lead.assigned_to_name || lead.assignedTo?.name}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Unassigned</Text>
        )}
        {lead.last_contact || lead.lastContact || lead.updatedAt ? (
          <Tooltip title="Last Contact">
            <Text type="secondary" style={{ fontSize: 11 }}>
              <ClockCircleOutlined style={{ marginRight: 3 }} />
              {timeAgo(lead.last_contact || lead.lastContact || lead.updatedAt)}
            </Text>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
};

export default LeadCard;
