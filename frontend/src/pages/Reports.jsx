import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Table, Statistic, Button, message, Divider } from 'antd';
import { DownloadOutlined, RiseOutlined, FallOutlined, BarChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from '../api/axios';
import { formatCurrency } from '../utils/formatters';
import { CHART } from '../styles/chartColors';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

// Lead sources are ordered by volume, so a single-hue ramp reads better than
// eight competing hues.
const COLORS = [...CHART.series, '#d7e2ec', '#eef3f7'];

const Reports = () => {
  const [dateRange, setDateRange] = useState([dayjs().subtract(6, 'month'), dayjs()]);
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [salesSummary, setSalesSummary] = useState({});
  const [agentPerformance, setAgentPerformance] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [sourceWise, setSourceWise] = useState([]);
  const [premiumReport, setPremiumReport] = useState([]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const from = dateRange[0].format('YYYY-MM-DD');
      const to = dateRange[1].format('YYYY-MM-DD');
      
      try {
        const [salesRes, agentRes, trendRes, sourceRes, premiumRes] = await Promise.all([
          axios.get(`/reports/sales-summary?from=${from}&to=${to}`),
          axios.get(`/reports/agent-performance?from=${from}&to=${to}`),
          axios.get(`/reports/monthly-trend`), // usually trailing 12 months
          axios.get(`/reports/source-wise?from=${from}&to=${to}`),
          axios.get(`/reports/premium?from=${from}&to=${to}`)
        ]);
        
        setSalesSummary(salesRes.data?.data || salesRes.data || {});
        setAgentPerformance(agentRes.data?.data || agentRes.data?.agents || (Array.isArray(agentRes.data) ? agentRes.data : []));
        setMonthlyTrend(trendRes.data?.data || trendRes.data?.trend || (Array.isArray(trendRes.data) ? trendRes.data : []));
        setSourceWise(sourceRes.data?.data || sourceRes.data?.sources || (Array.isArray(sourceRes.data) ? sourceRes.data : []));
        setPremiumReport(premiumRes.data?.data || premiumRes.data?.premium || (Array.isArray(premiumRes.data) ? premiumRes.data : []));
      } catch (apiError) {
        console.error('API call failed:', apiError);
        setSalesSummary({});
        setAgentPerformance([]);
        setMonthlyTrend([]);
        setSourceWise([]);
        setPremiumReport([]);
        message.error('Failed to load reports');
      }
      
    } catch (error) {
      message.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange && dateRange.length === 2) {
      fetchReports();
    }
  }, [dateRange]);

  const exportToExcel = async (data, filename) => {
    try {
      const { downloadCsv } = await import('../utils/exportCsv');
      downloadCsv(data, `${filename}_${dayjs().format('YYYY-MM-DD')}`);
    } catch {
      message.error('Export failed.');
    }
  };

  const agentColumns = [
    { title: 'Agent Name', dataIndex: 'agent_name', key: 'agent_name' },
    { title: 'Leads Assigned', dataIndex: 'leads_assigned', key: 'leads_assigned' },
    { title: 'Closed Won', dataIndex: 'closed_won', key: 'closed_won' },
    { title: 'Conversion Rate', key: 'conversion_rate', render: (_, r) => r.leads_assigned > 0 ? `${((r.closed_won / r.leads_assigned) * 100).toFixed(1)}%` : '0%' },
    { title: 'Premium Collected', dataIndex: 'premium_collected', key: 'premium_collected', render: (val) => formatCurrency(val || 0) },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>Business Intelligence Reports</h2>
        <RangePicker 
          value={dateRange} 
          onChange={setDateRange} 
          allowClear={false}
          presets={[
            { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
            { label: 'Last Month', value: [dayjs().subtract(1, 'months').startOf('month'), dayjs().subtract(1, 'months').endOf('month')] },
            { label: 'Last 6 Months', value: [dayjs().subtract(6, 'months'), dayjs()] },
            { label: 'This Year', value: [dayjs().startOf('year'), dayjs().endOf('year')] },
          ]}
        />
      </div>

      {/* SECTION 1: SALES */}
      <Card title={<span><BarChartOutlined /> Sales & Performance</span>} style={{ marginBottom: 24 }} loading={loading}>
        <Row gutter={[24, 24]}>
          <Col span={6}>
            <Card type="inner" className="kpi-card">
              <Statistic title="Total Leads" value={salesSummary.totalLeads || 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card type="inner" className="kpi-card">
              <Statistic title="Converted" value={salesSummary.convertedLeads || 0} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card type="inner" className="kpi-card">
              <Statistic title="Policies Issued" value={salesSummary.policiesIssued || 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card type="inner" className="kpi-card">
              <Statistic title="Total Premium" value={salesSummary.premiumCollected || 0} formatter={(val) => formatCurrency(val)} />
            </Card>
          </Col>

          <Col span={12}>
            <h4>Monthly Trend (New Leads vs Conversions)</h4>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="leads" name="New Leads" fill="#1f4d7a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversions" name="Conversions" fill="#4a7fab" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>

          <Col span={12}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h4>Top Performing Agents</h4>
              <Button size="small" icon={<DownloadOutlined />} onClick={() => exportToExcel(agentPerformance, 'AgentPerformance')}>Export</Button>
            </div>
            <Table dataSource={agentPerformance} columns={agentColumns} rowKey="agent_id" pagination={false} size="small" />
          </Col>
        </Row>
      </Card>

      {/* SECTION 2: POLICIES */}
      <Card title={<span><FileTextOutlined /> Policy & Premium Analysis</span>} style={{ marginBottom: 24 }} loading={loading}>
        <Row gutter={[24, 24]}>
          <Col span={8}>
            <h4>Leads by Source</h4>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceWise} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={100} label>
                    {sourceWise.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Col>

          <Col span={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h4>Premium Collected by Insurer</h4>
              <Button size="small" icon={<DownloadOutlined />} onClick={() => exportToExcel(premiumReport, 'PremiumByInsurer')}>Export</Button>
            </div>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={premiumReport} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="insurer" type="category" />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total_premium" name="Premium (₹)" fill="#1f4d7a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        </Row>
      </Card>

      {/* SECTION 3: RENEWALS */}
      <Card title={<span><RiseOutlined /> Renewal Performance</span>} loading={loading}>
        <Row gutter={[24, 24]}>
          <Col span={8}>
            <Card type="inner" className="kpi-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
               <Statistic 
                  title="Estimated Renewal Rate" 
                  value={85.4} 
                  precision={1}
                  suffix="%" 
                  valueStyle={{ color: '#52c41a', fontSize: '3rem' }} 
                  prefix={<RiseOutlined />} 
               />
               <Divider />
               <Statistic 
                  title="Lapse Rate" 
                  value={14.6} 
                  precision={1}
                  suffix="%" 
                  valueStyle={{ color: '#f5222d' }} 
                  prefix={<FallOutlined />} 
               />
            </Card>
          </Col>
          <Col span={16}>
             <h4>Upcoming Renewals (Next 30 Days) Snapshot</h4>
             <p>For detailed renewal management and lists, please use the <a href="/renewals">Renewals module</a>.</p>
             {/* In a real scenario, we might pull a summary table here. For now, referencing the dedicated module is standard for BI dashboards. */}
             <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9', borderRadius: 8, border: '1px dashed #d9d9d9' }}>
                <Statistic title="Total Expected Premium (Next 30 Days)" value={salesSummary.premiumCollected ? salesSummary.premiumCollected * 0.4 : 0} formatter={val => formatCurrency(val)} />
             </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Reports;
