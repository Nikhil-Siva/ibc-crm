import React, { useMemo } from 'react';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  UsergroupAddOutlined,
  UserOutlined,
  CalendarOutlined,
  BellOutlined,
  TeamOutlined,
  BarChartOutlined,
  FunnelPlotOutlined,
  UnorderedListOutlined,
  CloudUploadOutlined,
  ApiOutlined,
  NodeIndexOutlined,
  RocketOutlined,
  FormOutlined,
  ShopOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  PhoneOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  const isAgent = user?.role === 'agent';

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (path === '/telecaller-dashboard') return 'my-dashboard';
    if (path === '/dashboard') return 'dashboard';
    if (path.startsWith('/users')) return 'users';
    if (path === '/leads/pipeline' || path === '/pipeline') return 'pipeline';
    if (path.startsWith('/leads')) return 'leads';
    if (path.startsWith('/customers')) return 'customers';
    if (path.startsWith('/followups')) return 'followups';
    if (path.startsWith('/renewals')) return 'renewals';
    if (path.startsWith('/agents')) return 'agents';
    if (path.startsWith('/campaigns')) return 'campaigns';
    if (path.startsWith('/pipelines')) return 'pipelines';
    if (path.startsWith('/contact-import')) return 'contact-import';
    if (path.startsWith('/integrations')) return 'integrations';
    if (path.startsWith('/reports/calls')) return 'call-reports';
    if (path.startsWith('/reports/login')) return 'login-reports';
    if (path.startsWith('/reports')) return 'reports';
    if (path.startsWith('/marketplace')) return 'marketplace';
    if (path.startsWith('/form-builder')) return 'form-builder';
    if (path.startsWith('/sms-automation')) return 'sms-automation';
    if (path.startsWith('/workflows')) return 'workflows';
    return 'dashboard';
  }, [location.pathname]);

  const openKeys = useMemo(() => {
    if (selectedKey === 'leads' || selectedKey === 'pipeline') return ['leads-menu'];
    if (['call-reports', 'login-reports', 'reports'].includes(selectedKey)) return ['reports-menu'];
    if (['sms-automation', 'workflows'].includes(selectedKey)) return ['automation-menu'];
    return [];
  }, [selectedKey]);

  const menuItems = useMemo(() => {
    // ─── Agent (Telecaller) menu ──────────────────────────────────────────
    if (isAgent) {
      return [
        {
          key: 'my-dashboard',
          icon: <DashboardOutlined />,
          label: 'My Dashboard',
          onClick: () => navigate('/telecaller-dashboard'),
        },
        {
          key: 'leads-menu',
          icon: <UsergroupAddOutlined />,
          label: 'My Leads',
          children: [
            {
              key: 'leads',
              icon: <UnorderedListOutlined />,
              label: 'All Leads',
              onClick: () => navigate('/leads'),
            },
            {
              key: 'pipeline',
              icon: <FunnelPlotOutlined />,
              label: 'Pipeline View',
              onClick: () => navigate('/pipeline'),
            },
          ],
        },
        {
          key: 'followups',
          icon: <CalendarOutlined />,
          label: 'My Follow-ups',
          onClick: () => navigate('/followups'),
        },
        {
          key: 'customers',
          icon: <UserOutlined />,
          label: 'Customers',
          onClick: () => navigate('/customers'),
        },
      ];
    }

    // ─── Admin / Manager menu ─────────────────────────────────────────────
    const items = [
      {
        key: 'dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
        onClick: () => navigate('/dashboard'),
      },
      {
        key: 'leads-menu',
        icon: <UsergroupAddOutlined />,
        label: 'Leads',
        children: [
          {
            key: 'leads',
            icon: <UnorderedListOutlined />,
            label: 'All Leads',
            onClick: () => navigate('/leads'),
          },
          {
            key: 'pipeline',
            icon: <FunnelPlotOutlined />,
            label: 'Pipeline View',
            onClick: () => navigate('/pipeline'),
          },
        ],
      },
      {
        key: 'customers',
        icon: <UserOutlined />,
        label: 'Customers',
        onClick: () => navigate('/customers'),
      },
      {
        key: 'followups',
        icon: <CalendarOutlined />,
        label: 'Follow-ups',
        onClick: () => navigate('/followups'),
      },
      {
        key: 'renewals',
        icon: <BellOutlined />,
        label: 'Renewals',
        onClick: () => navigate('/renewals'),
      },
    ];

    if (isAdminOrManager) {
      items.push(
        {
          key: 'users',
          icon: <TeamOutlined />,
          label: 'User Management',
          onClick: () => navigate('/users'),
        },
        {
          key: 'campaigns',
          icon: <RocketOutlined />,
          label: 'Campaigns',
          onClick: () => navigate('/campaigns'),
        },
        {
          key: 'pipelines',
          icon: <NodeIndexOutlined />,
          label: 'Pipelines',
          onClick: () => navigate('/pipelines'),
        },
        {
          key: 'contact-import',
          icon: <CloudUploadOutlined />,
          label: 'Contact Upload',
          onClick: () => navigate('/contact-import'),
        },
        {
          key: 'integrations',
          icon: <ApiOutlined />,
          label: 'Integrations',
          onClick: () => navigate('/integrations'),
        },
        {
          key: 'reports-menu',
          icon: <BarChartOutlined />,
          label: 'Reports',
          children: [
            {
              key: 'call-reports',
              icon: <PhoneOutlined />,
              label: 'Call Reports',
              onClick: () => navigate('/reports/calls'),
            },
            {
              key: 'login-reports',
              icon: <LoginOutlined />,
              label: 'Login & Efficiency',
              onClick: () => navigate('/reports/login'),
            },
            {
              key: 'reports',
              icon: <BarChartOutlined />,
              label: 'Legacy Reports',
              onClick: () => navigate('/reports'),
            },
          ],
        },
        {
          key: 'marketplace',
          icon: <ShopOutlined />,
          label: 'Marketplace',
          onClick: () => navigate('/marketplace'),
        },
        {
          key: 'automation-menu',
          icon: <ThunderboltOutlined />,
          label: 'Automations',
          children: [
            {
              key: 'sms-automation',
              icon: <MessageOutlined />,
              label: 'SMS Automation',
              onClick: () => navigate('/sms-automation'),
            },
            {
              key: 'workflows',
              icon: <SettingOutlined />,
              label: 'Workflows',
              onClick: () => navigate('/workflows'),
            },
          ],
        },
      );
    }

    items.push({
      key: 'agents',
      icon: <TeamOutlined />,
      label: 'Agent Recruitment',
      onClick: () => navigate('/agents'),
    });

    return items;
  }, [navigate, isAdminOrManager, isAgent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div className="sidebar-logo">
        {collapsed ? (
          <span className="logo-text">IBC</span>
        ) : (
          <div className="logo-full">
            <span className="logo-text">IBC</span>
            <span className="logo-subtitle">Insurance CRM</span>
          </div>
        )}
      </div>

      {/* Menu — light: the nav is an index, not a feature. Sizing and colour
          come from the theme and .sidebar-menu, not from props here. */}
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={collapsed ? [] : openKeys}
        items={menuItems}
        className="sidebar-menu"
        style={{ background: 'transparent', flex: 1 }}
      />

      {/* Version */}
      {!collapsed && (
        <div className="sidebar-version">
          v3.0.0 • Invic Business Corp
        </div>
      )}
    </div>
  );
};

export default Sidebar;
