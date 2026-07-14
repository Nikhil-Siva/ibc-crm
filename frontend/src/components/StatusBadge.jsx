import React from 'react';
import { Tag } from 'antd';
import { STATUS_COLORS, POLICY_STATUS_COLORS, AGENT_STATUS_COLORS, PRIORITY_COLORS } from '../utils/constants';

const StatusBadge = ({ status, type = 'lead', size = 'default' }) => {
  if (!status) return <Tag color="default">N/A</Tag>;

  let colorMap;
  switch (type) {
    case 'policy':
      colorMap = POLICY_STATUS_COLORS;
      break;
    case 'agent':
      colorMap = AGENT_STATUS_COLORS;
      break;
    case 'priority':
      colorMap = PRIORITY_COLORS;
      break;
    default:
      colorMap = STATUS_COLORS;
  }

  const color = colorMap[status] || '#8c8c8c';

  return (
    <Tag
      color={color}
      style={{
        borderRadius: 6,
        fontWeight: 500,
        fontSize: size === 'small' ? 11 : 12,
        padding: size === 'small' ? '0 6px' : '2px 10px',
        border: 'none',
      }}
    >
      {status}
    </Tag>
  );
};

export default StatusBadge;
