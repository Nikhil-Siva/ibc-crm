import React from 'react';
import { Badge, Dropdown, Avatar, Typography, Space } from 'antd';
import {
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { getGreeting, getInitials } from '../utils/formatters';
import { useLocation } from 'react-router-dom';

const { Text } = Typography;

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/leads': 'Lead Management',
  '/pipeline': 'Sales Pipeline',
  '/customers': 'Customer Management',
  '/followups': 'Follow-ups',
  '/renewals': 'Renewals',
  '/agents': 'Agent Recruitment',
  '/reports': 'Reports & Analytics',
};

const TopBar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Determine page title
  let pageTitle = 'Dashboard';
  const path = location.pathname;
  if (pageTitles[path]) {
    pageTitle = pageTitles[path];
  } else if (path.startsWith('/leads/')) {
    pageTitle = 'Lead Details';
  } else if (path.startsWith('/customers/')) {
    pageTitle = 'Customer Details';
  }

  const userMenuItems = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: 'My Profile',
      },
      {
        key: 'password',
        icon: <KeyOutlined />,
        label: 'Change Password',
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Settings',
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        danger: true,
      },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout();
      }
    },
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">{pageTitle}</h1>
      </div>
      <div className="topbar-right">
        <span className="greeting-text">
          {getGreeting()}, <strong>{user?.name || 'User'}</strong>
        </span>

        <Badge count={0} size="small" offset={[-2, 4]}>
          <span className="notification-bell">
            <BellOutlined />
          </span>
        </Badge>

        <Dropdown menu={userMenuItems} trigger={['click']} placement="bottomRight">
          <div className="user-avatar-dropdown">
            <Avatar
              size={28}
              style={{
                background: 'var(--c-accent-subtle)',
                color: 'var(--c-accent)',
                fontWeight: 500,
                fontSize: 'var(--t-xs)',
              }}
            >
              {getInitials(user?.name)}
            </Avatar>
            <div style={{ lineHeight: 1.3 }}>
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-role">{user?.role || 'agent'}</div>
            </div>
          </div>
        </Dropdown>
      </div>
    </div>
  );
};

export default TopBar;
