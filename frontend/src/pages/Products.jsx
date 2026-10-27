import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function Products() {
  const [searchParams] = useSearchParams();
  const { isManager } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(
    searchParams.get('filter') === 'low_stock'
  );

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Grocery',
    supplier_id: '',
    purchase_cost: '',
    selling_price: '',
    min_stock_threshold: '10',
    reorder_quantity: '20',
    target_stock_level: '50',
    lead_time_days: '3',
    track_expiry: false,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory) params.append('category', selectedCategory);
      if (lowStockFilter) params.append('low_stock', 'true');

      const [prodsRes, catsRes, suppsRes] = await Promise.all([
        api.getProducts(params.toString()),
        api.getCategories().catch(() => ({ categories: [] })),
        api.getSuppliers().catch(() => ({ suppliers: [] })),
      ]);

      setProducts(prodsRes.products || []);
      setCategories(catsRes.categories || []);
      setSuppliers(suppsRes.suppliers || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedCategory, lowStockFilter]);

  const handleOpenAdd = () => {
    setFormData({
      sku: '',
      name: '',
      category: categories[0] || 'Grocery',
      supplier_id: suppliers[0]?.id || '',
      purchase_cost: '',
      selling_price: '',
      min_stock_threshold: '10',
      reorder_quantity: '20',
      target_stock_level: '50',
      lead_time_days: '3',
      track_expiry: false,
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (p) => {
    setCurrentProduct(p);
    setFormData({
      sku: p.sku,
      name: p.name,
      category: p.category || 'Grocery',
      supplier_id: p.supplier_id || '',
      purchase_cost: p.purchase_cost,
      selling_price: p.selling_price || '',
      min_stock_threshold: p.min_stock_threshold,
      reorder_quantity: p.reorder_quantity,
      target_stock_level: p.target_stock_level,
      lead_time_days: p.lead_time_days,
      track_expiry: Boolean(p.track_expiry),
    });
    setIsEditOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      if (isEditOpen) {
        await api.updateProduct(currentProduct.id, formData);
        setSuccess(`Product "${formData.name}" updated successfully`);
        setIsEditOpen(false);
      } else {
        await api.createProduct(formData);
        setSuccess(`Product "${formData.name}" created successfully`);
        setIsAddOpen(false);
      }
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Are you sure you want to delete product "${p.name}"?`)) return;
    try {
      await api.deleteProduct(p.id);
      setSuccess(`Product "${p.name}" deactivated`);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete product');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Catalog</h1>
          <p className="page-subtitle">
            Configure safety thresholds, categories, supplier mappings, and pricing
          </p>
        </div>
        {isManager && (
          <button onClick={handleOpenAdd} className="btn btn-primary">
            <Plus size={16} />
            <span>Add New Product</span>
          </button>
        )}
      </div>

      {success && (
        <div className="alert-banner success mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setSuccess('')}>Dismiss</button>
        </div>
      )}

      {error && (
        <div className="alert-banner error mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div className="form-row" style={{ alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 2 }}>
              <Search size={18} />
              <input
                type="text"
                className="form-input"
                placeholder="Search products by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={lowStockFilter}
                  onChange={(e) => setLowStockFilter(e.target.checked)}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Low Stock Only
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Product List Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Cost / Sell (₹)</th>
                <th>Stock Level</th>
                <th>Status</th>
                <th>Track Expiry</th>
                {isManager && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                    Loading product catalog...
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => {
                  const isLow = p.current_stock <= p.min_stock_threshold;
                  return (
                    <tr key={p.id}>
                      <td className="mono font-semibold">{p.sku}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div className="text-sm text-muted">
                          Reorder Qty: {p.reorder_quantity} | Target: {p.target_stock_level}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-secondary">{p.category}</span>
                      </td>
                      <td className="text-sm">{p.supplier_name || '—'}</td>
                      <td>
                        <div>₹{p.purchase_cost}</div>
                        <div className="text-sm text-muted">
                          {p.selling_price ? `₹${p.selling_price}` : '—'}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '1rem',
                              color: isLow ? 'var(--danger-600)' : 'var(--text-primary)',
                            }}
                          >
                            {p.current_stock}
                          </span>
                          <span className="text-sm text-muted">/ min {p.min_stock_threshold}</span>
                        </div>
                      </td>
                      <td>
                        {isLow ? (
                          <span className="badge badge-danger flex items-center gap-2">
                            <AlertTriangle size={12} />
                            <span>Low Stock</span>
                          </span>
                        ) : (
                          <span className="badge badge-success flex items-center gap-2">
                            <CheckCircle2 size={12} />
                            <span>Optimal</span>
                          </span>
                        )}
                      </td>
                      <td>
                        {p.track_expiry ? (
                          <span className="badge badge-warning flex items-center gap-2">
                            <Clock size={12} />
                            <span>Batched</span>
                          </span>
                        ) : (
                          <span className="badge badge-secondary">Standard</span>
                        )}
                      </td>
                      {isManager && (
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex items-center justify-between" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="btn-ghost btn-icon"
                              title="Edit product"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="btn-ghost btn-icon"
                              style={{ color: 'var(--danger-500)' }}
                              title="Deactivate product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px' }}>
                    <div className="empty-state">
                      <Package size={42} />
                      <h3>No products match your filters</h3>
                      <p>Try clearing filters or search term to view all inventory items.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isAddOpen || isEditOpen}
        onClose={() => {
          setIsAddOpen(false);
          setIsEditOpen(false);
        }}
        title={isEditOpen ? `Edit Product: ${currentProduct?.name}` : 'Add New Inventory Product'}
        maxWidth="650px"
      >
        <form onSubmit={handleSaveProduct}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SKU / Item Code *</label>
              <input
                type="text"
                className="form-input"
                required
                disabled={isEditOpen}
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. SNK-009"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                type="text"
                className="form-input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Grocery, Dairy, Snacks"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              className="form-input"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Whole Wheat Bread 400g"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Purchase Cost (₹) *</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                required
                value={formData.purchase_cost}
                onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select
                className="form-select"
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              >
                <option value="">None / Direct</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Min Stock Threshold</label>
              <input
                type="number"
                className="form-input"
                value={formData.min_stock_threshold}
                onChange={(e) => setFormData({ ...formData, min_stock_threshold: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reorder Quantity</label>
              <input
                type="number"
                className="form-input"
                value={formData.reorder_quantity}
                onChange={(e) => setFormData({ ...formData, reorder_quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Time (Days)</label>
              <input
                type="number"
                className="form-input"
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={formData.track_expiry}
                onChange={(e) => setFormData({ ...formData, track_expiry: e.target.checked })}
              />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                Track Batch Expiry Dates (Enables FEFO deduction & Cloud Expiry Alerts)
              </span>
            </label>
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsAddOpen(false);
                setIsEditOpen(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? 'Saving...' : isEditOpen ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
