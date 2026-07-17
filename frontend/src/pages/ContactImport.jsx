import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Button, Table, Select, Steps, Progress, Card, Badge, Space, Tag,
  Typography, message, Result, Spin, Alert, Divider, Modal,
} from 'antd';
import {
  InboxOutlined, UploadOutlined, FileExcelOutlined, DownloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  CloudUploadOutlined, TableOutlined, EyeOutlined, SyncOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { downloadCsv } from '../utils/exportCsv';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// `value` must match a Lead column exactly — the backend only accepts targets
// in LEAD_WRITABLE (utils/validation.js) and rejects the import otherwise.
// 'source' is deliberately absent: the backend stamps every imported lead
// 'Other', so offering it would be a mapping that quietly does nothing.
const CRM_FIELDS = [
  { label: 'Name', value: 'name' },
  { label: 'Mobile', value: 'mobile' },
  { label: 'Email', value: 'email' },
  { label: 'Age', value: 'age' },
  { label: 'City', value: 'city' },
  { label: 'Occupation', value: 'occupation' },
  { label: 'Insurance Interest', value: 'insurance_interest' },
  { label: 'Priority', value: 'priority' },
  { label: 'Notes', value: 'notes' },
  { label: 'Skip', value: '__skip__' },
];

// Header spellings a real sheet uses for each CRM field. Matched before the
// looser substring pass so "Phone"/"Contact No" find `mobile`, which shares no
// substring with either.
const HEADER_SYNONYMS = {
  name: ['name', 'fullname', 'customername', 'leadname', 'contactname'],
  mobile: ['mobile', 'phone', 'phoneno', 'phonenumber', 'contact', 'contactno',
    'contactnumber', 'mobileno', 'mobilenumber', 'cell', 'cellphone', 'whatsapp'],
  email: ['email', 'emailid', 'emailaddress', 'mail'],
  age: ['age'],
  city: ['city', 'location', 'town'],
  occupation: ['occupation', 'profession', 'job', 'designation'],
  insurance_interest: ['insuranceinterest', 'interest', 'insurancetype', 'producttype'],
  priority: ['priority'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
};

const normalizeHeader = (header) => String(header).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Best CRM field for a file column, or undefined when nothing fits. */
const matchCrmField = (header) => {
  const key = normalizeHeader(header);
  if (!key) return undefined;

  const exact = Object.keys(HEADER_SYNONYMS).find((field) =>
    HEADER_SYNONYMS[field].includes(key)
  );
  if (exact) return exact;

  // Fall back to containment, longest synonym first so "customer name" prefers
  // `name` over a short accidental hit. Only the header may be the longer side:
  // testing the synonym as a substring of a short header matched "e" to `email`.
  let best;
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (key.includes(synonym) && (!best || synonym.length > best.length)) {
        best = { field, length: synonym.length };
      }
    }
  }
  return best?.field;
};

const STATUS_BADGE_MAP = {
  processing: { color: 'blue', text: 'Processing' },
  completed: { color: 'green', text: 'Completed' },
  failed: { color: 'red', text: 'Failed' },
  pending: { color: 'orange', text: 'Pending' },
  uploading: { color: 'blue', text: 'Uploading' },
};

