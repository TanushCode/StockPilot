import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  Boxes,
  PlusCircle,
  MinusCircle,
  SlidersHorizontal,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Search,
  ExternalLink,
  Sparkles,
  FileText,
} from 'lucide-react';

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isManager } = useAuth();

  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState('');

  // Modals
  const [modalType, setModalType] = useState(null); // 'receive' | 'deduct' | 'adjust' | 'writeoff'
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Forms
  const [receiveForm, setReceiveForm] = useState({
    product_id: '',
    batch_number: '',
    quantity: '50',
    unit_cost: '20',
    purchase_date: new Date().toISOString().split('T')[0],
    manufacture_date: '',
    expiry_date: '',
    reason: 'Standard stock purchase',
    invoice_file: null,
  });

  const [deductForm, setDeductForm] = useState({
    product_id: '',
    quantity: '5',
    movement_type: 'sale',
    reason: 'Counter retail sale',
  });

  const [adjustForm, setAdjustForm] = useState({
    product_id: '',
    batch_id: '',
    new_quantity: '',
    reason: 'Physical inventory count adjustment',
  });

  const [writeOffReason, setWriteOffReason] = useState('Expired shelf life beyond consumption threshold');

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const [batchRes, prodRes] = await Promise.all([
        api.getBatches(params.toString()),
        api.getProducts(),
      ]);

      setBatches(batchRes.batches || []);
      setProducts(prodRes.products || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load inventory lots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'receive') setModalType('receive');
    if (action === 'deduct') setModalType('deduct');
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      let invoice_key = null;
      if (receiveForm.invoice_file) {
        const uploadRes = await api.uploadFile(receiveForm.invoice_file);
        invoice_key = uploadRes.invoice.s3_key;
      }

      await api.receiveStock({
        product_id: Number(receiveForm.product_id),
        batch_number: receiveForm.batch_number,
        quantity: Number(receiveForm.quantity),
        unit_cost: Number(receiveForm.unit_cost),
        purchase_date: receiveForm.purchase_date || null,
        manufacture_date: receiveForm.manufacture_date || null,
        expiry_date: receiveForm.expiry_date || null,
        invoice_key,
        reason: receiveForm.reason,
      });

      setSuccess(`Inward stock confirmed: ${receiveForm.quantity} units received in lot ${receiveForm.batch_number}`);
      setModalType(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to receive stock');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeductSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      const res = await api.deductStock({
        product_id: Number(deductForm.product_id),
        quantity: Number(deductForm.quantity),
        movement_type: deductForm.movement_type,
        reason: deductForm.reason,
      });

      const count = res.deductions?.length || 1;
      setSuccess(`Deducted ${deductForm.quantity} units via automated FEFO across ${count} lot(s).`);
      setModalType(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to deduct stock');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      await api.adjustStock({
        product_id: Number(adjustForm.product_id),
        batch_id: adjustForm.batch_id ? Number(adjustForm.batch_id) : null,
        new_quantity: Number(adjustForm.new_quantity),
        reason: adjustForm.reason,
      });

      setSuccess('Physical inventory count adjustment recorded in audit ledger.');
      setModalType(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setFormLoading(false);
    }
  };

  const handleWriteOffSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setFormLoading(true);
    setError('');
    try {
      await api.writeOff(selectedBatch.id, writeOffReason);
      setSuccess(`Batch ${selectedBatch.batch_number} written off and value disposed.`);
      setModalType(null);
      setSelectedBatch(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to write off batch');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredBatches = batches.filter((b) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      b.batch_number?.toLowerCase().includes(term) ||
      b.product_name?.toLowerCase().includes(term) ||
      b.product_sku?.toLowerCase().includes(term)
    );
  });

  const totalActiveBatches = batches.filter((b) => b.remaining_quantity > 0 && !b.is_expired_written_off).length;
  const totalBatchValuation = batches
    .filter((b) => !b.is_expired_written_off)
    .reduce((sum, b) => sum + (b.remaining_quantity * b.unit_cost), 0);

  // Helper: compute shelf life percentage
  const getShelfLifePercent = (b) => {
    if (!b.expiry_date) return null;
    const exp = new Date(b.expiry_date).getTime();
    const mfg = b.manufacture_date ? new Date(b.manufacture_date).getTime() : new Date(b.created_at).getTime();
    const now = new Date().getTime();
    if (now >= exp) return 100;
    if (now <= mfg) return 0;
    return Math.min(100, Math.max(0, Math.round(((now - mfg) / (exp - mfg)) * 100)));
  };

  // Batches for the selected product in Deduct modal (for FEFO visualizer)
  const candidateBatches = deductForm.product_id
    ? batches
        .filter((b) => b.product_id === Number(deductForm.product_id) && b.remaining_quantity > 0 && !b.is_expired_written_off)
        .sort((a, b) => {
          if (!a.expiry_date) return 1;
          if (!b.expiry_date) return -1;
          return new Date(a.expiry_date) - new Date(b.expiry_date);
        })
    : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Batch Inventory & Expiry Tracker</h1>
            <span className="badge badge-primary">{totalActiveBatches} Active Lots</span>
            <span className="badge badge-success">₹{Math.round(totalBatchValuation).toLocaleString('en-IN')} Value</span>
          </div>
          <p className="page-subtitle">
            First-Expired, First-Out (FEFO) automated routing, shelf-life indicators, and S3 digital invoices
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setReceiveForm({
                product_id: products[0]?.id || '',
                batch_number: `LOT-${Date.now().toString().slice(-6)}`,
                quantity: '50',
                unit_cost: products[0]?.purchase_cost || '25',
                purchase_date: new Date().toISOString().split('T')[0],
                manufacture_date: '',
                expiry_date: '',
                reason: 'Inward purchase lot',
                invoice_file: null,
              });
              setModalType('receive');
            }}
            className="btn btn-primary"
          >
            <PlusCircle size={15} />
            <span>+ Inward Lot</span>
          </button>

          <button
            onClick={() => {
              setDeductForm({
                product_id: products[0]?.id || '',
                quantity: '5',
                movement_type: 'sale',
                reason: 'Counter sale',
              });
              setModalType('deduct');
            }}
            className="btn btn-secondary"
          >
            <MinusCircle size={15} />
            <span>⚡ Issue / Sell (FEFO)</span>
          </button>

          <button
            onClick={() => {
              setAdjustForm({
                product_id: products[0]?.id || '',
                batch_id: '',
                new_quantity: '',
                reason: 'Physical inventory count adjustment',
              });
              setModalType('adjust');
            }}
            className="btn btn-ghost"
          >
            <SlidersHorizontal size={15} />
            <span>Adjust</span>
          </button>
        </div>
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

      {/* Universal Search & Status Filter Segments (design.md 2.3) */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div className="form-row" style={{ alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 2 }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search lots by Batch ID, Product SKU, or Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${statusFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('')}
              >
                All Lots ({batches.length})
              </button>
              <button
                className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('active')}
              >
                Active
              </button>
              <button
                className={`btn btn-sm ${statusFilter === 'expiring' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('expiring')}
              >
                Expiring ≤30d
              </button>
              <button
                className={`btn btn-sm ${statusFilter === 'expired' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter('expired')}
              >
                Expired
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Granular Data Table (design.md 3.3) */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Batch / Lot ID</th>
                <th>Product & SKU</th>
                <th>Dates (Mfg → Exp)</th>
                <th>Shelf-Life Consumed</th>
                <th>Remaining / Initial</th>
                <th>Cost & Lot Value</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                    Loading batch records...
                  </td>
                </tr>
              ) : filteredBatches.length > 0 ? (
                filteredBatches.map((b) => {
                  const isExp = b.is_expired;
                  const isExpiring = b.is_expiring_soon;
                  const isWrittenOff = b.is_expired_written_off;
                  const shelfPercent = getShelfLifePercent(b);
                  const lotValuation = Math.round(b.remaining_quantity * b.unit_cost);

                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="mono font-semibold" style={{ color: 'var(--brand-primary)' }}>
                          {b.batch_number}
                        </div>
                        {b.invoice_key && (
                          <div className="flex items-center gap-1" style={{ fontSize: '0.68rem', color: 'var(--accent-blue)' }}>
                            <FileText size={10} />
                            <span>S3 Invoice Attached</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.product_name}</div>
                        <div className="mono text-muted text-sm">{b.product_sku}</div>
                      </td>
                      <td className="mono text-sm">
                        {b.manufacture_date || '—'} →{' '}
                        <strong
                          style={{
                            color: isExp ? 'var(--status-danger-text)' : isExpiring ? 'var(--status-warning-text)' : 'inherit',
                          }}
                        >
                          {b.expiry_date || 'No Expiry'}
                        </strong>
                      </td>
                      <td>
                        {shelfPercent !== null ? (
                          <div className="flex items-center">
                            <div className="shelf-life-bar">
                              <div
                                className={`shelf-life-fill ${
                                  shelfPercent >= 100 || isExp ? 'danger' : shelfPercent >= 75 || isExpiring ? 'warning' : 'healthy'
                                }`}
                                style={{ width: `${shelfPercent}%` }}
                              />
                            </div>
                            <span className="mono text-sm">{shelfPercent}%</span>
                          </div>
                        ) : (
                          <span className="text-muted text-sm">Non-perishable</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="tabular-nums font-semibold" style={{ fontSize: '0.95rem' }}>
                            {b.remaining_quantity}
                          </span>
                          <span className="text-muted text-sm">/ {b.initial_quantity} Units</span>
                        </div>
                      </td>
                      <td className="tabular-nums">
                        <div>₹{b.unit_cost}</div>
                        <div className="text-sm text-muted">₹{lotValuation.toLocaleString('en-IN')}</div>
                      </td>
                      <td>
                        {isWrittenOff ? (
                          <span className="badge badge-neutral">Written Off</span>
                        ) : isExp ? (
                          <span className="badge badge-danger">Expired</span>
                        ) : isExpiring ? (
                          <span className="badge badge-warning">Expiring Soon</span>
                        ) : b.remaining_quantity === 0 ? (
                          <span className="badge badge-neutral">Depleted</span>
                        ) : (
                          <span className="badge badge-success">Healthy Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isExp && !isWrittenOff && isManager && (
                          <button
                            onClick={() => {
                              setSelectedBatch(b);
                              setModalType('writeoff');
                            }}
                            className="btn btn-danger btn-sm"
                            title="Irreversible write-off"
                          >
                            <Trash2 size={13} />
                            <span>Write-Off</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <Boxes size={40} style={{ opacity: 0.5, marginBottom: 8 }} />
                      <h3>No stock lots match the filter</h3>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FEFO Dispatch Visualizer Modal (design.md 2.4 & 5.1) */}
      <Modal
        isOpen={modalType === 'deduct'}
        onClose={() => setModalType(null)}
        title="FEFO Dispatch Visualizer (Issue / Sale)"
        maxWidth="560px"
      >
        <form onSubmit={handleDeductSubmit}>
          <div className="alert-banner info mb-3">
            <Sparkles size={16} />
            <div style={{ fontSize: '0.8rem' }}>
              <strong>Automated FEFO Rotation: </strong> The system algorithmically routes deductions from the lot expiring earliest first to eliminate shelf waste.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select Product to Dispatch *</label>
            <select
              className="form-select"
              required
              value={deductForm.product_id}
              onChange={(e) => setDeductForm({ ...deductForm, product_id: e.target.value })}
            >
              <option value="">Choose item...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                  {p.name} ({p.sku}) — Available: {p.current_stock}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive FEFO Candidate Cards */}
          {candidateBatches.length > 0 && (
            <div className="mb-3">
              <label className="form-label">Automated Lot Allocation Hierarchy:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {candidateBatches.map((b, idx) => {
                  const isTopPick = idx === 0;
                  return (
                    <div
                      key={b.id}
                      className={isTopPick ? 'fefo-selected' : ''}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: isTopPick ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: isTopPick ? 700 : 500 }}>
                          Lot {b.batch_number} ({b.remaining_quantity} units available)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: isTopPick ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>
                          Expires: {b.expiry_date || 'No Expiry Date'}
                        </div>
                      </div>
                      {isTopPick ? (
                        <span className="badge badge-primary font-bold">FEFO Top Pick #1</span>
                      ) : (
                        <span className="badge badge-neutral">Standby #{idx + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity to Dispatch *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                required
                value={deductForm.quantity}
                onChange={(e) => setDeductForm({ ...deductForm, quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Movement Type</label>
              <select
                className="form-select"
                value={deductForm.movement_type}
                onChange={(e) => setDeductForm({ ...deductForm, movement_type: e.target.value })}
              >
                <option value="sale">Sale (Retail / Counter)</option>
                <option value="issue">Issue (Kitchen / Dept)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reference Note</label>
            <input
              type="text"
              className="form-input"
              value={deductForm.reason}
              onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value })}
            />
          </div>

          <div className="modal-footer" style={{ padding: '12px 0 0' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? 'Executing FEFO...' : 'Confirm Dispatch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Inward Receiving Modal with S3 Invoice */}
      <Modal
        isOpen={modalType === 'receive'}
        onClose={() => setModalType(null)}
        title="Receive New Inward Stock Lot"
        maxWidth="580px"
      >
        <form onSubmit={handleReceiveSubmit}>
          <div className="form-group">
            <label className="form-label">Product *</label>
            <select
              className="form-select"
              required
              value={receiveForm.product_id}
              onChange={(e) => {
                const pid = e.target.value;
                const p = products.find((prod) => prod.id === Number(pid));
                setReceiveForm({
                  ...receiveForm,
                  product_id: pid,
                  unit_cost: p ? p.purchase_cost : receiveForm.unit_cost,
                });
              }}
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — In Stock: {p.current_stock}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Lot / Batch Number *</label>
              <input
                type="text"
                className="form-input"
                required
                value={receiveForm.batch_number}
                onChange={(e) => setReceiveForm({ ...receiveForm, batch_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Quantity Received *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                required
                value={receiveForm.quantity}
                onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Cost (₹) *</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                required
                value={receiveForm.unit_cost}
                onChange={(e) => setReceiveForm({ ...receiveForm, unit_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input
                type="date"
                className="form-input"
                value={receiveForm.purchase_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, purchase_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mfg Date</label>
              <input
                type="date"
                className="form-input"
                value={receiveForm.manufacture_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, manufacture_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input
                type="date"
                className="form-input"
                value={receiveForm.expiry_date}
                onChange={(e) => setReceiveForm({ ...receiveForm, expiry_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Supplier Invoice Attachment (Amazon S3)</label>
            <input
              type="file"
              className="form-input"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setReceiveForm({ ...receiveForm, invoice_file: e.target.files[0] })}
            />
            <div className="text-sm text-muted mt-1">
              Encrypted and vaulted in Amazon S3 bucket with 1-hour presigned retrieval.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Inward Reference Notes</label>
            <input
              type="text"
              className="form-input"
              value={receiveForm.reason}
              onChange={(e) => setReceiveForm({ ...receiveForm, reason: e.target.value })}
            />
          </div>

          <div className="modal-footer" style={{ padding: '12px 0 0' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? 'Vaulting & Receiving...' : 'Confirm Inward Lot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Irreversible Disposal Write-Off Modal (design.md 2.4) */}
      <Modal
        isOpen={modalType === 'writeoff' && Boolean(selectedBatch)}
        onClose={() => {
          setModalType(null);
          setSelectedBatch(null);
        }}
        title={`Disposal Write-Off: ${selectedBatch?.batch_number}`}
        maxWidth="460px"
      >
        <form onSubmit={handleWriteOffSubmit}>
          <div className="alert-banner error mb-3">
            <AlertTriangle size={18} />
            <div>
              <strong>Irreversible Ledger Action: </strong> Writing off will remove{' '}
              <strong>{selectedBatch?.remaining_quantity} units</strong> of {selectedBatch?.product_name} from active inventory and write off ₹
              {Math.round((selectedBatch?.remaining_quantity || 0) * (selectedBatch?.unit_cost || 0)).toLocaleString('en-IN')}{' '}
              valuation from the balance sheet.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Disposal Reason *</label>
            <textarea
              className="form-input"
              rows="3"
              required
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ padding: '12px 0 0' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setModalType(null);
                setSelectedBatch(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={formLoading}>
              {formLoading ? 'Disposing...' : 'Confirm Write-Off'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
