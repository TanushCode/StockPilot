import { useState, useEffect } from 'react';
import api from '../api';
import {
  Cloud,
  Server,
  Database,
  HardDrive,
  Radio,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function FilesCloud() {
  const [invoices, setInvoices] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, healthRes] = await Promise.all([
        api.getInvoices().catch(() => ({ invoices: [] })),
        api.health().catch((err) => ({ status: 'error', error: err.message })),
      ]);
      setInvoices(invRes.invoices || []);
      setHealth(healthRes);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load cloud telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      await api.uploadFile(file);
      setSuccess(`Document "${file.name}" successfully vaulted in S3 bucket.`);
      e.target.value = '';
      loadData();
    } catch (err) {
      setError(err.message || 'File upload to S3 failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadInvoice = async (inv) => {
    try {
      const res = await api.downloadInvoice(inv.id);
      if (res.download_url) {
        window.open(res.download_url, '_blank');
      }
    } catch (err) {
      alert('Could not generate presigned download link: ' + err.message);
    }
  };

  const handleExport = async (type) => {
    setExporting(true);
    setError('');
    try {
      const res =
        type === 'inventory'
          ? await api.exportInventory()
          : await api.exportMovements();

      if (res.download_url) {
        window.open(res.download_url, '_blank');
        setSuccess(`CSV analytical report generated and vaulted to Amazon S3.`);
      }
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">AWS Multi-Service Architecture & S3 Vault</h1>
            <span className="badge badge-success flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>ap-south-1 (Mumbai)</span>
            </span>
          </div>
          <p className="page-subtitle">
            Amazon Web Services cloud backbone, S3 encrypted supplier invoice storage & CSV data exports
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary">
          <RefreshCw size={15} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {success && (
        <div className="alert-banner success mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setSuccess('')}>Dismiss</button>
        </div>
      )}

      {error && (
        <div className="alert-banner error mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Interactive Multi-Service AWS Architecture Grid (design.md 3.8 A) */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Cloud Infrastructure Topology (AWS Production Model)</h3>
          <span className="badge badge-primary">Multi-Service Architecture</span>
        </div>
        <div className="card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
            }}
          >
            {/* EC2 Card */}
            <div
              style={{
                padding: '14px 16px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Server size={17} color="var(--brand-primary)" />
                  <strong style={{ fontSize: '0.88rem' }}>Amazon EC2</strong>
                </div>
                <span className="badge badge-success">Running</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Ubuntu 22.04 LTS compute hosting Gunicorn Flask API, background worker, and React SPA.
              </div>
            </div>

            {/* RDS MySQL Card */}
            <div
              style={{
                padding: '14px 16px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database size={17} color="var(--accent-blue)" />
                  <strong style={{ fontSize: '0.88rem' }}>Amazon RDS MySQL</strong>
                </div>
                <span className="badge badge-success">
                  {health?.database === 'connected' ? 'Connected' : 'Active'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Multi-AZ managed relational database enforcing ACID compliance and immutable stock ledger.
              </div>
            </div>

            {/* S3 Card */}
            <div
              style={{
                padding: '14px 16px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={17} color="var(--status-success-dot)" />
                  <strong style={{ fontSize: '0.88rem' }}>Amazon S3 Vault</strong>
                </div>
                <span className="badge badge-success">AES-256</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Dedicated encrypted object storage for supplier invoices and automated CSV analytical dumps.
              </div>
            </div>

            {/* SQS & SNS Card */}
            <div
              style={{
                padding: '14px 16px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Radio size={17} color="var(--status-warning-dot)" />
                  <strong style={{ fontSize: '0.88rem' }}>Amazon SQS / SNS</strong>
                </div>
                <span className="badge badge-success">Decoupled</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Asynchronous event queue decoupling stock checkout from background email/SMS alerts.
              </div>
            </div>

            {/* SSM Parameter Store */}
            <div
              style={{
                padding: '14px 16px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-muted)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lock size={17} color="#4338CA" />
                  <strong style={{ fontSize: '0.88rem' }}>AWS SSM Store</strong>
                </div>
                <span className="badge badge-primary">Secured</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Zero-hardcoded secrets injection for database URLs, encryption keys, and S3 parameters.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Export & S3 Upload Center */}
      <div className="split-dashboard mb-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Cloud Analytical Export Center</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Generate comprehensive CSV data dumps uploaded directly to Amazon S3 and fetched via temporary 1-hour pre-signed download links.
            </p>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button
                onClick={() => handleExport('inventory')}
                className="btn btn-secondary flex items-center gap-2"
                disabled={exporting}
              >
                <FileSpreadsheet size={15} color="var(--brand-primary)" />
                <span>Export Inventory CSV</span>
              </button>

              <button
                onClick={() => handleExport('movements')}
                className="btn btn-secondary flex items-center gap-2"
                disabled={exporting}
              >
                <FileSpreadsheet size={15} color="var(--accent-blue)" />
                <span>Export Ledger CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upload Supplier Invoice to S3</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Vault invoices in S3 (PDF, PNG, JPG). Max 10MB per object.
            </p>
            <label
              className="btn btn-primary"
              style={{ display: 'inline-flex', cursor: uploading ? 'not-allowed' : 'pointer' }}
            >
              <Upload size={15} />
              <span>{uploading ? 'Vaulting to S3...' : 'Select File & Vault in S3'}</span>
              <input
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* S3 Documents Table (design.md 3.8 B) */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">S3 Digital Invoices & Vaulted Documents ({invoices.length} objects)</h3>
          <span className="badge badge-primary">S3 Standard Storage</span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Document File Name</th>
                <th>S3 Storage Key</th>
                <th>File Size</th>
                <th>Upload Timestamp</th>
                <th style={{ textAlign: 'right' }}>Presigned Retrieval</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                    Scanning S3 object metadata...
                  </td>
                </tr>
              ) : invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText size={16} color="var(--brand-primary)" />
                        <span style={{ fontWeight: 600 }}>{inv.filename}</span>
                      </div>
                    </td>
                    <td className="mono text-muted text-sm">{inv.s3_key}</td>
                    <td className="mono text-sm">
                      {inv.file_size ? `${(inv.file_size / 1024).toFixed(1)} KB` : '—'}
                    </td>
                    <td className="mono text-sm">
                      {inv.created_at ? new Date(inv.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDownloadInvoice(inv)}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                        style={{ marginLeft: 'auto' }}
                      >
                        <Download size={13} />
                        <span>1-Hr Presigned Link</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <HardDrive size={36} style={{ opacity: 0.5, marginBottom: 8 }} />
                      <p>No documents vaulted yet. Attach invoices during stock receipt.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
