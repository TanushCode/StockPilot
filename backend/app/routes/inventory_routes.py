"""
Inventory operation routes — receive, sell/issue, adjust, write-off,
batches, movements, alerts, reorder recommendations.
"""
import uuid
from datetime import date
from flask import Blueprint, request, jsonify, g

from app.extensions import db
from app.models import Product, StockBatch, StockMovement, Alert
from app.auth import login_required, manager_required
from app.services.inventory_service import (
    receive_stock, deduct_stock, adjust_stock, write_off_batch,
    check_low_stock, check_expiring_batches, check_expired_batches,
    get_reorder_recommendations,
    InsufficientStockError, InvalidOperationError,
)
from app.services.aws_services import QueueService

import logging
logger = logging.getLogger(__name__)

inventory_bp = Blueprint('inventory', __name__, url_prefix='/api/inventory')


# ═══════════════════════ RECEIVE STOCK ══════════════════════════════
@inventory_bp.route('/receive', methods=['POST'])
@login_required
def receive():
    data = request.get_json(silent=True) or {}
    required = ['product_id', 'quantity', 'batch_number', 'unit_cost']
    missing = [f for f in required if f not in data or data[f] is None]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    try:
        expiry_date = None
        if data.get('expiry_date'):
            expiry_date = date.fromisoformat(data['expiry_date'])

        manufacture_date = None
        if data.get('manufacture_date'):
            manufacture_date = date.fromisoformat(data['manufacture_date'])

        purchase_date = None
        if data.get('purchase_date'):
            purchase_date = date.fromisoformat(data['purchase_date'])

        batch, movement = receive_stock(
            product_id=int(data['product_id']),
            quantity=int(data['quantity']),
            batch_number=str(data['batch_number']),
            unit_cost=float(data['unit_cost']),
            user_id=g.current_user.id,
            purchase_date=purchase_date,
            manufacture_date=manufacture_date,
            expiry_date=expiry_date,
            invoice_key=data.get('invoice_key'),
            reason=data.get('reason', 'Stock received'),
        )

        # Publish event to SQS
        try:
            QueueService.publish_event('stock_received', {
                'product_id': batch.product_id,
                'batch_id': batch.id,
                'quantity': int(data['quantity']),
            })
        except Exception as e:
            logger.error("Failed to publish receive event: %s", e)

        return jsonify({
            'batch': batch.to_dict(),
            'movement': movement.to_dict(),
            'message': f'Received {data["quantity"]} units',
        }), 201

    except InvalidOperationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception("Receive stock failed")
        return jsonify({'error': 'Internal error processing stock receipt'}), 500


# ═══════════════════════ SELL / ISSUE STOCK ═════════════════════════
@inventory_bp.route('/deduct', methods=['POST'])
@login_required
def deduct():
    data = request.get_json(silent=True) or {}
    required = ['product_id', 'quantity', 'movement_type']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    try:
        deductions = deduct_stock(
            product_id=int(data['product_id']),
            quantity=int(data['quantity']),
            user_id=g.current_user.id,
            movement_type=data['movement_type'],
            reason=data.get('reason'),
        )

        product = db.session.get(Product, int(data['product_id']))

        # Publish event to SQS
        try:
            QueueService.publish_event('stock_deducted', {
                'product_id': int(data['product_id']),
                'quantity': int(data['quantity']),
                'movement_type': data['movement_type'],
                'new_stock': product.current_stock,
                'min_threshold': product.min_stock_threshold,
            })
        except Exception as e:
            logger.error("Failed to publish deduct event: %s", e)

        return jsonify({
            'deductions': [
                {'batch_number': b.batch_number, 'quantity_taken': q}
                for b, q in deductions
            ],
            'new_stock': product.current_stock,
            'message': f'Deducted {data["quantity"]} units using FEFO',
        })

    except InsufficientStockError as e:
        return jsonify({'error': str(e)}), 409
    except InvalidOperationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception("Deduct stock failed")
        return jsonify({'error': 'Internal error processing stock deduction'}), 500


