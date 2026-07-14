import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Row, Col, Card, Button, Select, DatePicker, Table, Typography, Space,
  Statistic, Tag, message, Spin, Tooltip, Empty
} from 'antd';
import {
  PhoneOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  UserOutlined, DownloadOutlined, BarChartOutlined, FilterOutlined,
  ReloadOutlined, TeamOutlined, ClockCircleOutlined, RiseOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import api from '../api/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const NAVY = '#1f4d7a';
const SKY_BLUE = '#4a7fab';
const GREEN = '#52c41a';
const RED = '#f5222d';
const ORANGE = '#fa8c16';
const YELLOW = '#faad14';

const RANGE_PRESETS = [
  { label: 'Today', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: 'Yesterday', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
  { label: 'Last 7 Days', value: [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: 'Last 30 Days', value: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')] },
];

const CallReport = () => {
  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
  const [selectedCampaign, setSelectedCampaign] = useState(undefined);
  const [summary, setSummary] = useState(null);
  const [agentData, setAgentData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [hourlyData, setHourlyData] = useState({});
  const [hourlyLoading, setHourlyLoading] = useState({});

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/users');
      const data = res.data?.data || res.data;
      setAgents(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setAgents([]);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/campaigns');
      const data = res.data?.data || res.data;
      setCampaigns(Array.isArray(data) ? data : (data?.rows || []));
    } catch {
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchCampaigns();
  }, [fetchAgents, fetchCampaigns]);

  const buildParams = useCallback(() => {
    const params = {};
    if (selectedAgents.length > 0) params.agent_ids = selectedAgents.join(',');
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.start_date = dateRange[0].format('YYYY-MM-DD');
      params.end_date = dateRange[1].format('YYYY-MM-DD');
    }
    if (selectedCampaign) params.campaign_id = selectedCampaign;
    return params;
  }, [selectedAgents, dateRange, selectedCampaign]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await api.get('/call-reports/user-call', { params });
      const data = res.data?.data || res.data;

      if (data?.summary) {
        setSummary(data.summary);
      } else if (data && !Array.isArray(data)) {
        setSummary({
          total_attempted: data.total_attempted || 0,
          connected: data.connected || 0,
          not_connected: data.not_connected || 0,
          in_progress: data.in_progress || 0,
          new_leads: data.new_leads || 0,
          conversion_rate: data.conversion_rate || 0,
        });
      }

      if (data?.agents) {
        setAgentData(data.agents);
      } else if (Array.isArray(data)) {
        setAgentData(data);
      } else if (data?.rows) {
        setAgentData(data.rows);
      } else {
        setAgentData([]);
      }
    } catch {
      message.error('Failed to fetch call report');
      setSummary(null);
      setAgentData([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const fetchHourlyBreakdown = useCallback(async (agentId, date) => {
    const key = `${agentId}_${date}`;
    setHourlyLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await api.get('/call-reports/call-timeline', {
        params: { agent_id: agentId, date: date || dateRange?.[0]?.format('YYYY-MM-DD') },
      });
      const data = res.data?.data || res.data;
      setHourlyData((prev) => ({ ...prev, [agentId]: Array.isArray(data) ? data : [] }));
    } catch {
      setHourlyData((prev) => ({ ...prev, [agentId]: [] }));
    } finally {
      setHourlyLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, [dateRange]);

  const handleExpand = (expanded, record) => {
    if (expanded) {
      setExpandedRowKeys([record.agent_id || record.id || record.user_id]);
      fetchHourlyBreakdown(record.agent_id || record.id || record.user_id, dateRange?.[0]?.format('YYYY-MM-DD'));
    } else {
      setExpandedRowKeys([]);
    }
  };

  const handleApply = () => {
    fetchReport();
  };

  const handleReset = () => {
    setSelectedAgents([]);
    setDateRange([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
    setSelectedCampaign(undefined);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams();
      const res = await api.get('/call-reports/export', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `call_report_${dayjs().format('YYYY-MM-DD_HHmm')}.csv`);
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

  const summaryCards = useMemo(() => [
    { title: 'Total Calls Attempted', value: summary?.total_attempted || 0, icon: <PhoneOutlined />, color: NAVY },
    { title: 'Connected', value: summary?.connected || 0, icon: <CheckCircleOutlined />, color: GREEN },
    { title: 'Not Connected', value: summary?.not_connected || 0, icon: <CloseCircleOutlined />, color: RED },
    { title: 'In Progress', value: summary?.in_progress || 0, icon: <SyncOutlined />, color: ORANGE },
    { title: 'New Leads', value: summary?.new_leads || 0, icon: <UserOutlined />, color: SKY_BLUE },
    { title: 'Conversion Rate', value: summary?.conversion_rate || 0, icon: <RiseOutlined />, color: GREEN, suffix: '%', precision: 1 },
  ], [summary]);

  const columns = [
    {
      title: 'Agent Name', dataIndex: 'agent_name', key: 'agent_name',
      sorter: (a, b) => (a.agent_name || '').localeCompare(b.agent_name || ''),
      render: (v, r) => (
        <Space>
          <UserOutlined style={{ color: SKY_BLUE }} />
          <Text strong>{v || r.name || r.full_name || 'Unknown'}</Text>
        </Space>
      ),
    },
    {
      title: 'Total Attempted', dataIndex: 'total_attempted', key: 'total_attempted',
      sorter: (a, b) => (a.total_attempted || 0) - (b.total_attempted || 0),
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
      title: 'In Progress', dataIndex: 'in_progress', key: 'in_progress',
      sorter: (a, b) => (a.in_progress || 0) - (b.in_progress || 0),
      render: (v) => <Tag color="orange">{v || 0}</Tag>,
    },
    {
      title: 'Leads Created', dataIndex: 'leads_created', key: 'leads_created',
      sorter: (a, b) => (a.leads_created || 0) - (b.leads_created || 0),
      render: (v) => v || 0,
    },
    {
      title: 'Avg Call Duration', dataIndex: 'avg_call_duration', key: 'avg_call_duration',
      sorter: (a, b) => (a.avg_call_duration || 0) - (b.avg_call_duration || 0),
      render: (v) => {
        if (!v) return '-';
        const mins = Math.floor(v / 60);
        const secs = Math.round(v % 60);
        return `${mins}m ${secs}s`;
      },
    },
    {
      title: 'Last Active', dataIndex: 'last_active', key: 'last_active',
      sorter: (a, b) => dayjs(a.last_active || 0).unix() - dayjs(b.last_active || 0).unix(),
      render: (v) => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '-',
    },
  ];

  const expandedRowRender = (record) => {
    const agentKey = record.agent_id || record.id || record.user_id;
    const data = hourlyData[agentKey] || [];
    const isLoading = hourlyLoading[`${agentKey}_${dateRange?.[0]?.format('YYYY-MM-DD')}`];

    if (isLoading) return <Spin style={{ padding: 24 }} />;

    if (data.length === 0) return <Empty description="No hourly data available" />;

    const hourlyColumns = [
      { title: 'Hour', dataIndex: 'hour', key: 'hour', render: (v) => `${String(v).padStart(2, '0')}:00 - ${String(v).padStart(2, '0')}:59` },
      { title: 'Attempted', dataIndex: 'attempted', key: 'attempted' },
      { title: 'Connected', dataIndex: 'connected', key: 'connected', render: (v) => <Tag color="green">{v || 0}</Tag> },
      { title: 'Not Connected', dataIndex: 'not_connected', key: 'not_connected', render: (v) => <Tag color="red">{v || 0}</Tag> },
      { title: 'In Progress', dataIndex: 'in_progress', key: 'in_progress', render: (v) => <Tag color="orange">{v || 0}</Tag> },
    ];

    return (
      <Table
        columns={hourlyColumns}
        dataSource={data}
        pagination={false}
        size="small"
        rowKey={(r) => r.hour ?? r.id}
      />
    );
  };

  const chartData = useMemo(() => {
    return agentData.map((a) => ({
      name: a.agent_name || a.name || a.full_name || 'Unknown',
      connected: a.connected || 0,
      not_connected: a.not_connected || 0,
      in_progress: a.in_progress || 0,
    }));
  }, [agentData]);

  const timelineData = useMemo(() => {
    const allHourly = Object.values(hourlyData).flat();
    if (allHourly.length === 0) {
      return Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, '0')}:00`,
        calls: 0,
      }));
    }
    const grouped = {};
    allHourly.forEach((h) => {
      const key = `${String(h.hour).padStart(2, '0')}:00`;
      if (!grouped[key]) grouped[key] = 0;
      grouped[key] += (h.attempted || h.connected || 0);
    });
    return Array.from({ length: 24 }, (_, i) => {
      const key = `${String(i).padStart(2, '0')}:00`;
      return { hour: key, calls: grouped[key] || 0 };
    });
  }, [hourlyData]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24
      }}>
        <Title level={3} style={{ color: NAVY, margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Call Report
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

      {/* Filters Bar */}
      <Card
        style={{
          marginBottom: 24,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
        bodyStyle={{ padding: '12px 24px' }}
      >
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={7}>
            <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
              <TeamOutlined style={{ marginRight: 4 }} /> Agents
            </Text>
            <Select
              mode="multiple"
              placeholder="Select agents"
              value={selectedAgents}
              onChange={setSelectedAgents}
              style={{ width: '100%' }}
              allowClear
              maxTagCount={2}
              showSearch
              optionFilterProp="children"
            >
              {agents.map((a) => (
                <Option key={a.id} value={a.id}>{a.name || a.full_name || a.email}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} /> Date Range
            </Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              presets={RANGE_PRESETS}
              style={{ width: '100%' }}
              format="DD MMM YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
              <FilterOutlined style={{ marginRight: 4 }} /> Campaign
            </Text>
            <Select
              placeholder="Select campaign"
              value={selectedCampaign}
              onChange={setSelectedCampaign}
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {campaigns.map((c) => (
                <Option key={c.id} value={c.id}>{c.name || c.title}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={5} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 20 }}>
            <Button type="primary" icon={<FilterOutlined />} onClick={handleApply} style={{ background: SKY_BLUE, borderColor: SKY_BLUE }}>
              Apply
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {/* Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {summaryCards.map((card, idx) => (
            <Col xs={12} sm={8} md={4} key={idx}>
              <Card bodyStyle={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: card.color, marginBottom: 8 }}>{card.icon}</div>
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>{card.title}</Text>}
                  value={card.value}
                  suffix={card.suffix}
                  precision={card.precision}
                  valueStyle={{ color: card.color, fontSize: 22 }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Agent-wise Data Table */}
        <Card
          title={<Text strong style={{ color: NAVY }}>Agent-wise Call Data</Text>}
          style={{ marginBottom: 24 }}
        >
          <Table
            columns={columns}
            dataSource={agentData}
            rowKey={(r) => r.agent_id || r.id || r.user_id || Math.random()}
            pagination={{
              showSizeChanger: true,
              pageSizeOptions: ['10', '25', '50', '100'],
              defaultPageSize: 10,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} agents`,
            }}
            expandable={{
              expandedRowRender,
              expandedRowKeys,
              onExpand: handleExpand,
            }}
            scroll={{ x: 900 }}
            size="middle"
            locale={{ emptyText: <Empty description="No agent data available" /> }}
          />
        </Card>

        {/* Charts Section */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card title={<Text strong style={{ color: NAVY }}>Call Outcomes per Agent</Text>}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} fontSize={11} />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="connected" name="Connected" stackId="a" fill={GREEN} />
                    <Bar dataKey="not_connected" name="Not Connected" stackId="a" fill={RED} />
                    <Bar dataKey="in_progress" name="In Progress" stackId="a" fill={YELLOW} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No data to display" style={{ padding: 60 }} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={<Text strong style={{ color: NAVY }}>Calls Over Time</Text>}>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" interval={2} fontSize={11} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="calls" name="Calls" stroke={SKY_BLUE} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default CallReport;
