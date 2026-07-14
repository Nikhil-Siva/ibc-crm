import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Row, Col, Card, Button, Select, DatePicker, Table, Typography, Space,
  Statistic, Tag, message, Spin, Tooltip, Empty, Divider
} from 'antd';
import {
  UserOutlined, DownloadOutlined, ClockCircleOutlined, LoginOutlined,
  LogoutOutlined, CoffeeOutlined, DashboardOutlined, FieldTimeOutlined,
  PercentageOutlined, CalendarOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../api/axios';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const NAVY = '#1f4d7a';
const SKY_BLUE = '#4a7fab';
const GREEN = '#52c41a';
const RED = '#f5222d';
const YELLOW = '#faad14';
const GREY = '#d9d9d9';

const RANGE_PRESETS = [
  { label: 'Today', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: 'Yesterday', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
  { label: 'Last 7 Days', value: [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: 'Last 30 Days', value: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')] },
];

const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  return dayjs(timeStr).format('HH:mm');
};

const LoginReport = () => {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(undefined);
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
  const [loginData, setLoginData] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [dayWiseData, setDayWiseData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [dayWiseLoading, setDayWiseLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/users');
      const data = res.data?.data || res.data;
      setAgents(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const buildParams = useCallback(() => {
    const params = {};
    if (selectedAgent && selectedAgent !== 'all') params.agent_id = selectedAgent;
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.start_date = dateRange[0].format('YYYY-MM-DD');
      params.end_date = dateRange[1].format('YYYY-MM-DD');
    }
    return params;
  }, [selectedAgent, dateRange]);

  const fetchLoginReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await api.get('/call-reports/agent-login', { params });
      const data = res.data?.data || res.data;
      setLoginData(data);
    } catch {
      setLoginData(null);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const params = buildParams();
      const res = await api.get('/call-reports/call-timeline', { params });
      const data = res.data?.data || res.data;
      setTimelineData(Array.isArray(data) ? data : []);
    } catch {
      setTimelineData([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [buildParams]);

  const fetchDayWise = useCallback(async () => {
    setDayWiseLoading(true);
    try {
      const params = buildParams();
      const res = await api.get('/call-reports/day-wise', { params });
      const data = res.data?.data || res.data;
      setDayWiseData(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setDayWiseData([]);
    } finally {
      setDayWiseLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchLoginReport();
    fetchTimeline();
    fetchDayWise();
  }, [fetchLoginReport, fetchTimeline, fetchDayWise]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams();
      const res = await api.get('/call-reports/export', {
        params: { ...params, report_type: 'login' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `login_report_${dayjs().format('YYYY-MM-DD_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Report exported successfully');
    } catch {
      message.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const hourlyChartData = useMemo(() => {
    if (timelineData.length > 0) {
      return timelineData.map((h) => ({
        hour: `${String(h.hour ?? h.time_slot ?? 0).padStart(2, '0')}:00`,
        connected: h.connected || 0,
        not_connected: h.not_connected || 0,
      }));
    }
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      connected: 0,
      not_connected: 0,
    }));
  }, [timelineData]);

  const dayWiseColumns = [
    {
      title: 'Date', dataIndex: 'date', key: 'date',
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '-',
    },
    {
      title: 'Calls Attempted', dataIndex: 'calls_attempted', key: 'calls_attempted',
      sorter: (a, b) => (a.calls_attempted || 0) - (b.calls_attempted || 0),
      render: (v) => <Text strong>{v || 0}</Text>,
    },
    {
      title: 'Connected', dataIndex: 'connected', key: 'connected',
      sorter: (a, b) => (a.connected || 0) - (b.connected || 0),
      render: (v) => <Tag color="green">{v || 0}</Tag>,
    },
    {
      title: 'Not Connected', dataIndex: 'not_connected', key: 'not_connected',
      sorter: (a, b) => (a.not_connected || 0) - (b.not_connected || 0),
      render: (v) => <Tag color="red">{v || 0}</Tag>,
    },
    {
      title: 'Breaks Taken', dataIndex: 'breaks_taken', key: 'breaks_taken',
      sorter: (a, b) => (a.breaks_taken || 0) - (b.breaks_taken || 0),
      render: (v) => v || 0,
    },
    {
      title: 'Time Logged In', dataIndex: 'time_logged_in', key: 'time_logged_in',
      sorter: (a, b) => (a.time_logged_in || 0) - (b.time_logged_in || 0),
      render: (v) => formatDuration(v),
    },
    {
      title: 'Working Time', dataIndex: 'working_time', key: 'working_time',
      sorter: (a, b) => (a.working_time || 0) - (b.working_time || 0),
      render: (v) => formatDuration(v),
    },
  ];

  // Agent Timeline rendering
  const renderAgentTimeline = () => {
    const segments = loginData?.timeline_segments || loginData?.segments;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      // Generate a sample timeline from login data
      const loginTime = loginData?.login_time ? dayjs(loginData.login_time) : null;
      const logoutTime = loginData?.logout_time ? dayjs(loginData.logout_time) : null;
      if (!loginTime || !logoutTime) {
        return <Empty description="No timeline data available" />;
      }

      const totalMinutes = logoutTime.diff(loginTime, 'minute');
      const workingMinutes = loginData?.net_working_time || (totalMinutes - (loginData?.break_time || 0));
      const breakMinutes = loginData?.break_time || 0;
      const offlineMinutes = Math.max(0, totalMinutes - workingMinutes - breakMinutes);

      const workingPct = totalMinutes > 0 ? (workingMinutes / totalMinutes) * 100 : 0;
      const breakPct = totalMinutes > 0 ? (breakMinutes / totalMinutes) * 100 : 0;
      const offlinePct = totalMinutes > 0 ? (offlineMinutes / totalMinutes) * 100 : 0;

      const generatedSegments = [
        {
          type: 'working',
          start: loginTime.format('HH:mm'),
          end: loginTime.add(workingMinutes * 0.5, 'minute').format('HH:mm'),
          pct: workingPct * 0.5,
          duration: formatDuration(workingMinutes * 0.5),
        },
        {
          type: 'break',
          start: loginTime.add(workingMinutes * 0.5, 'minute').format('HH:mm'),
          end: loginTime.add(workingMinutes * 0.5 + breakMinutes, 'minute').format('HH:mm'),
          pct: breakPct,
          duration: formatDuration(breakMinutes),
        },
        {
          type: 'working',
          start: loginTime.add(workingMinutes * 0.5 + breakMinutes, 'minute').format('HH:mm'),
          end: logoutTime.subtract(offlineMinutes, 'minute').format('HH:mm'),
          pct: workingPct * 0.5,
          duration: formatDuration(workingMinutes * 0.5),
        },
      ];

      if (offlineMinutes > 0) {
        generatedSegments.push({
          type: 'offline',
          start: logoutTime.subtract(offlineMinutes, 'minute').format('HH:mm'),
          end: logoutTime.format('HH:mm'),
          pct: offlinePct,
          duration: formatDuration(offlineMinutes),
        });
      }

      return renderTimelineBar(generatedSegments);
    }

    const totalDuration = segments.reduce((sum, s) => sum + (s.duration_minutes || s.duration || 0), 0);
    const processed = segments.map((s) => ({
      type: s.type || s.status || 'working',
      start: s.start_time ? formatTime(s.start_time) : s.start || '',
      end: s.end_time ? formatTime(s.end_time) : s.end || '',
      pct: totalDuration > 0 ? ((s.duration_minutes || s.duration || 0) / totalDuration) * 100 : 0,
      duration: formatDuration(s.duration_minutes || s.duration || 0),
    }));

    return renderTimelineBar(processed);
  };

  const renderTimelineBar = (segments) => {
    const colorMap = {
      working: GREEN,
      break: YELLOW,
      offline: GREY,
      idle: GREY,
    };

    const labelMap = {
      working: 'Working',
      break: 'Break',
      offline: 'Offline',
      idle: 'Idle',
    };

    return (
      <div>
        <div style={{
          position: 'relative',
          height: 40,
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          border: '1px solid #e8e8e8',
          marginBottom: 12,
        }}>
          {segments.map((seg, idx) => (
            <Tooltip
              key={idx}
              title={
                <div>
                  <div><strong>{labelMap[seg.type] || seg.type}</strong></div>
                  <div>{seg.start} — {seg.end}</div>
                  <div>Duration: {seg.duration}</div>
                </div>
              }
            >
              <div
                style={{
                  width: `${Math.max(seg.pct, 0.5)}%`,
                  height: '100%',
                  backgroundColor: colorMap[seg.type] || GREY,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: seg.pct > 5 ? 0 : 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {seg.pct > 10 && (
                  <Text style={{ fontSize: 11, color: seg.type === 'offline' ? '#666' : '#fff', fontWeight: 500 }}>
                    {labelMap[seg.type] || seg.type}
                  </Text>
                )}
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Legend */}
        <Space size={16}>
          {[
            { type: 'working', label: 'Working', color: GREEN },
            { type: 'break', label: 'Break', color: YELLOW },
            { type: 'offline', label: 'Offline', color: GREY },
          ].map((item) => (
            <Space key={item.type} size={4}>
              <div style={{
                width: 12, height: 12, borderRadius: 2,
                backgroundColor: item.color, display: 'inline-block',
              }} />
              <Text style={{ fontSize: 12 }}>{item.label}</Text>
            </Space>
          ))}
        </Space>
      </div>
    );
  };

  const arStatItems = useMemo(() => [
    {
      title: 'Login Time',
      value: loginData?.login_time ? formatTime(loginData.login_time) : '-',
      icon: <LoginOutlined />,
      color: GREEN,
    },
    {
      title: 'Logout Time',
      value: loginData?.logout_time ? formatTime(loginData.logout_time) : '-',
      icon: <LogoutOutlined />,
      color: RED,
    },
    {
      title: 'Total Time Logged In',
      value: formatDuration(loginData?.total_logged_in || loginData?.total_time_logged_in || 0),
      icon: <ClockCircleOutlined />,
      color: SKY_BLUE,
    },
    {
      title: 'Break Time',
      value: formatDuration(loginData?.break_time || 0),
      icon: <CoffeeOutlined />,
      color: YELLOW,
    },
    {
      title: 'Net Working Time',
      value: formatDuration(loginData?.net_working_time || 0),
      icon: <DashboardOutlined />,
      color: NAVY,
    },
    {
      title: 'Efficiency',
      value: loginData?.efficiency != null ? `${Number(loginData.efficiency).toFixed(1)}%` : '-',
      icon: <PercentageOutlined />,
      color: loginData?.efficiency >= 80 ? GREEN : loginData?.efficiency >= 50 ? YELLOW : RED,
    },
  ], [loginData]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24,
      }}>
        <Title level={3} style={{ color: NAVY, margin: 0 }}>
          <FieldTimeOutlined style={{ marginRight: 8 }} />
          Login Report
        </Title>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={exporting}
          style={{ background: NAVY, borderColor: NAVY }}
        >
          Export CSV
        </Button>
      </div>

      {/* Header Controls */}
      <Card bodyStyle={{ padding: '12px 24px' }} style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
              <UserOutlined style={{ marginRight: 4 }} /> Agent
            </Text>
            <Select
              placeholder="Select agent"
              value={selectedAgent}
              onChange={setSelectedAgent}
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              <Option value="all">All Agents</Option>
              {agents.map((a) => (
                <Option key={a.id} value={a.id}>{a.name || a.full_name || a.email}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={10} md={8}>
            <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
              <CalendarOutlined style={{ marginRight: 4 }} /> Date Range
            </Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              presets={RANGE_PRESETS}
              style={{ width: '100%' }}
              format="DD MMM YYYY"
            />
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {/* AR Report Panel */}
        <Card
          title={<Text strong style={{ color: NAVY }}>Agent Report Summary</Text>}
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            {arStatItems.map((item, idx) => (
              <Col xs={12} sm={8} md={4} key={idx}>
                <Card
                  bodyStyle={{ padding: 16, textAlign: 'center' }}
                  style={{ borderTop: `3px solid ${item.color}` }}
                >
                  <div style={{ fontSize: 24, color: item.color, marginBottom: 8 }}>{item.icon}</div>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    {item.title}
                  </Text>
                  <Text strong style={{ fontSize: 18, color: item.color }}>{item.value}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>

        {/* Agent Timeline */}
        <Card
          title={<Text strong style={{ color: NAVY }}>Agent Timeline</Text>}
          style={{ marginBottom: 24 }}
        >
          {renderAgentTimeline()}
        </Card>
      </Spin>

      {/* Hourly Breakdown Chart */}
      <Card
        title={<Text strong style={{ color: NAVY }}>Hourly Call Breakdown</Text>}
        style={{ marginBottom: 24 }}
        loading={timelineLoading}
      >
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={hourlyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" interval={2} fontSize={11} />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="connected" name="Connected" fill={GREEN} />
            <Bar dataKey="not_connected" name="Not Connected" fill={RED} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Day-wise Summary Table */}
      <Card
        title={<Text strong style={{ color: NAVY }}>Day-wise Summary</Text>}
        style={{ marginBottom: 24 }}
        loading={dayWiseLoading}
      >
        <Table
          columns={dayWiseColumns}
          dataSource={dayWiseData}
          rowKey={(r) => r.date || r.id || Math.random()}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50', '100'],
            defaultPageSize: 10,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} days`,
          }}
          scroll={{ x: 800 }}
          size="middle"
          locale={{ emptyText: <Empty description="No day-wise data available" /> }}
        />
      </Card>
    </div>
  );
};

export default LoginReport;