# ═══════════════════════ ADJUST STOCK ═══════════════════════════════
@inventory_bp.route('/adjust', methods=['POST'])
@login_required
def adjust():
    data = request.get_json(silent=True) or {}
    if 'product_id' not in data or 'quantity_change' not in data:
        return jsonify({'error': 'product_id and quantity_change are required'}), 400

    try:
        mv = adjust_stock(
            product_id=int(data['product_id']),
            quantity_change=int(data['quantity_change']),
            user_id=g.current_user.id,
            reason=data.get('reason', 'Manual adjustment'),
            batch_id=data.get('batch_id'),
        )
        return jsonify({'movement': mv.to_dict(), 'message': 'Stock adjusted'})

    except (InsufficientStockError, InvalidOperationError) as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception("Adjust stock failed")
        return jsonify({'error': 'Internal error processing adjustment'}), 500


# ═══════════════════════ WRITE-OFF ══════════════════════════════════
@inventory_bp.route('/write-off/<int:batch_id>', methods=['POST'])
@manager_required
def write_off(batch_id):
    data = request.get_json(silent=True) or {}
    try:
        mv = write_off_batch(
            batch_id=batch_id,
            user_id=g.current_user.id,
            reason=data.get('reason', 'Expired stock write-off'),
        )

        try:
            QueueService.publish_event('stock_written_off', {
                'batch_id': batch_id,
                'product_id': mv.product_id,
                'quantity': abs(mv.quantity),
            })
        except Exception as e:
            logger.error("Failed to publish write-off event: %s", e)

        return jsonify({'movement': mv.to_dict(), 'message': 'Batch written off'})

    except InvalidOperationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception("Write-off failed")
        return jsonify({'error': 'Internal error processing write-off'}), 500


