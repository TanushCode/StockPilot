"""
StockPilot - Database models.

Defines: User, Supplier, Product, StockBatch, StockMovement,
         Alert, Notification, Invoice.

Inventory is tracked per-batch with FEFO/FIFO deduction logic
implemented in the inventory service layer.
"""
from datetime import datetime, date, timezone
from app.extensions import db


# ───────────────────────────── helpers ──────────────────────────────
def _utcnow():
    return datetime.now(timezone.utc)


# ───────────────────────────── User ────────────────────────────────
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='staff')  # 'manager' | 'staff'
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=_utcnow)

    movements = db.relationship('StockMovement', backref='user', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ───────────────────────────── Supplier ────────────────────────────
class Supplier(db.Model):
    __tablename__ = 'suppliers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, index=True)
    contact_person = db.Column(db.String(100))
    phone = db.Column(db.String(30))
    email = db.Column(db.String(120))
    address = db.Column(db.Text)
    lead_time_days = db.Column(db.Integer, default=3)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=_utcnow)

    products = db.relationship('Product', backref='supplier', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'contact_person': self.contact_person,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'lead_time_days': self.lead_time_days,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ───────────────────────────── Product ─────────────────────────────
class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, index=True)
    category = db.Column(db.String(80), index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    purchase_cost = db.Column(db.Float, nullable=False, default=0.0)
    selling_price = db.Column(db.Float, nullable=True)
    current_stock = db.Column(db.Integer, nullable=False, default=0)
    min_stock_threshold = db.Column(db.Integer, nullable=False, default=10)
    reorder_quantity = db.Column(db.Integer, nullable=False, default=20)
    target_stock_level = db.Column(db.Integer, nullable=False, default=50)
    lead_time_days = db.Column(db.Integer, default=3)
    track_expiry = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=_utcnow)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)

    batches = db.relationship('StockBatch', backref='product', lazy='dynamic',
                              order_by='StockBatch.expiry_date.asc().nullslast()')
    movements = db.relationship('StockMovement', backref='product', lazy='dynamic')

    def to_dict(self, include_batches=False):
        data = {
            'id': self.id,
            'sku': self.sku,
            'name': self.name,
            'category': self.category,
            'supplier_id': self.supplier_id,
            'supplier_name': self.supplier.name if self.supplier else None,
            'purchase_cost': self.purchase_cost,
            'selling_price': self.selling_price,
            'current_stock': self.current_stock,
            'min_stock_threshold': self.min_stock_threshold,
            'reorder_quantity': self.reorder_quantity,
            'target_stock_level': self.target_stock_level,
            'lead_time_days': self.lead_time_days,
            'track_expiry': self.track_expiry,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_batches:
            data['batches'] = [b.to_dict() for b in self.batches.filter(
                StockBatch.remaining_quantity > 0
            ).all()]
        return data


# ───────────────────────────── StockBatch ──────────────────────────
class StockBatch(db.Model):
    __tablename__ = 'stock_batches'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    batch_number = db.Column(db.String(80), nullable=False)
    quantity_received = db.Column(db.Integer, nullable=False)
    remaining_quantity = db.Column(db.Integer, nullable=False)
    purchase_date = db.Column(db.Date, nullable=False, default=date.today)
    manufacture_date = db.Column(db.Date, nullable=True)
    expiry_date = db.Column(db.Date, nullable=True, index=True)
    unit_cost = db.Column(db.Float, nullable=False, default=0.0)
    invoice_key = db.Column(db.String(500), nullable=True)  # S3 object key
    is_expired_written_off = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_utcnow)

    __table_args__ = (
        db.Index('ix_batch_product_expiry', 'product_id', 'expiry_date'),
        db.CheckConstraint('remaining_quantity >= 0', name='ck_remaining_non_negative'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'batch_number': self.batch_number,
            'quantity_received': self.quantity_received,
            'remaining_quantity': self.remaining_quantity,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'manufacture_date': self.manufacture_date.isoformat() if self.manufacture_date else None,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'unit_cost': self.unit_cost,
            'invoice_key': self.invoice_key,
            'is_expired_written_off': self.is_expired_written_off,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ───────────────────────────── StockMovement (ledger) ──────────────
class StockMovement(db.Model):
    __tablename__ = 'stock_movements'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('stock_batches.id'), nullable=True)
    movement_type = db.Column(db.String(30), nullable=False, index=True)
    # Types: receive, sale, issue, adjustment, write_off, expired
    quantity = db.Column(db.Integer, nullable=False)
    previous_stock = db.Column(db.Integer, nullable=False)
    new_stock = db.Column(db.Integer, nullable=False)
    unit_cost = db.Column(db.Float, nullable=True)
    reason = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=_utcnow, index=True)

    batch = db.relationship('StockBatch', backref='movements')

    __table_args__ = (
        db.Index('ix_movement_product_date', 'product_id', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'batch_id': self.batch_id,
            'batch_number': self.batch.batch_number if self.batch else None,
            'movement_type': self.movement_type,
            'quantity': self.quantity,
            'previous_stock': self.previous_stock,
            'new_stock': self.new_stock,
            'unit_cost': self.unit_cost,
            'reason': self.reason,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ───────────────────────────── Alert ───────────────────────────────
class Alert(db.Model):
    __tablename__ = 'alerts'

    id = db.Column(db.Integer, primary_key=True)
    alert_type = db.Column(db.String(40), nullable=False, index=True)
    # Types: low_stock, near_expiry, expired, large_adjustment
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('stock_batches.id'), nullable=True)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    is_resolved = db.Column(db.Boolean, default=False)
    notification_sent = db.Column(db.Boolean, default=False)
    event_id = db.Column(db.String(100), unique=True, nullable=True)  # dedup key
    created_at = db.Column(db.DateTime, default=_utcnow, index=True)

    product = db.relationship('Product', backref='alerts')
    batch_rel = db.relationship('StockBatch', backref='alerts')

    def to_dict(self):
        return {
            'id': self.id,
            'alert_type': self.alert_type,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'batch_id': self.batch_id,
            'message': self.message,
            'is_read': self.is_read,
            'is_resolved': self.is_resolved,
            'notification_sent': self.notification_sent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ───────────────────────────── Invoice ─────────────────────────────
class Invoice(db.Model):
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    s3_key = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    content_type = db.Column(db.String(100))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=_utcnow)

    uploader = db.relationship('User', backref='invoices')

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            's3_key': self.s3_key,
            'file_size': self.file_size,
            'content_type': self.content_type,
            'uploaded_by': self.uploaded_by,
            'uploader_name': self.uploader.username if self.uploader else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
