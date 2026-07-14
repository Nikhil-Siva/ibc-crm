import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Button, Typography, Tag, List, Empty, Tooltip, Spin, Avatar,
} from 'antd';
import {
  UsergroupAddOutlined,
  PlusCircleOutlined,
  CalendarOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ─── Outcome tag colors ───────────────────────────────────────────────────────
const OUTCOME_COLORS = {
  interested: 'green',
  not_interested: 'red',
  callback: 'orange',
  converted: 'green',
  no_answer: 'default',
  busy: 'gold',
  wrong_number: 'red',
  default: 'blue',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
// Was a 36px figure on one of seven saturated gradients, lifting 3px on hover.
// An agent reads these dozens of times a day; the figure should be the only
// thing competing for attention. `gradient` is still accepted and ignored so
// call sites didn't all need touching.
const StatCard = ({ label, value }) => (
  <Card className="kpi-card" style={{ height: '100%' }} bodyStyle={{ padding: 'var(--s-4)' }}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value ?? 0}</div>
  </Card>
);

// ─── Quick Action Button ──────────────────────────────────────────────────────
const QuickAction = ({ label, icon, onClick }) => (
  <button type="button" className="quick-action" onClick={onClick}>
    <span className="quick-action-icon">{icon}</span>
    <span className="quick-action-label">{label}</span>
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const TelecallerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({});
  const [recentCalls, setRecentCalls] = useState([]);
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard/telecaller');
      const data = res.data?.data || res.data;
      setStats(data?.stats || {});
      setRecentCalls(data?.recentCalls || []);
      setTodayFollowups(data?.todayFollowups || []);
      setLastRefreshed(dayjs());
    } catch (err) {
      console.error('[TelecallerDashboard] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const firstLetter = (name) => (name ? name.charAt(0).toUpperCase() : '?');

  return (
    /* Layout already supplies the page padding and background. */
    <div>

      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <Row align="middle" justify="space-between" gutter={[8, 8]} style={{ marginBottom: 'var(--s-5)' }}>
        <Col>
          <h1 className="page-header-title">My dashboard</h1>
          <Text type="secondary" style={{ fontSize: 'var(--t-sm)' }}>
            Welcome back, <strong>{user?.name || 'Telecaller'}</strong>
            {lastRefreshed && ` · Refreshed ${lastRefreshed.fromNow()}`}
          </Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PhoneOutlined />}
            onClick={() => navigate('/leads')}
            style={{ marginRight: 'var(--s-2)' }}
          >
            Log a Call
          </Button>
          <Tooltip title="Refresh dashboard">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchDashboard}
              loading={loading}
            />
          </Tooltip>
        </Col>
      </Row>

      <Spin spinning={loading} tip="Refreshing...">

        {/* ─── Stats Row 1 (4 cards) ───────────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              icon={<UsergroupAddOutlined />}
              label="Total Assigned Leads"
              value={stats.totalAssigned}
            />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              icon={<PlusCircleOutlined />}
              label="New Leads"
              value={stats.newLeads}
            />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              icon={<CalendarOutlined />}
              label="Follow-ups Today"
              value={stats.followupsToday}
            />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              icon={<PhoneOutlined />}
              label="Calls Made Today"
              value={stats.callsToday}
            />
          </Col>
        </Row>

        {/* ─── Stats Row 2 (3 cards) ───────────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={8} md={8}>
            <StatCard
              icon={<CheckCircleOutlined />}
              label="Converted"
              value={stats.converted}
            />
          </Col>
          <Col xs={12} sm={8} md={8}>
            <StatCard
              icon={<CloseCircleOutlined />}
              label="Not Interested"
              value={stats.notInterested}
            />
          </Col>
          <Col xs={12} sm={8} md={8}>
            <StatCard
              icon={<ClockCircleOutlined />}
              label="Pending Leads"
              value={stats.pendingLeads}
            />
          </Col>
        </Row>

        {/* ─── Quick Actions ───────────────────────────────────────────────── */}
        <Card
          bordered={false}
          style={{ marginBottom: 'var(--s-5)' }}
          bodyStyle={{ padding: 'var(--s-4) var(--s-5)' }}
        >
          <Text strong style={{ fontSize: 'var(--t-base)', display: 'block', marginBottom: 16 }}>
            Quick Actions
          </Text>
          <Row gutter={16}>
            <Col xs={12} sm={12} md={6}>
              <QuickAction
                label="View My Leads"
                icon={<UsergroupAddOutlined />}
                onClick={() => navigate('/leads')}
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <QuickAction
                label="Add New Lead"
                icon={<PlusCircleOutlined />}
                onClick={() => navigate('/leads')}
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <QuickAction
                label="My Follow-ups"
                icon={<CalendarOutlined />}
                onClick={() => navigate('/followups')}
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <QuickAction
                label="Schedule Follow-up"
                icon={<ClockCircleOutlined />}
                onClick={() => navigate('/followups')}
              />
            </Col>
          </Row>
        </Card>

        {/* ─── Bottom Two Columns ──────────────────────────────────────────── */}
        <Row gutter={[16, 16]}>

          {/* Today's Followups */}
          <Col span={14}>
            <Card
              bordered={false}
              style={{ height: '100%' }}
              title={
                <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
                  <CalendarOutlined style={{ marginRight: 8, color: 'var(--c-accent)' }} />
                  Today's Follow-ups
                  <Tag color="orange" style={{ marginLeft: 10, fontSize: 11 }}>
                    {todayFollowups.length}
                  </Tag>
                </span>
              }
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate('/followups')}
                  icon={<ArrowRightOutlined />}
                  style={{ color: 'var(--c-accent)' }}
                >
                  View All
                </Button>
              }
            >
              {todayFollowups.length === 0 ? (
                <Empty
                  description="No follow-ups scheduled for today 🎉"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <List
                  dataSource={todayFollowups}
                  renderItem={(item) => (
                    <List.Item
                      key={item.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/leads/${item.leadId || item.id}`)}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ background: 'var(--c-accent)', color: '#fff', fontWeight: 600 }}>
                            {firstLetter(item.leadName || item.name)}
                          </Avatar>
                        }
                        title={
                          <Text strong style={{ color: 'var(--c-accent)', fontSize: 14 }}>
                            {item.leadName || item.name || 'Unknown'}
                          </Text>
                        }
                        description={
                          <span style={{ fontSize: 12, color: '#888' }}>
                            📱 {item.mobile || '—'} &nbsp;·&nbsp;
                            🕐 {item.scheduledAt ? dayjs(item.scheduledAt).format('hh:mm A') : '—'}
                          </span>
                        }
                      />
                      <Tag
                        color={item.status === 'pending' ? 'orange' : item.status === 'done' ? 'green' : 'default'}
                        style={{ borderRadius: 20, fontSize: 11 }}
                      >
                        {item.status || 'Pending'}
                      </Tag>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          {/* Recent Calls */}
          <Col span={10}>
            <Card
              bordered={false}
              style={{ height: '100%' }}
              title={
                <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
                  <PhoneOutlined style={{ marginRight: 8, color: 'var(--c-accent)' }} />
                  Recent Calls
                </span>
              }
            >
              {recentCalls.length === 0 ? (
                <Empty
                  description="No recent calls"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <List
                  dataSource={recentCalls}
                  renderItem={(item) => (
                    <List.Item
                      key={item.id}
                      style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ background: 'var(--c-accent)', color: '#fff', fontWeight: 600 }} size="small">
                            {firstLetter(item.leadName || item.name)}
                          </Avatar>
                        }
                        title={
                          <Text strong style={{ color: 'var(--c-accent)', fontSize: 13 }}>
                            {item.leadName || item.name || 'Unknown'}
                          </Text>
                        }
                        description={
                          <span style={{ fontSize: 11, color: '#aaa' }}>
                            {formatDuration(item.duration)} &nbsp;·&nbsp; {item.calledAt ? dayjs(item.calledAt).fromNow() : '—'}
                          </span>
                        }
                      />
                      <Tag
                        color={OUTCOME_COLORS[item.outcome] || OUTCOME_COLORS.default}
                        style={{ borderRadius: 20, fontSize: 11, textTransform: 'capitalize' }}
                      >
                        {(item.outcome || 'unknown').replace(/_/g, ' ')}
                      </Tag>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>

      </Spin>
    </div>
  );
};

export default TelecallerDashboard;