# ═══════════════════════ BATCHES ════════════════════════════════════
@inventory_bp.route('/batches', methods=['GET'])
@login_required
def list_batches():
    product_id = request.args.get('product_id', type=int)
    show_empty = request.args.get('show_empty', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    q = StockBatch.query
    if product_id:
        q = q.filter_by(product_id=product_id)
    if not show_empty:
        q = q.filter(StockBatch.remaining_quantity > 0)

    q = q.order_by(StockBatch.expiry_date.asc().nullslast(), StockBatch.purchase_date.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'batches': [b.to_dict() for b in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })


# ═══════════════════════ MOVEMENTS ══════════════════════════════════
@inventory_bp.route('/movements', methods=['GET'])
@login_required
def list_movements():
    product_id = request.args.get('product_id', type=int)
    movement_type = request.args.get('type')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    q = StockMovement.query
    if product_id:
        q = q.filter_by(product_id=product_id)
    if movement_type:
        q = q.filter_by(movement_type=movement_type)

    q = q.order_by(StockMovement.created_at.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'movements': [m.to_dict() for m in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })


# ═══════════════════════ ALERTS ═════════════════════════════════════
@inventory_bp.route('/alerts', methods=['GET'])
@login_required
def list_alerts():
    alert_type = request.args.get('type')
    unread_only = request.args.get('unread', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    q = Alert.query
    if alert_type:
        q = q.filter_by(alert_type=alert_type)
    if unread_only:
        q = q.filter_by(is_read=False)

    q = q.order_by(Alert.created_at.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'alerts': [a.to_dict() for a in pagination.items],
        'total': pagination.total,
        'unread_count': Alert.query.filter_by(is_read=False).count(),
    })


@inventory_bp.route('/alerts/<int:aid>/read', methods=['POST'])
@login_required
def mark_alert_read(aid):
    alert = db.session.get(Alert, aid)
    if not alert:
        return jsonify({'error': 'Alert not found'}), 404
    alert.is_read = True
    db.session.commit()
    return jsonify({'message': 'Alert marked as read'})


@inventory_bp.route('/alerts/read-all', methods=['POST'])
@login_required
def mark_all_alerts_read():
    Alert.query.filter_by(is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All alerts marked as read'})


# ═══════════════════════ LOW STOCK ══════════════════════════════════
@inventory_bp.route('/low-stock', methods=['GET'])
@login_required
def low_stock():
    products = check_low_stock()
    return jsonify({
        'products': [p.to_dict() for p in products],
        'count': len(products),
    })


# ═══════════════════════ EXPIRY ═════════════════════════════════════
@inventory_bp.route('/expiring', methods=['GET'])
@login_required
def expiring():
    days = request.args.get('days', 30, type=int)
    batches = check_expiring_batches(days)
    return jsonify({
        'batches': [{
            **b.to_dict(),
            'product_name': b.product.name if b.product else None,
        } for b in batches],
        'count': len(batches),
    })


@inventory_bp.route('/expired', methods=['GET'])
@login_required
def expired():
    batches = check_expired_batches()
    return jsonify({
        'batches': [{
            **b.to_dict(),
            'product_name': b.product.name if b.product else None,
        } for b in batches],
        'count': len(batches),
    })


# ═══════════════════════ REORDER ════════════════════════════════════
@inventory_bp.route('/reorder', methods=['GET'])
@login_required
def reorder():
    recs = get_reorder_recommendations()
    return jsonify({
        'recommendations': recs,
        'count': len(recs),
    })


# ═══════════════════════ DASHBOARD ══════════════════════════════════
@inventory_bp.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    from sqlalchemy import func
    from datetime import datetime, timedelta, timezone

    total_products = Product.query.filter_by(is_active=True).count()
    total_stock = db.session.query(
        func.coalesce(func.sum(Product.current_stock), 0)
    ).filter(Product.is_active == True).scalar()  # noqa

    inventory_value = db.session.query(
        func.coalesce(func.sum(Product.current_stock * Product.purchase_cost), 0)
    ).filter(Product.is_active == True).scalar()  # noqa

    low_stock_count = Product.query.filter(
        Product.is_active == True,  # noqa
        Product.current_stock <= Product.min_stock_threshold,
    ).count()

    today = date.today()
    from datetime import timedelta as td
    expiring_soon = StockBatch.query.filter(
        StockBatch.expiry_date != None,  # noqa
        StockBatch.expiry_date <= today + td(days=30),
        StockBatch.expiry_date >= today,
        StockBatch.remaining_quantity > 0,
        StockBatch.is_expired_written_off == False,  # noqa
    ).count()

    expired_count = StockBatch.query.filter(
        StockBatch.expiry_date != None,  # noqa
        StockBatch.expiry_date < today,
        StockBatch.remaining_quantity > 0,
        StockBatch.is_expired_written_off == False,  # noqa
    ).count()

    unread_alerts = Alert.query.filter_by(is_read=False).count()

    # Recent movements
    recent = StockMovement.query.order_by(
        StockMovement.created_at.desc()
    ).limit(10).all()

    # Fast-moving products (top 5 by sales in last 30 days)
    thirty_ago = datetime.now(timezone.utc) - td(days=30)
    fast_movers = (
        db.session.query(
            Product.id, Product.name, Product.sku,
            func.coalesce(func.sum(StockMovement.quantity), 0).label('total_sold')
        )
        .join(StockMovement, StockMovement.product_id == Product.id)
        .filter(
            StockMovement.movement_type.in_(['sale', 'issue']),
            StockMovement.created_at >= thirty_ago,
        )
        .group_by(Product.id, Product.name, Product.sku)
        .order_by(func.sum(StockMovement.quantity).desc())
        .limit(5)
        .all()
    )

    reorder_count = len(get_reorder_recommendations())

    return jsonify({
        'total_products': total_products,
        'total_stock': total_stock,
        'inventory_value': round(float(inventory_value), 2),
        'low_stock_count': low_stock_count,
        'expiring_soon': expiring_soon,
        'expired_count': expired_count,
        'unread_alerts': unread_alerts,
        'reorder_count': reorder_count,
        'recent_movements': [m.to_dict() for m in recent],
        'fast_movers': [
            {'id': fm[0], 'name': fm[1], 'sku': fm[2], 'total_sold': fm[3]}
            for fm in fast_movers
        ],
    })