const ContactImport = () => {
  // Flow state
  const [currentStep, setCurrentStep] = useState(0);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null); // { importId, headers, preview }

  // Mapping state
  const [mapping, setMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importComplete, setImportComplete] = useState(false);
  const pollingRef = useRef(null);

  // Campaign selection
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Fetch campaigns for optional selection
  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/campaigns', { params: { limit: 200 } });
      const data = res.data?.data || res.data;
      // The endpoint returns { campaigns, pagination }.
      const rows = data?.campaigns || (Array.isArray(data) ? data : []);
      setCampaigns(rows);
    } catch {
      // Campaign list is optional, silently ignore
    }
  }, []);

  const fetchHistory = useCallback(async (page = 1, pageSize = 10) => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/contact-imports', { params: { page, limit: pageSize } });
      const data = res.data?.data || res.data;
      // The endpoint returns { imports, pagination: { total } }.
      const rows = data?.imports || (Array.isArray(data) ? data : []);
      const count = data?.pagination?.total ?? rows.length;
      setHistory(rows);
      setHistoryPagination((prev) => ({ ...prev, current: page, pageSize, total: count }));
    } catch {
      message.error('Failed to load import history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetchHistory();
  }, [fetchCampaigns, fetchHistory]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Custom upload handler
  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/contact-imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data?.data || res.data;
      setUploadResult({
        importId: data.importId || data.id,
        headers: data.headers || data.columns || [],
        preview: data.preview || data.sample_data || [],
        filename: file.name,
      });

      // Auto-map columns, first match wins so two headers never claim one field.
      const autoMapping = {};
      const headerList = data.headers || data.columns || [];
      headerList.forEach((header) => {
        const field = matchCrmField(header);
        if (field && !Object.values(autoMapping).includes(field)) {
          autoMapping[header] = field;
        }
      });
      setMapping(autoMapping);
      setPreviewData(data.preview || data.sample_data || []);

      message.success('File uploaded successfully');
      setCurrentStep(1);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Upload failed';
      message.error(msg);
      if (onError) onError(err);
    } finally {
      setUploading(false);
    }
  };

  // Name and Mobile are both NOT NULL on Lead — the backend rejects every row
  // without them, so catch it here rather than after a full failed import.
  const validateMapping = () => {
    const values = Object.values(mapping);
    const missing = ['name', 'mobile'].filter((f) => !values.includes(f));
    if (missing.length > 0) {
      const labels = missing.map((f) => CRM_FIELDS.find((c) => c.value === f).label);
      message.warning(`${labels.join(' and ')} must be mapped to proceed`);
      return false;
    }
    return true;
  };

  // Handle preview
  const handlePreview = () => {
    if (!validateMapping()) return;
    setPreviewVisible(true);
    setCurrentStep(2);
  };

  // Start import
  const handleImport = async () => {
    if (!validateMapping()) return;
    setImporting(true);
    setCurrentStep(3);
    try {
      const payload = {
        importId: uploadResult.importId,
        mapping,
        campaignId: selectedCampaign || undefined,
      };
      await api.post('/contact-imports/process', payload);
      message.info('Import started...');

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(`/contact-imports/${uploadResult.importId}`);
          const statusData = statusRes.data?.data || statusRes.data;
          setImportProgress(statusData);

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setImporting(false);
            setImportComplete(true);
            setCurrentStep(4);
            fetchHistory(1, historyPagination.pageSize);
            if (statusData.status === 'completed') {
              message.success('Import completed successfully!');
            } else {
              message.error('Import failed');
            }
          }
        } catch {
          // Polling failure is non-critical, continue
        }
      }, 2000);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to start import';
      message.error(msg);
      setImporting(false);
      setCurrentStep(1);
    }
  };

  // Download error log. The endpoint returns JSON — [{ row, data, error }] —
  // so the CSV is built here rather than saving the raw response under a .csv
  // name, which produced a file Excel could not open.
  const handleDownloadErrors = async () => {
    try {
      const res = await api.get(`/contact-imports/${uploadResult.importId}/errors`);
      const errors = res.data?.data || [];
      if (errors.length === 0) {
        message.info('No errors to download');
        return;
      }
      downloadCsv(
        errors.map((e) => ({
          Row: e.row,
          Error: e.error,
          // `data` is the raw sheet row; flatten it so each cell is readable.
          ...Object.fromEntries(
            (uploadResult.headers || []).map((h, i) => [h, e.data?.[i] ?? ''])
          ),
        })),
        `import_errors_${uploadResult.importId}`
      );
    } catch {
      message.error('Failed to download error log');
    }
  };

  // Reset flow
  const handleReset = () => {
    setCurrentStep(0);
    setUploadResult(null);
    setMapping({});
    setPreviewData([]);
    setPreviewVisible(false);
    setImporting(false);
    setImportProgress(null);
    setImportComplete(false);
    setSelectedCampaign(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Build mapping table columns
  const mappingColumns = [
    {
      title: 'File Column',
      dataIndex: 'header',
      key: 'header',
      render: (text) => (
        <Tag color="var(--c-accent)" style={{ fontSize: 13 }}>{text}</Tag>
      ),
    },
    {
      title: 'Map to CRM Field',
      dataIndex: 'header',
      key: 'mapping',
      render: (header) => (
        <Select
          value={mapping[header] || undefined}
          placeholder="Select CRM field..."
          onChange={(val) => setMapping((prev) => ({ ...prev, [header]: val }))}
          options={CRM_FIELDS.map((f) => ({
            ...f,
            disabled:
              f.value !== '__skip__' &&
              Object.entries(mapping).some(
                ([k, v]) => v === f.value && k !== header
              ),
          }))}
          style={{ width: 220 }}
          allowClear
          onClear={() => setMapping((prev) => {
            const next = { ...prev };
            delete next[header];
            return next;
          })}
        />
      ),
    },
  ];

  const mappingDataSource = (uploadResult?.headers || []).map((h, i) => ({
    key: i,
    header: h,
  }));

  // Build preview columns from mapping
  const previewColumns = Object.entries(mapping)
    .filter(([, v]) => v !== '__skip__')
    .map(([header, field]) => ({
      title: (
        <div>
          <div style={{ fontSize: 12, color: '#999' }}>{header}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {CRM_FIELDS.find((f) => f.value === field)?.label || field}
          </div>
        </div>
      ),
      dataIndex: header,
      key: header,
    }));

  // History table columns
  const historyColumns = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
      render: (name) => (
        <Space>
          <FileExcelOutlined style={{ color: '#52c41a' }} />
          <Text>{name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (date) => date ? dayjs(date).format('DD MMM YYYY, h:mm A') : '-',
    },
    {
      title: 'Uploaded By',
      dataIndex: ['uploader', 'name'],
      key: 'uploader',
      render: (name) => name || '-',
    },
    {
      title: 'Total Rows',
      dataIndex: 'total_rows',
      key: 'total_rows',
      sorter: (a, b) => (a.total_rows || 0) - (b.total_rows || 0),
      render: (count) => <Text strong>{count ?? 0}</Text>,
    },
    {
      title: 'Success',
      dataIndex: 'success_rows',
      key: 'success_rows',
      render: (count) => (
        <Text style={{ color: '#52c41a' }}>
          <CheckCircleOutlined style={{ marginRight: 4 }} />
          {count ?? 0}
        </Text>
      ),
    },
    {
      title: 'Failed',
      dataIndex: 'failed_rows',
      key: 'failed_rows',
      render: (count) => (
        <Text style={{ color: count > 0 ? '#f5222d' : '#8c8c8c' }}>
          <CloseCircleOutlined style={{ marginRight: 4 }} />
          {count ?? 0}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const info = STATUS_BADGE_MAP[status] || { color: 'default', text: status || 'Unknown' };
        return <Badge color={info.color} text={info.text} />;
      },
    },
  ];

  const stepsItems = [
    { title: 'Upload', icon: <CloudUploadOutlined /> },
    { title: 'Map Columns', icon: <TableOutlined /> },
    { title: 'Preview', icon: <EyeOutlined /> },
    { title: 'Importing', icon: importing ? <LoadingOutlined /> : <SyncOutlined /> },
    { title: 'Complete', icon: <FileDoneOutlined /> },
  ];

  const progressPercent =
    importProgress && importProgress.total_rows > 0
      ? Math.round(
          ((importProgress.success_rows + importProgress.failed_rows) /
            importProgress.total_rows) *
            100
        )
      : 0;

  return (
    <div className="fade-in">
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: 'var(--c-accent)' }}>
            <UploadOutlined style={{ marginRight: 8 }} />
            Contact Import
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Import contacts from Excel or CSV files
          </Text>
        </div>
        {currentStep > 0 && !importing && (
          <Button onClick={handleReset}>Start New Import</Button>
        )}
      </div>

      {/* Steps */}
      <Card style={{ marginBottom: 20 }}>
        <Steps current={currentStep} items={stepsItems} size="small" />
      </Card>

      {/* Step 0: Upload */}
      {currentStep === 0 && (
        <Card
          title={
            <Space>
              <CloudUploadOutlined style={{ color: 'var(--c-accent)' }} />
              <span>Upload File</span>
            </Space>
          }
          style={{ marginBottom: 20 }}
        >
          <Dragger
            accept=".xlsx,.csv"
            customRequest={handleUpload}
            showUploadList={false}
            disabled={uploading}
            style={{
              padding: '40px 20px',
              background: '#fafcfe',
              border: '2px dashed var(--c-accent)',
              borderRadius: 12,
            }}
          >
            {uploading ? (
              <div>
                <Spin size="large" />
                <p style={{ marginTop: 16, color: 'var(--c-accent)', fontSize: 16 }}>
                  Uploading and parsing file...
                </p>
              </div>
            ) : (
              <div>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ color: 'var(--c-accent)', fontSize: 48 }} />
                </p>
                <p
                  style={{
                    fontSize: 16,
                    color: 'var(--c-accent)',
                    fontWeight: 500,
                    marginBottom: 8,
                  }}
                >
                  Drag & Drop your Excel or CSV file here, or click to browse
                </p>
                <p style={{ color: '#999', fontSize: 13 }}>
                  Supported formats: .xlsx, .csv
                </p>
              </div>
            )}
          </Dragger>
        </Card>
      )}

      {/* Step 1: Column Mapping */}
      {currentStep === 1 && uploadResult && (
        <Card
          title={
            <Space>
              <TableOutlined style={{ color: 'var(--c-accent)' }} />
              <span>Map Columns</span>
              <Tag color="blue">{uploadResult.filename}</Tag>
            </Space>
          }
          style={{ marginBottom: 20 }}
          extra={
            <Space>
              {campaigns.length > 0 && (
                <Select
                  placeholder="Assign to campaign (optional)"
                  value={selectedCampaign}
                  onChange={setSelectedCampaign}
                  allowClear
                  style={{ width: 240 }}
                  options={campaigns.map((c) => ({ label: c.name, value: c.id }))}
                />
              )}
            </Space>
          }
        >
          <Alert
            message="Map your file columns to CRM fields. Name and Mobile are required."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Table
            dataSource={mappingDataSource}
            columns={mappingColumns}
            pagination={false}
            size="small"
            rowKey="key"
          />

          <Divider />

          <Space>
            <Button onClick={() => setCurrentStep(0)}>Back</Button>
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={handlePreview}
              style={{ background: 'var(--c-accent)' }}
            >
              Preview
            </Button>
            <Button
              type="primary"
              onClick={handleImport}
              loading={importing}
              disabled={importing}
              style={{ background: 'var(--c-accent)' }}
            >
              Import Now
            </Button>
          </Space>
        </Card>
      )}

      {/* Step 2: Preview */}
      {currentStep === 2 && previewVisible && (
        <Card
          title={
            <Space>
              <EyeOutlined style={{ color: 'var(--c-accent)' }} />
              <span>Preview (First 5 Rows)</span>
            </Space>
          }
          style={{ marginBottom: 20 }}
        >
          <Table
            dataSource={(previewData || []).slice(0, 5).map((row, i) => ({ key: i, ...row }))}
            columns={previewColumns}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            bordered
          />

          <Divider />

          <Space>
            <Button onClick={() => { setPreviewVisible(false); setCurrentStep(1); }}>
              Back to Mapping
            </Button>
            <Button
              type="primary"
              onClick={handleImport}
              loading={importing}
              disabled={importing}
              style={{ background: 'var(--c-accent)' }}
            >
              Start Import
            </Button>
          </Space>
        </Card>
      )}

      {/* Step 3: Importing Progress */}
      {currentStep === 3 && (
        <Card
          title={
            <Space>
              <SyncOutlined spin={importing} style={{ color: 'var(--c-accent)' }} />
              <span>Importing Contacts...</span>
            </Space>
          }
          style={{ marginBottom: 20 }}
        >
          <div style={{ maxWidth: 500, margin: '20px auto', textAlign: 'center' }}>
            <Progress
              type="circle"
              percent={progressPercent}
              size={160}
              strokeColor={{
                '0%': 'var(--c-accent)',
                '100%': '#52c41a',
              }}
            />
            {importProgress && (
              <div style={{ marginTop: 24 }}>
                <Space size={32}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Total</Text>
                    <Text strong style={{ fontSize: 20 }}>{importProgress.total_rows ?? 0}</Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Success</Text>
                    <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                      {importProgress.success_rows ?? 0}
                    </Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Failed</Text>
                    <Text strong style={{ fontSize: 20, color: '#f5222d' }}>
                      {importProgress.failed_rows ?? 0}
                    </Text>
                  </div>
                </Space>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                {importing ? 'Please wait while contacts are being imported...' : 'Processing...'}
              </Text>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Complete */}
      {currentStep === 4 && importComplete && (
        <Card style={{ marginBottom: 20 }}>
          <Result
            status={importProgress?.status === 'failed' ? 'error' : 'success'}
            title={importProgress?.status === 'failed' ? 'Import Failed' : 'Import Completed!'}
            subTitle={
              importProgress ? (
                <Space direction="vertical" size={4}>
                  <Text>
                    Total rows: <Text strong>{importProgress.total_rows ?? 0}</Text>
                  </Text>
                  <Text>
                    Successfully imported:{' '}
                    <Text strong style={{ color: '#52c41a' }}>
                      {importProgress.success_rows ?? 0}
                    </Text>
                  </Text>
                  <Text>
                    Failed:{' '}
                    <Text strong style={{ color: '#f5222d' }}>
                      {importProgress.failed_rows ?? 0}
                    </Text>
                  </Text>
                </Space>
              ) : null
            }
            extra={
              <Space>
                {importProgress?.failed_rows > 0 && (
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadErrors}
                    danger
                  >
                    Download Error Log
                  </Button>
                )}
                <Button type="primary" onClick={handleReset} style={{ background: 'var(--c-accent)' }}>
                  Import Another File
                </Button>
              </Space>
            }
          />
        </Card>
      )}

      {/* Import History Table */}
      <Card
        title={
          <Space>
            <FileExcelOutlined style={{ color: 'var(--c-accent)' }} />
            <span>Import History</span>
          </Space>
        }
      >
        <Table
          dataSource={history}
          columns={historyColumns}
          rowKey="id"
          loading={historyLoading}
          onChange={(pag) => fetchHistory(pag.current, pag.pageSize)}
          pagination={{
            current: historyPagination.current,
            pageSize: historyPagination.pageSize,
            total: historyPagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} imports`,
          }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default ContactImport;
