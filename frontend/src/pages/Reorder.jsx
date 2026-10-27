import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Phone,
  HelpCircle,
  CheckCircle2,
  Package,
  FileDown,
  Printer,
} from 'lucide-react';

export default function Reorder() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulatedPO, setSimulatedPO] = useState(null);
  const navigate = useNavigate();

  const loadReorder = async () => {
    try {
      setLoading(true);
      const res = await api.getReorder();
      setRecommendations(res.recommendations || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to calculate replenishment formulas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReorder();
  }, []);

  const totalReplenishmentCost = recommendations.reduce(
    (sum, r) => sum + (r.suggested_reorder_quantity * r.purchase_cost),
    0
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Intelligent Reorder Advisor & PO Generator</h1>
            <span className="badge badge-warning">{recommendations.length} SKUs Below ROP</span>
          </div>
          <p className="page-subtitle">
            Dynamic Reorder Point (ROP) recalculation using real-time sales velocity and supplier lead-time buffers
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-banner error mb-4">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon warning">
            <AlertTriangle size={18} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Stockout Risk Items</div>
            <div className="stat-value tabular-nums">{recommendations.length}</div>
            <div className="stat-subtext" style={{ color: 'var(--status-warning-text)' }}>
              Below safety buffer
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon info">
            <ShoppingCart size={18} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Units Suggested</div>
            <div className="stat-value tabular-nums">
              {recommendations.reduce((sum, r) => sum + r.suggested_reorder_quantity, 0)}
            </div>
            <div className="stat-subtext" style={{ color: 'var(--accent-blue)' }}>
              To restore target stock levels
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <TrendingUp size={18} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Est. Capital Required</div>
            <div className="stat-value tabular-nums">
              ₹{Math.round(totalReplenishmentCost).toLocaleString('en-IN')}
            </div>
            <div className="stat-subtext" style={{ color: 'var(--status-success-text)' }}>
              Wholesale PO valuation
            </div>
          </div>
        </div>
      </div>

      {/* Mathematical Formula Banner */}
      <div
        className="card mb-4"
        style={{
          background: 'var(--brand-primary-light)',
          borderColor: '#99F6E4',
        }}
      >
        <div className="card-body flex items-start gap-3" style={{ padding: '14px 18px' }}>
          <HelpCircle size={20} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#042F2E' }}>
              Mathematical Reorder Point (ROP) Replenishment Formula:
            </div>
            <div style={{ fontSize: '0.82rem', color: '#115E59', marginTop: 3 }}>
              <strong>ROP = (Avg Daily Sales Velocity × Supplier Lead Time) + Safety Stock Buffer</strong>
              <br />
              When <code>Current On-Hand Stock ≤ ROP</code>, StockPilot triggers automated recommendations and notifies management via AWS SNS.
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations Queue */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Replenishment Priority Queue</h3>
          <span className="badge badge-warning">{recommendations.length} Pending Orders</span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Product & SKU</th>
                <th>Current Stock</th>
                <th>Daily Velocity</th>
                <th>Lead Time</th>
                <th>Suggested Order</th>
                <th>Est. Cost</th>
                <th>Supplier</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                    Calculating velocity formulas...
                  </td>
                </tr>
              ) : recommendations.length > 0 ? (
                recommendations.map((rec) => {
                  const estCost = Math.round(rec.suggested_reorder_quantity * rec.purchase_cost);
                  const isCritical = rec.current_stock <= Math.round(rec.min_stock_threshold / 2);
                  return (
                    <tr key={rec.product_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{rec.product_name}</div>
                        <div className="mono text-muted text-sm">{rec.sku}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className="tabular-nums"
                            style={{
                              fontWeight: 800,
                              fontSize: '1rem',
                              color: isCritical ? 'var(--status-danger-text)' : 'var(--status-warning-text)',
                            }}
                          >
                            {rec.current_stock}
                          </span>
                          <span className="text-muted text-sm">/ min {rec.min_stock_threshold}</span>
                        </div>
                      </td>
                      <td>
                        <span className="mono">
                          {rec.daily_consumption_rate ? rec.daily_consumption_rate.toFixed(1) : '0.0'}{' '}
                          <span className="text-muted text-sm">u/day</span>
                        </span>
                      </td>
                      <td>{rec.lead_time_days || 3} days</td>
                      <td>
                        <span className="badge badge-primary">+{rec.suggested_reorder_quantity} Units</span>
                      </td>
                      <td className="tabular-nums font-semibold">₹{estCost.toLocaleString('en-IN')}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{rec.supplier_name || 'Direct Wholesale'}</div>
                        {rec.supplier_phone && (
                          <div className="text-sm text-muted flex items-center gap-1">
                            <Phone size={10} />
                            <span>{rec.supplier_phone}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex items-center justify-between" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setSimulatedPO(rec)}
                            className="btn btn-secondary btn-sm"
                            title="Generate purchase requisition slip"
                          >
                            <span>Draft PO</span>
                          </button>
                          <button
                            onClick={() => navigate('/inventory?action=receive')}
                            className="btn btn-primary btn-sm"
                            title="Receive directly"
                          >
                            <span>+ Receive</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <CheckCircle2 size={38} color="var(--status-success-dot)" style={{ marginBottom: 8 }} />
                      <h3>All inventory is adequately stocked!</h3>
                      <p>No products are currently below their reorder safety thresholds.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulated Purchase Order Drawer / Modal (design.md 3.7) */}
      {simulatedPO && (
        <div className="modal-overlay" onClick={() => setSimulatedPO(null)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Draft Purchase Order Requisition</h2>
              <button className="btn-ghost btn-icon" onClick={() => setSimulatedPO(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  padding: '16px',
                  border: '1px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-muted)',
                  marginBottom: '16px',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="mono font-semibold">PO-STOCKPILOT-2025-{Date.now().toString().slice(-4)}</span>
                  <span className="badge badge-warning">Draft Requisition</span>
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                  <strong>Vendor:</strong> {simulatedPO.supplier_name || 'Standard Wholesale Partner'}
                  <br />
                  <strong>Item:</strong> {simulatedPO.product_name} ({simulatedPO.sku})
                  <br />
                  <strong>Order Quantity:</strong> {simulatedPO.suggested_reorder_quantity} units
                  <br />
                  <strong>Estimated Wholesale Valuation:</strong> ₹
                  {(simulatedPO.suggested_reorder_quantity * simulatedPO.purchase_cost).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="text-sm text-muted">
                In an automated AWS production deployment, this requisition triggers an Amazon SNS event delivering an electronic PO directly to the supplier.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={14} />
                <span>Print PO</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSimulatedPO(null);
                  navigate('/inventory?action=receive');
                }}
              >
                Proceed to Inward Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
