"""Product & Supplier CRUD routes."""
from flask import Blueprint, request, jsonify, g

from app.extensions import db
from app.models import Product, Supplier
from app.auth import login_required, manager_required

import logging
logger = logging.getLogger(__name__)

product_bp = Blueprint('products', __name__, url_prefix='/api')


# ═══════════════════════ PRODUCTS ═══════════════════════════════════
@product_bp.route('/products', methods=['GET'])
@login_required
def list_products():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    category = request.args.get('category')
    search = request.args.get('search', '').strip()
    low_stock = request.args.get('low_stock', '').lower() == 'true'

    q = Product.query.filter_by(is_active=True)
    if category:
        q = q.filter_by(category=category)
    if search:
        q = q.filter(Product.name.ilike(f'%{search}%') | Product.sku.ilike(f'%{search}%'))
    if low_stock:
        q = q.filter(Product.current_stock <= Product.min_stock_threshold)

    q = q.order_by(Product.name.asc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'products': [p.to_dict() for p in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })


@product_bp.route('/products/<int:pid>', methods=['GET'])
@login_required
def get_product(pid):
    p = db.session.get(Product, pid)
    if not p:
        return jsonify({'error': 'Product not found'}), 404
    return jsonify({'product': p.to_dict(include_batches=True)})


@product_bp.route('/products', methods=['POST'])
@manager_required
def create_product():
    data = request.get_json(silent=True) or {}
    required = ['sku', 'name', 'purchase_cost']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    if Product.query.filter_by(sku=data['sku']).first():
        return jsonify({'error': 'SKU already exists'}), 409

    product = Product(
        sku=data['sku'],
        name=data['name'],
        category=data.get('category', 'General'),
        supplier_id=data.get('supplier_id'),
        purchase_cost=float(data['purchase_cost']),
        selling_price=float(data['selling_price']) if data.get('selling_price') else None,
        min_stock_threshold=int(data.get('min_stock_threshold', 10)),
        reorder_quantity=int(data.get('reorder_quantity', 20)),
        target_stock_level=int(data.get('target_stock_level', 50)),
        lead_time_days=int(data.get('lead_time_days', 3)),
        track_expiry=bool(data.get('track_expiry', False)),
    )
    db.session.add(product)
    db.session.commit()
    logger.info("PRODUCT CREATED id=%d sku=%s by user=%s", product.id, product.sku, g.current_user.username)
    return jsonify({'product': product.to_dict()}), 201


@product_bp.route('/products/<int:pid>', methods=['PUT'])
@manager_required
def update_product(pid):
    product = db.session.get(Product, pid)
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    data = request.get_json(silent=True) or {}

    for field in ['name', 'category', 'sku']:
        if field in data:
            setattr(product, field, data[field])
    for field in ['purchase_cost', 'selling_price']:
        if field in data and data[field] is not None:
            setattr(product, field, float(data[field]))
    for field in ['min_stock_threshold', 'reorder_quantity', 'target_stock_level', 'lead_time_days', 'supplier_id']:
        if field in data:
            setattr(product, field, int(data[field]) if data[field] is not None else None)
    if 'track_expiry' in data:
        product.track_expiry = bool(data['track_expiry'])

    db.session.commit()
    return jsonify({'product': product.to_dict()})


@product_bp.route('/products/<int:pid>', methods=['DELETE'])
@manager_required
def delete_product(pid):
    product = db.session.get(Product, pid)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    product.is_active = False
    db.session.commit()
    return jsonify({'message': 'Product deactivated'})


@product_bp.route('/products/categories', methods=['GET'])
@login_required
def list_categories():
    cats = db.session.query(Product.category).filter(
        Product.is_active == True, Product.category != None  # noqa
    ).distinct().all()
    return jsonify({'categories': sorted([c[0] for c in cats if c[0]])})


# ═══════════════════════ SUPPLIERS ══════════════════════════════════
@product_bp.route('/suppliers', methods=['GET'])
@login_required
def list_suppliers():
    suppliers = Supplier.query.filter_by(is_active=True).order_by(Supplier.name).all()
    return jsonify({'suppliers': [s.to_dict() for s in suppliers]})


@product_bp.route('/suppliers/<int:sid>', methods=['GET'])
@login_required
def get_supplier(sid):
    s = db.session.get(Supplier, sid)
    if not s:
        return jsonify({'error': 'Supplier not found'}), 404
    return jsonify({'supplier': s.to_dict()})


@product_bp.route('/suppliers', methods=['POST'])
@manager_required
def create_supplier():
    data = request.get_json(silent=True) or {}
    if not data.get('name'):
        return jsonify({'error': 'Supplier name is required'}), 400

    supplier = Supplier(
        name=data['name'],
        contact_person=data.get('contact_person'),
        phone=data.get('phone'),
        email=data.get('email'),
        address=data.get('address'),
        lead_time_days=int(data.get('lead_time_days', 3)),
    )
    db.session.add(supplier)
    db.session.commit()
    return jsonify({'supplier': supplier.to_dict()}), 201


@product_bp.route('/suppliers/<int:sid>', methods=['PUT'])
@manager_required
def update_supplier(sid):
    supplier = db.session.get(Supplier, sid)
    if not supplier:
        return jsonify({'error': 'Supplier not found'}), 404

    data = request.get_json(silent=True) or {}
    for field in ['name', 'contact_person', 'phone', 'email', 'address']:
        if field in data:
            setattr(supplier, field, data[field])
    if 'lead_time_days' in data:
        supplier.lead_time_days = int(data['lead_time_days'])
    db.session.commit()
    return jsonify({'supplier': supplier.to_dict()})


@product_bp.route('/suppliers/<int:sid>', methods=['DELETE'])
@manager_required
def delete_supplier(sid):
    supplier = db.session.get(Supplier, sid)
    if not supplier:
        return jsonify({'error': 'Supplier not found'}), 404
    supplier.is_active = False
    db.session.commit()
    return jsonify({'message': 'Supplier deactivated'})
