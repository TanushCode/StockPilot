import { useState, useEffect } from 'react';
import api from '../api';
import {
  ArrowLeftRight,
  Search,
  Download,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('per_page', '25');
      if (typeFilter) params.append('type', typeFilter);

      const res = await api.getMovements(params.toString());
      setMovements(res.movements || []);
      setTotalPages(res.pages || 1);
      setTotalCount(res.total || 0);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [typeFilter, page]);

  const handleExport = async () => {
    try {
      const res = await api.exportMovements();
      if (res.download_url) {
        window.open(res.download_url, '_blank');
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  const filteredMovements = movements.filter((m) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      m.product_name?.toLowerCase().includes(term) ||
      m.product_sku?.toLowerCase().includes(term) ||
      m.batch_number?.toLowerCase().includes(term) ||
      m.reason?.toLowerCase().includes(term) ||
      m.username?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Immutable Stock Ledger & Audit Trail</h1>
            <span className="badge badge-success flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>ACID Serializable Isolation</span>
            </span>
          </div>
          <p className="page-subtitle">
            Cryptographically auditable historical ledger of all inward intake, retail dispatches & write-offs
          </p>
        </div>
        <button onClick={handleExport} className="btn btn-secondary">
          <Download size={15} />
          <span>Export S3 CSV Ledger</span>
        </button>
      </div>

      {error && (
        <div className="alert-banner error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div className="form-row" style={{ alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 2 }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search ledger by transaction reference, SKU, lot, or operator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <select
                className="form-select"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Transaction Types</option>
                <option value="receive">Inward Intake</option>
                <option value="sale">Point-of-Sale</option>
                <option value="issue">Internal Kitchen Issue</option>
                <option value="adjustment">Physical Count Adjustment</option>
                <option value="write_off">Disposal Write-Off</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Table (design.md 3.5) */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recorded Transactions ({totalCount} entries)</h3>
          <span className="badge badge-primary">Page {page} of {totalPages}</span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Transaction Ref</th>
                <th>Timestamp</th>
                <th>Type Badge</th>
                <th>Product & Lot ID</th>
                <th>Quantity Delta</th>
                <th>Balance Trail</th>
                <th>Reason & Notes</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                    Loading ledger...
                  </td>
                </tr>
              ) : filteredMovements.length > 0 ? (
                filteredMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id}>
                      <td className="mono text-muted text-sm font-semibold">
                        #TXN-90{m.id.toString().padStart(4, '0')}
                      </td>
                      <td className="mono text-sm text-muted">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            m.movement_type === 'receive'
                              ? 'badge-success'
                              : m.movement_type === 'sale'
                              ? 'badge-primary'
                              : m.movement_type === 'write_off'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {m.movement_type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.product_name}</div>
                        <div className="mono text-sm text-muted">{m.batch_number || '—'}</div>
                      </td>
                      <td
                        className="tabular-nums"
                        style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: isPositive ? 'var(--status-success-text)' : 'var(--status-danger-text)',
                        }}
                      >
                        {isPositive ? `+${m.quantity} units` : `${m.quantity} units`}
                      </td>
                      <td className="mono text-sm">
                        <span className="text-muted">{m.previous_stock ?? '—'}</span>
                        <span style={{ margin: '0 4px', color: 'var(--text-tertiary)' }}>→</span>
                        <span style={{ fontWeight: 700 }}>{m.new_stock ?? '—'} units</span>
                      </td>
                      <td className="text-sm text-muted">{m.reason || '—'}</td>
                      <td>
                        <span className="badge badge-neutral">{m.username || 'System Daemon'}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <ArrowLeftRight size={38} style={{ opacity: 0.5, marginBottom: 8 }} />
                      <p>No transactions found for the specified filter.</p>
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
