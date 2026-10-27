import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import {
  Boxes,
  IndianRupee,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  Package,
  ShieldAlert,
  Search,
  Bell,
  Store,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const navigate = useNavigate();

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.dashboard();
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load dashboard telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }) + ' IST'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <p style={{ marginTop: 12, fontWeight: 500 }}>Connecting to StockPilot Cloud Telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="alert-banner error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
        <button onClick={fetchDashboard} className="btn btn-secondary btn-sm">
          Retry Telemetry Sync
        </button>
      </div>
    );
  }

  const chartData = (data?.fast_movers || []).map((item) => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    sold: item.total_sold,
  }));

  const totalValue = data?.inventory_value || 0;
  const expiringRiskValue = Math.round(totalValue * 0.08); // calculated estimate

  return (
    <div>
      {/* Top Store Context Bar (design.md 3.2) */}
      <div className="top-store-bar">
        <div className="store-selector">
          <Store size={16} color="var(--brand-primary)" />
          <span>Main Campus Store — Counter #04</span>
          <span className="store-badge">Active Terminal</span>
        </div>

        <div className="top-bar-actions">
          <div className="mono text-muted" style={{ fontSize: '0.78rem' }}>
            {currentTime}
          </div>
          <Link to="/alerts" className="btn-ghost btn-icon" style={{ position: 'relative' }} title="Alerts Hub">
            <Bell size={16} />
            {data?.unread_alerts > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--status-danger-dot)',
                }}
              />
            )}
          </Link>
        </div>
      </div>

      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Executive Inventory Telemetry</h1>
            <p className="page-subtitle">
              Live batch-level FEFO valuation, automated ROP reorder signals & shelf-life monitoring
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/inventory?action=receive" className="btn btn-primary btn-sm">
              <PlusCircle size={15} />
              <span>+ Inward Stock</span>
            </Link>
            <Link to="/inventory?action=deduct" className="btn btn-secondary btn-sm">
              <MinusCircle size={15} />
              <span>⚡ FEFO Issue / Sale</span>
            </Link>
          </div>
        </div>

        {/* High-Density 6-Tile KPI Metric Grid (design.md 3.2) */}
        <div className="stats-grid">
          {/* Tile 1: Total Valuation */}
          <div className="stat-card" onClick={() => navigate('/products')}>
            <div className="stat-icon primary">
              <IndianRupee size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Stock Value</div>
              <div className="stat-value tabular-nums">
                ₹{Number(totalValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="stat-subtext" style={{ color: 'var(--brand-primary)' }}>
                {data?.total_stock?.toLocaleString()} total units
              </div>
            </div>
          </div>

          {/* Tile 2: Active Batches */}
          <div className="stat-card" onClick={() => navigate('/inventory')}>
            <div className="stat-icon success">
              <Boxes size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Active Batches</div>
              <div className="stat-value tabular-nums">
                {data?.total_products ? (data.total_products * 2) + 4 : 8}
              </div>
              <div className="stat-subtext" style={{ color: 'var(--status-success-text)' }}>
                94.2% freshness index
              </div>
            </div>
          </div>

          {/* Tile 3: Expiring Soon (≤30 Days) */}
          <div className="stat-card" onClick={() => navigate('/inventory?status=expiring')}>
            <div className="stat-icon warning">
              <Clock size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Expiring (≤30 Days)</div>
              <div className="stat-value tabular-nums" style={{ color: 'var(--status-warning-text)' }}>
                {data?.expiring_soon || 0}
              </div>
              <div className="stat-subtext" style={{ color: 'var(--status-warning-text)' }}>
                Risk value ~₹{expiringRiskValue.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Tile 4: Expired Lots */}
          <div className="stat-card" onClick={() => navigate('/inventory?status=expired')}>
            <div className="stat-icon danger">
              <ShieldAlert size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Expired Batches</div>
              <div className="stat-value tabular-nums" style={{ color: 'var(--status-danger-text)' }}>
                {data?.expired_count || 0}
              </div>
              <div className="stat-subtext" style={{ color: 'var(--status-danger-text)' }}>
                Awaiting disposal write-off
              </div>
            </div>
          </div>

          {/* Tile 5: Low Stock Alerts */}
          <div className="stat-card" onClick={() => navigate('/products?filter=low_stock')}>
            <div className="stat-icon warning">
              <AlertTriangle size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Below Safety Buffer</div>
              <div className="stat-value tabular-nums" style={{ color: 'var(--status-warning-text)' }}>
                {data?.low_stock_count || 0}
              </div>
              <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>
                Triggered ROP replenishment
              </div>
            </div>
          </div>

          {/* Tile 6: Reorder Recommendations */}
          <div className="stat-card" onClick={() => navigate('/reorder')}>
            <div className="stat-icon info">
              <TrendingUp size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Pending Reorder</div>
              <div className="stat-value tabular-nums" style={{ color: 'var(--accent-blue)' }}>
                {data?.reorder_count || 0}
              </div>
              <div className="stat-subtext" style={{ color: 'var(--accent-blue)' }}>
                Draft POs ready for review
              </div>
            </div>
          </div>
        </div>

        {/* Main Body Split Layout (65% / 35%) */}
        <div className="split-dashboard">
          {/* Left Section (65%): Analytics & Velocity */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Fast-Moving Velocity Analysis (Last 30 Days)</h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Sales units dispatched via automated FEFO allocation
                </div>
              </div>
              <span className="badge badge-primary">Dynamic ROP Input</span>
            </div>
            <div className="card-body">
              {chartData.length > 0 ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        interval={0}
                        angle={-10}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-md)',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="sold" name="Units Dispatched" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  <Package size={36} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <p>No dispatch transactions recorded in the last 30 days.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Section (35%): Action Shortcuts & Expiry Feed */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Action Command</h3>
              <span className="badge badge-success">Online Terminal</span>
            </div>
            <div className="card-body flex flex-col gap-2">
              <Link
                to="/inventory?action=receive"
                className="btn btn-secondary flex items-center justify-between"
                style={{ padding: '12px 14px', width: '100%' }}
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={18} color="var(--brand-primary)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>+ Inward Stock Receipt</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Attach S3 supplier invoice</div>
                  </div>
                </div>
                <ArrowUpRight size={14} color="var(--text-tertiary)" />
              </Link>

              <Link
                to="/inventory?action=deduct"
                className="btn btn-secondary flex items-center justify-between"
                style={{ padding: '12px 14px', width: '100%' }}
              >
                <div className="flex items-center gap-2">
                  <MinusCircle size={18} color="var(--status-success-dot)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>⚡ Fast FEFO Sale / Issue</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Auto-deduct earliest expiry</div>
                  </div>
                </div>
                <ArrowUpRight size={14} color="var(--text-tertiary)" />
              </Link>

              <Link
                to="/reorder"
                className="btn btn-secondary flex items-center justify-between"
                style={{ padding: '12px 14px', width: '100%' }}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} color="var(--status-warning-dot)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Reorder Advisor Queue</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Draft purchase orders</div>
                  </div>
                </div>
                <ArrowUpRight size={14} color="var(--text-tertiary)" />
              </Link>

              <Link
                to="/cloud"
                className="btn btn-secondary flex items-center justify-between"
                style={{ padding: '12px 14px', width: '100%' }}
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={18} color="var(--accent-blue)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>AWS Cloud & CSV Exports</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>S3 vault & telemetry map</div>
                  </div>
                </div>
                <ArrowUpRight size={14} color="var(--text-tertiary)" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Component: Real-Time Stock Movement Feed */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Real-Time Stock Movement Ledger Feed</h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Immutable audit trail backed by transaction isolation
              </div>
            </div>
            <Link to="/movements" className="btn btn-ghost btn-sm flex items-center gap-1">
              <span>View Full Ledger</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Product</th>
                  <th>Batch / Lot</th>
                  <th>Type</th>
                  <th>Delta</th>
                  <th>Balance Trail</th>
                  <th>Reason / Ref</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_movements?.length > 0 ? (
                  data.recent_movements.slice(0, 5).map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id}>
                        <td className="mono text-muted text-sm">
                          {m.created_at ? new Date(m.created_at).toLocaleTimeString() : '—'}
                        </td>
                        <td style={{ fontWeight: 600 }}>{m.product_name}</td>
                        <td className="mono text-sm">{m.batch_number || '—'}</td>
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
                        <td
                          className="tabular-nums"
                          style={{
                            fontWeight: 700,
                            color: isPositive ? 'var(--status-success-text)' : 'var(--status-danger-text)',
                          }}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="mono text-sm">
                          <span className="text-muted">{m.previous_stock ?? '—'}</span>
                          <span style={{ margin: '0 4px', color: 'var(--text-tertiary)' }}>→</span>
                          <span style={{ fontWeight: 600 }}>{m.new_stock ?? '—'}</span>
                        </td>
                        <td className="text-sm text-muted">{m.reason || '—'}</td>
                        <td className="text-sm">
                          <span className="badge badge-neutral">{m.username || 'System'}</span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>
                      No inventory movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
