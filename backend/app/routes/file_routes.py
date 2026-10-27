"""File upload/download and report export routes."""
import os
import io
import csv
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g, send_from_directory, current_app

from app.extensions import db
from app.models import Invoice, Product, StockMovement, StockBatch
from app.auth import login_required, manager_required
from app.services.aws_services import StorageService

import logging
logger = logging.getLogger(__name__)

file_bp = Blueprint('files', __name__, url_prefix='/api/files')

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ═══════════════════════ UPLOAD ═════════════════════════════════════
@file_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not _allowed_file(f.filename):
        return jsonify({'error': f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

    # Check size
    f.seek(0, os.SEEK_END)
    size = f.tell()
    f.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({'error': f'File too large. Maximum: {MAX_FILE_SIZE // (1024*1024)}MB'}), 400

    ext = f.filename.rsplit('.', 1)[1].lower()
    object_key = f"invoices/{uuid.uuid4().hex}.{ext}"

    try:
        StorageService.upload_file(f, object_key, f.content_type or 'application/octet-stream')
    except Exception as e:
        logger.error("Upload failed: %s", e)
        return jsonify({'error': 'File upload failed'}), 500

    invoice = Invoice(
        filename=f.filename,
        s3_key=object_key,
        file_size=size,
        content_type=f.content_type,
        uploaded_by=g.current_user.id,
    )
    db.session.add(invoice)
    db.session.commit()

    logger.info("UPLOAD user=%s file=%s key=%s", g.current_user.username, f.filename, object_key)
    return jsonify({
        'invoice': invoice.to_dict(),
        'message': 'File uploaded successfully',
    }), 201


@file_bp.route('/invoices', methods=['GET'])
@login_required
def list_invoices():
    invoices = Invoice.query.order_by(Invoice.created_at.desc()).all()
    return jsonify({'invoices': [i.to_dict() for i in invoices]})


@file_bp.route('/invoices/<int:iid>/download', methods=['GET'])
@login_required
def download_invoice(iid):
    invoice = db.session.get(Invoice, iid)
    if not invoice:
        return jsonify({'error': 'Invoice not found'}), 404

    try:
        url = StorageService.get_download_url(invoice.s3_key)
        return jsonify({'download_url': url, 'filename': invoice.filename})
    except Exception as e:
        logger.error("Download URL failed: %s", e)
        return jsonify({'error': 'Could not generate download link'}), 500


# Local file serving (dev only)
@file_bp.route('/local/<path:key>', methods=['GET'])
def serve_local(key):
    upload_dir = current_app.config.get('LOCAL_UPLOAD_DIR', './uploads')
    directory = os.path.dirname(os.path.join(upload_dir, key))
    filename = os.path.basename(key)
    return send_from_directory(os.path.abspath(directory), filename)


# ═══════════════════════ REPORTS / CSV EXPORT ═══════════════════════
@file_bp.route('/export/inventory', methods=['GET'])
@login_required
def export_inventory():
    products = Product.query.filter_by(is_active=True).order_by(Product.name).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'SKU', 'Name', 'Category', 'Supplier', 'Purchase Cost',
        'Selling Price', 'Current Stock', 'Min Threshold',
        'Reorder Qty', 'Target Stock', 'Track Expiry',
    ])
    for p in products:
        writer.writerow([
            p.sku, p.name, p.category,
            p.supplier.name if p.supplier else '',
            p.purchase_cost, p.selling_price or '',
            p.current_stock, p.min_stock_threshold,
            p.reorder_quantity, p.target_stock_level,
            'Yes' if p.track_expiry else 'No',
        ])

    csv_content = output.getvalue()

    # Upload to S3 (or local) and return link
    object_key = f"reports/inventory_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    try:
        buf = io.BytesIO(csv_content.encode('utf-8'))
        StorageService.upload_file(buf, object_key, 'text/csv')
        url = StorageService.get_download_url(object_key)
    except Exception:
        # Fallback: return CSV inline
        from flask import Response
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=inventory_report.csv'},
        )

    return jsonify({'download_url': url, 'filename': f'inventory_report.csv'})


@file_bp.route('/export/movements', methods=['GET'])
@login_required
def export_movements():
    movements = StockMovement.query.order_by(StockMovement.created_at.desc()).limit(1000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'ID', 'Product', 'Batch', 'Type', 'Quantity',
        'Previous Stock', 'New Stock', 'Reason', 'User', 'Date',
    ])
    for m in movements:
        writer.writerow([
            m.id,
            m.product.name if m.product else '',
            m.batch.batch_number if m.batch else '',
            m.movement_type, m.quantity,
            m.previous_stock, m.new_stock,
            m.reason or '', m.user.username if m.user else '',
            m.created_at.isoformat() if m.created_at else '',
        ])

    csv_content = output.getvalue()
    object_key = f"reports/movements_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    try:
        buf = io.BytesIO(csv_content.encode('utf-8'))
        StorageService.upload_file(buf, object_key, 'text/csv')
        url = StorageService.get_download_url(object_key)
    except Exception:
        from flask import Response
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=movements_report.csv'},
        )

    return jsonify({'download_url': url, 'filename': 'movements_report.csv'})
