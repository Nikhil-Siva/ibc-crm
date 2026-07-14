import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Button, List, Avatar, Typography, Space, Tag,
  Tooltip, Spin, Progress
} from 'antd';
import {
  UserAddOutlined, PhoneOutlined, CheckCircleOutlined, CloseCircleOutlined,
  TeamOutlined, RiseOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CloudUploadOutlined, RocketOutlined, BarChartOutlined, NodeIndexOutlined,
  ThunderboltOutlined, MessageOutlined, SwapOutlined, FormOutlined,
  PlusCircleOutlined, UserOutlined, CrownOutlined, ReloadOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const STAT_CARDS_CONFIG = [
  {
    key: 'totalLeadsToday',
    label: 'Total Leads Today',
    icon: UserAddOutlined,
    color: '#1890ff',
    trendKey: 'totalLeadsTodayChange',
  },
  {
    key: 'totalCallsAttempted',
    label: 'Total Calls Attempted',
    icon: PhoneOutlined,
    color: '#722ed1',
    trendKey: 'totalCallsAttemptedChange',
  },
  {
    key: 'totalCallsConnected',
    label: 'Total Calls Connected',
    icon: CheckCircleOutlined,
    color: '#52c41a',
    trendKey: 'totalCallsConnectedChange',
  },
  {
    key: 'totalCallsNotConnected',
    label: 'Total Calls Not Connected',
    icon: CloseCircleOutlined,
    color: '#f5222d',
    trendKey: 'totalCallsNotConnectedChange',
  },
  {
    key: 'activeAgentsRightNow',
    label: 'Active Agents Right Now',
    icon: TeamOutlined,
    color: '#13c2c2',
    trendKey: 'activeAgentsRightNowChange',
  },
  {
    key: 'leadsConvertedThisMonth',
    label: 'Leads Converted This Month',
    icon: RiseOutlined,
    color: '#fa8c16',
    trendKey: 'leadsConvertedThisMonthChange',
  },
];

const SHORTCUT_BUTTONS = [
  { label: 'Upload Contacts', path: '/contact-import', icon: CloudUploadOutlined, color: '#1890ff' },
  { label: 'Create Campaign', path: '/campaigns', icon: RocketOutlined, color: '#722ed1' },
  { label: 'View Reports', path: '/reports/calls', icon: BarChartOutlined, color: '#52c41a' },
  { label: 'Manage Pipelines', path: '/pipelines', icon: NodeIndexOutlined, color: '#13c2c2' },
  { label: 'Workflow Builder', path: '/workflows', icon: ThunderboltOutlined, color: '#fa8c16' },
  { label: 'SMS Automation', path: '/sms-automation', icon: MessageOutlined, color: '#f5222d' },
];

const ACTION_ICON_MAP = {
  call_made: PhoneOutlined,
  lead_status_changed: SwapOutlined,
  form_submitted: FormOutlined,
  lead_created: PlusCircleOutlined,
};

const ACTION_COLOR_MAP = {
  call_made: '#722ed1',
  lead_status_changed: '#fa8c16',
  form_submitted: '#13c2c2',
  lead_created: '#52c41a',
};


const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [activities, setActivities] = useState([]);
  const [topAgents, setTopAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/dashboard/stats');
      const data = res.data?.data || res.data || {};
      setStats(data);
    } catch {
      setStats({});
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await api.get('/admin/dashboard/activity');
      const data = res.data?.data || res.data || [];
      setActivities(Array.isArray(data) ? data.slice(0, 20) : []);
    } catch {
      setActivities([]);
    }
  }, []);

  const fetchTopAgents = useCallback(async () => {
    try {
      const res = await api.get('/admin/dashboard/top-agents');
      const data = res.data?.data || res.data || [];
      setTopAgents(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch {
      setTopAgents([]);
    }
  }, []);

  const fetchAll = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    await Promise.all([fetchStats(), fetchActivity(), fetchTopAgents()]);
    setLoading(false);
    if (isManualRefresh) setRefreshing(false);
  }, [fetchStats, fetchActivity, fetchTopAgents]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(), 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const renderTrend = (changeValue) => {
    const val = typeof changeValue === 'number' ? changeValue : 0;
    if (val === 0) return null;
    const isPositive = val > 0;
    return (
      <span style={{
        fontSize: 'var(--t-xs)',
        fontWeight: 500,
        color: isPositive ? 'var(--c-success)' : 'var(--c-danger)',
      }}>
        {isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        {' '}{Math.abs(val)}% vs yesterday
      </span>
    );
  };

  const maxConnected = topAgents.length > 0
    ? Math.max(...topAgents.map((a) => a.callsConnected || a.calls_connected || 0), 1)
    : 1;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24,
      }}>
        <div>
          <h1 className="page-header-title">Dashboard</h1>
          <Text type="secondary" style={{ fontSize: 'var(--t-sm)' }}>
            Auto-refreshes every 60s · Updated {dayjs().format('h:mm A')}
          </Text>
        </div>
        <Tooltip title="Refresh now">
          <Button
            type="primary"
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={() => fetchAll(true)}
            loading={refreshing}
          >
            Refresh
          </Button>
        </Tooltip>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {STAT_CARDS_CONFIG.map((cfg) => {
          const value = stats[cfg.key] ?? 0;
          const change = stats[cfg.trendKey] ?? 0;
          return (
            <Col xs={24} sm={12} md={8} lg={4} key={cfg.key}>
              {/* Label, figure, trend — in reading order. The 44px coloured
                  icon tile and the gradient fill carried no information and
                  competed with the number, which is the point of the card. */}
              <Card className="kpi-card" style={{ height: '100%' }} bodyStyle={{ padding: 'var(--s-4)' }}>
                <div className="kpi-label">{cfg.label}</div>
                <div className="kpi-value">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                <div className="kpi-trend">{renderTrend(change)}</div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Quick Shortcut Buttons */}
      <Card style={{ marginBottom: 'var(--s-5)' }} bodyStyle={{ padding: 'var(--s-4) var(--s-5)' }}>
        <Text strong style={{ fontSize: 'var(--t-base)', display: 'block', marginBottom: 'var(--s-3)' }}>
          Quick actions
        </Text>
        <Row gutter={[8, 8]}>
          {SHORTCUT_BUTTONS.map((btn) => {
            const IconComp = btn.icon;
            return (
              <Col xs={12} sm={8} md={4} key={btn.path}>
                {/* Was six saturated circles, each a different hue, lifting on
                    hover. Six equally-weighted shortcuts don't need six colours
                    to be told apart — the labels already do that. */}
                <button
                  type="button"
                  className="quick-action"
                  onClick={() => navigate(btn.path)}
                >
                  <IconComp className="quick-action-icon" />
                  <span className="quick-action-label">{btn.label}</span>
                </button>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* Bottom Two-Column Section */}
      <Row gutter={[16, 16]}>
        {/* Left — Recent Activity Feed */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#52c41a',
                  display: 'inline-block', animation: 'pulse 2s infinite',
                }} />
                <Text strong style={{ color: 'var(--c-accent)', fontSize: 15 }}>Recent Activity</Text>
                <Tag color="blue" style={{ borderRadius: 10, fontSize: 11 }}>Live</Tag>
              </Space>
            }
            style={{
              border: 'none', height: '100%',
            }}
            bodyStyle={{ padding: '0 12px 12px', maxHeight: 460, overflowY: 'auto' }}
          >
            <List
              dataSource={activities}
              locale={{ emptyText: 'No recent activity' }}
              renderItem={(item) => {
                const action = item.action || '';
                const ActionIcon = ACTION_ICON_MAP[action] || UserOutlined;
                // The audit endpoint includes the actor under the 'user' alias
                // (models/index.js). Reading item.userName showed "Unknown" for
                // every row.
                const userName = item.user?.name || item.userName || item.user_name || 'System';
                const entity = item.entity || '';
                const createdAt = item.createdAt || item.created_at || item.timestamp;
                const timeAgo = createdAt ? dayjs(createdAt).fromNow() : '';
                const actionLabel = action.replace(/_/g, ' ');

                return (
                  <List.Item style={{ padding: 'var(--s-2)', borderBottom: '1px solid var(--c-border)' }}>
                    <List.Item.Meta
                      avatar={
                        // One neutral treatment: a four-colour icon per action
                        // type turned an audit list into a fruit salad.
                        <Avatar
                          size={28}
                          style={{ background: 'var(--c-neutral-100)', color: 'var(--c-text-secondary)' }}
                          icon={<ActionIcon />}
                        />
                      }
                      title={
                        <Text style={{ fontSize: 'var(--t-sm)', fontWeight: 500 }}>
                          {userName}{' '}
                          <Text type="secondary" style={{ fontWeight: 400 }}>{actionLabel}</Text>
                        </Text>
                      }
                      description={
                        <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                          {entity}{entity && timeAgo ? ' · ' : ''}{timeAgo}
                        </Text>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>

        {/* Right — Top Agents Widget */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <CrownOutlined style={{ color: '#faad14', fontSize: 18 }} />
                <Text strong style={{ color: 'var(--c-accent)', fontSize: 15 }}>Top Agents</Text>
                <Tag color="gold" style={{ borderRadius: 10, fontSize: 11 }}>This Week</Tag>
              </Space>
            }
            style={{
              border: 'none', height: '100%',
            }}
            bodyStyle={{ padding: '8px 16px 16px' }}
          >
            {topAgents.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: '#8c8c8c' }}>
                No agent data available
              </div>
            )}
            {topAgents.map((agent, idx) => {
              const name = agent.name || agent.agentName || agent.agent_name || 'Agent';
              const connected = agent.callsConnected || agent.calls_connected || 0;
              const percent = Math.round((connected / maxConnected) * 100);
              return (
                <div
                  key={agent.id || idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
                    padding: 'var(--s-3) 0',
                    borderBottom: idx < topAgents.length - 1 ? '1px solid var(--c-border)' : 'none',
                  }}
                >
                  {/* Rank — the list is already ordered, so the number just
                      confirms position. Gold/silver/bronze medals were noise. */}
                  <div style={{
                    width: 20, flexShrink: 0,
                    color: 'var(--c-text-muted)',
                    fontSize: 'var(--t-xs)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {idx + 1}
                  </div>

                  {/* Agent Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text
                        ellipsis
                        style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-accent)', maxWidth: '60%' }}
                      >
                        {name}
                      </Text>
                      <Tag
                        style={{
                          borderRadius: 8, fontWeight: 600, fontSize: 11,
                          background: idx === 0 ? '#fff7e6' : '#f6f6f6',
                          color: idx === 0 ? '#fa8c16' : '#596579',
                          border: 'none',
                        }}
                      >
                        {connected} calls
                      </Tag>
                    </div>
                    <Progress
                      percent={percent}
                      showInfo={false}
                      strokeColor={idx === 0 ? { from: '#faad14', to: '#fa8c16' } : { from: 'var(--c-accent)', to: 'var(--c-accent)' }}
                      trailColor="#f0f0f0"
                      size="small"
                      style={{ margin: 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        </Col>
      </Row>

      {/* Inline pulse animation */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
