import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import {
  AlertTriangle,
  CheckCheck,
  Check,
  Clock,
  ArrowRight,
  ShieldAlert,
  Bell,
  RefreshCw,
} from 'lucide-react';

export default function Alerts({ onAlertsChanged }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = unreadOnly ? 'unread_only=true' : '';
      const res = await api.getAlerts(params);
      setAlerts(res.alerts || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [unreadOnly]);

  const handleMarkRead = async (id) => {
    try {
      await api.markAlertRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
      );
      if (onAlertsChanged) onAlertsChanged();
    } catch (err) {
      alert('Failed to mark alert as read: ' + err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllAlertsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      if (onAlertsChanged) onAlertsChanged();
    } catch (err) {
      alert('Failed to mark all as read: ' + err.message);
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts & Cloud Notifications</h1>
          <p className="page-subtitle">
            Automated notifications dispatched by AWS SQS and SNS worker daemons
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="btn btn-secondary">
              <CheckCheck size={16} />
              <span>Mark All as Read</span>
            </button>
          )}
          <button onClick={loadAlerts} className="btn btn-ghost btn-icon" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className={`btn btn-sm ${!unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setUnreadOnly(false)}
              >
                All Alerts ({alerts.length})
              </button>
              <button
                className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setUnreadOnly(true)}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <div className="text-sm text-muted">
              Auto-polled via Cloud Background Queue
            </div>
          </div>
        </div>
      </div>

      {/* Alerts list */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="loading-page">
            <div className="spinner"></div>
            <p>Loading notifications...</p>
          </div>
        ) : alerts.length > 0 ? (
          alerts.map((alert) => {
            const isDanger = alert.alert_type === 'expired';
            const isWarning =
              alert.alert_type === 'low_stock' || alert.alert_type === 'near_expiry';
            const isRead = alert.is_read;

            return (
              <div
                key={alert.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${
                    isDanger
                      ? 'var(--danger-500)'
                      : isWarning
                      ? 'var(--warning-500)'
                      : 'var(--primary-500)'
                  }`,
                  opacity: isRead ? 0.75 : 1,
                  background: isRead ? 'var(--gray-50)' : 'var(--bg-card)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div
                  className="card-body flex items-center justify-between"
                  style={{ padding: '16px 22px' }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`stat-icon ${
                        isDanger ? 'danger' : isWarning ? 'warning' : 'info'
                      }`}
                      style={{ width: 38, height: 38 }}
                    >
                      {isDanger ? (
                        <ShieldAlert size={20} />
                      ) : isWarning ? (
                        <AlertTriangle size={20} />
                      ) : (
                        <Bell size={20} />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`badge ${
                            isDanger
                              ? 'badge-danger'
                              : isWarning
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}
                        >
                          {alert.alert_type.replace('_', ' ').toUpperCase()}
                        </span>
                        {!isRead && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'var(--primary-500)',
                              display: 'inline-block',
                            }}
                          ></span>
                        )}
                        <span className="mono text-muted text-sm">
                          {alert.created_at
                            ? new Date(alert.created_at).toLocaleString()
                            : '—'}
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                        {alert.message}
                      </div>

                      {alert.product_name && (
                        <div className="text-sm text-muted mt-1">
                          Product: <strong>{alert.product_name}</strong>
                          {alert.batch_number && (
                            <> | Batch: <span className="mono">{alert.batch_number}</span></>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.alert_type === 'expired' && (
                      <Link to="/inventory?status=expired" className="btn btn-secondary btn-sm">
                        <span>Write-Off</span>
                        <ArrowRight size={14} />
                      </Link>
                    )}
                    {alert.alert_type === 'low_stock' && (
                      <Link to="/reorder" className="btn btn-secondary btn-sm">
                        <span>Reorder</span>
                        <ArrowRight size={14} />
                      </Link>
                    )}
                    {alert.alert_type === 'near_expiry' && (
                      <Link to="/inventory?status=expiring" className="btn btn-secondary btn-sm">
                        <span>Review</span>
                        <ArrowRight size={14} />
                      </Link>
                    )}

                    {!isRead && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        className="btn-ghost btn-sm flex items-center gap-1"
                        title="Mark as read"
                      >
                        <Check size={16} />
                        <span>Acknowledge</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card">
            <div className="empty-state">
              <CheckCheck size={48} color="var(--accent-500)" />
              <h3>All clear! No active alerts</h3>
              <p>Your inventory levels and batch expiry dates are in good health.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
