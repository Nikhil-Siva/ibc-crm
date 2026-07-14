import React, { useState, useEffect, useCallback } from 'react';
import { Badge, message, Spin, Typography, Card, Tag, Space, Button, Select, Avatar } from 'antd';
import { UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { PIPELINE_COLUMNS, PRIORITY_COLORS } from '../utils/constants';
import { formatDate, formatMobile } from '../utils/formatters';

const { Title, Text } = Typography;

const LeadCard = ({ lead, onMove, columns }) => {
  const navigate = useNavigate();

  // Styling lives in .pipeline-card (index.css). A resting card doesn't float,
  // so it gets a hairline instead of a shadow; elevation is kept for the drag
  // state, where the card genuinely is lifted.
  return (
    <div className="pipeline-card" style={{ marginBottom: 'var(--s-2)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <Text
          strong
          style={{ fontSize: 13, color: 'var(--c-accent)', cursor: 'pointer' }}
          onClick={() => navigate(`/leads/${lead.id}`)}
        >
          {lead.name}
        </Text>
        {lead.priority && (
          <Tag
            color={PRIORITY_COLORS[lead.priority]}
            style={{ fontSize: 10, padding: '0 4px', marginLeft: 4, border: 'none' }}
          >
            {lead.priority}
          </Tag>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
        📱 {formatMobile(lead.mobile)}
      </div>
      {lead.source && (
        <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>
          Source: {lead.source}
        </div>
      )}
      <div style={{ marginTop: 8, borderTop: '1px solid #f5f5f5', paddingTop: 6 }}>
        <Select
          size="small"
          value={lead.status}
          style={{ width: '100%', fontSize: 11 }}
          onChange={(val) => onMove(lead.id, val)}
          onClick={e => e.stopPropagation()}
          options={columns.map(c => ({ label: `→ ${c.title}`, value: c.key }))}
          placeholder="Move to..."
        />
      </div>
    </div>
  );
};

const Pipeline = () => {
  const [leads, setLeads] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/leads', { params: { limit: 500 } });
      // Backend returns: { success, data: { rows, count } }
      const responseData = res.data?.data || res.data;
      const allLeads = responseData?.rows || responseData?.leads || (Array.isArray(responseData) ? responseData : []);

      const organized = {};
      PIPELINE_COLUMNS.forEach((col) => {
        organized[col.key] = [];
      });

      allLeads.forEach((lead) => {
        const status = lead.status || 'New';
        if (organized[status]) {
          organized[status].push(lead);
        }
      });

      setLeads(organized);
    } catch (err) {
      console.error('Pipeline fetch error:', err);
      message.error('Failed to load pipeline data');
      const organized = {};
      PIPELINE_COLUMNS.forEach((col) => { organized[col.key] = []; });
      setLeads(organized);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleMove = async (leadId, newStatus) => {
    // Optimistic update
    const newLeads = { ...leads };
    let movedLead = null;
    let sourceStatus = null;

    for (const status of Object.keys(newLeads)) {
      const idx = newLeads[status].findIndex(l => l.id === leadId);
      if (idx !== -1) {
        movedLead = { ...newLeads[status][idx], status: newStatus };
        newLeads[status] = newLeads[status].filter(l => l.id !== leadId);
        sourceStatus = status;
        break;
      }
    }

    if (!movedLead || sourceStatus === newStatus) return;

    if (newLeads[newStatus]) {
      newLeads[newStatus] = [movedLead, ...newLeads[newStatus]];
    }
    setLeads(newLeads);

    try {
      await api.put(`/leads/${leadId}`, { status: newStatus });
      message.success(`Lead moved to "${newStatus}"`);
    } catch {
      message.error('Failed to update lead status');
      fetchPipeline();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading pipeline..." />
      </div>
    );
  }

  const totalLeads = Object.values(leads).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: 'var(--c-accent)' }}>Sales Pipeline</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>{totalLeads} leads across {PIPELINE_COLUMNS.length} stages</Text>
        </div>
        <Button onClick={fetchPipeline}>Refresh</Button>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
        {PIPELINE_COLUMNS.map((column) => {
          const columnLeads = leads[column.key] || [];
          return (
            <div
              key={column.key}
              style={{
                minWidth: 230,
                width: 230,
                flexShrink: 0,
                background: '#f8f9fb',
                borderRadius: 10,
                overflow: 'hidden',
                border: `1px solid ${column.color}30`,
              }}
            >
              <div
                style={{
                  background: column.bg,
                  color: column.color,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: `2px solid ${column.color}40`,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{column.title}</span>
                <Badge
                  count={columnLeads.length}
                  style={{ backgroundColor: column.color }}
                  showZero
                />
              </div>
              <div style={{ padding: 8, minHeight: 100, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                {columnLeads.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#bbb', padding: '20px 0', fontSize: 12 }}>
                    No leads
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      columns={PIPELINE_COLUMNS}
                      onMove={handleMove}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Pipeline;
