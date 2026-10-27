"""
StockPilot — Background Worker.

Runs as a separate process on EC2 (systemd service).
Responsibilities:
  1. Poll SQS for inventory events (long polling).
  2. Process low-stock, near-expiry, and movement notifications.
  3. Publish alerts to SNS.
  4. Run periodic expiry checks (scheduled).

Usage:
    python worker.py
"""
import os
import sys
import time
import uuid
import logging
import signal
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from app.models import Product, StockBatch, Alert
from app.services.aws_services import QueueService, NotificationService
from app.services.inventory_service import (
    check_low_stock, check_expiring_batches, check_expired_batches,
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [WORKER %(levelname)s] %(name)s: %(message)s',
)
logger = logging.getLogger('stockpilot.worker')

RUNNING = True
POLL_INTERVAL = 5  # seconds between polls in local mode
EXPIRY_CHECK_INTERVAL = 3600  # run expiry check every hour


def signal_handler(sig, frame):
    global RUNNING
    logger.info("Shutdown signal received, finishing current work...")
    RUNNING = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def _create_alert_if_new(alert_type, product_id, message, batch_id=None, cooldown_minutes=60):
    """Create an alert only if a similar one hasn't been created recently."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)
    existing = Alert.query.filter(
        Alert.alert_type == alert_type,
        Alert.product_id == product_id,
        Alert.created_at >= cutoff,
    )
    if batch_id:
        existing = existing.filter(Alert.batch_id == batch_id)
    if existing.first():
        logger.debug("Alert suppressed (cooldown): %s product=%s", alert_type, product_id)
        return None

    alert = Alert(
        alert_type=alert_type,
        product_id=product_id,
        batch_id=batch_id,
        message=message,
        event_id=f"{alert_type}-{product_id}-{uuid.uuid4().hex[:8]}",
    )
    db.session.add(alert)
    db.session.commit()
    return alert


def process_event(event):
    """Handle a single SQS event."""
    event_type = event.get('event_type', '')
    event_id = event.get('event_id', 'unknown')
    logger.info("Processing event: %s (id=%s)", event_type, event_id)

    # Check for duplicate processing
    if event_id != 'unknown':
        existing = Alert.query.filter_by(event_id=event_id).first()
        if existing:
            logger.info("Duplicate event %s, skipping", event_id)
            return

    try:
        if event_type == 'stock_deducted':
            _handle_stock_deducted(event)
        elif event_type == 'stock_received':
            _handle_stock_received(event)
        elif event_type == 'stock_written_off':
            _handle_write_off(event)
        elif event_type == 'expiry_check':
            _handle_expiry_check()
        else:
            logger.warning("Unknown event type: %s", event_type)
    except Exception as e:
        logger.error("Error processing event %s: %s", event_id, e, exc_info=True)
        raise


def _handle_stock_deducted(event):
    """Check if deduction caused low stock and alert if needed."""
    product_id = event.get('product_id')
    new_stock = event.get('new_stock')
    min_threshold = event.get('min_threshold')

    if product_id and new_stock is not None and min_threshold is not None:
        if new_stock <= min_threshold:
            product = db.session.get(Product, product_id)
            if product:
                message = (
                    f"⚠️ Low Stock Alert: {product.name} (SKU: {product.sku})\n"
                    f"Current stock: {new_stock} units\n"
                    f"Minimum threshold: {min_threshold} units\n"
                    f"Reorder quantity: {product.reorder_quantity} units"
                )
                alert = _create_alert_if_new('low_stock', product_id, message)
                if alert:
                    try:
                        NotificationService.send_alert(
                            f"StockPilot: Low Stock - {product.name}",
                            message,
                        )
                        alert.notification_sent = True
                        db.session.commit()
                        logger.info("Low-stock notification sent for %s", product.name)
                    except Exception as e:
                        logger.error("SNS notification failed: %s", e)


def _handle_stock_received(event):
    """Log stock receipt and resolve any existing low-stock alerts."""
    product_id = event.get('product_id')
    if product_id:
        product = db.session.get(Product, product_id)
        if product and product.current_stock > product.min_stock_threshold:
            # Resolve low-stock alerts
            Alert.query.filter(
                Alert.alert_type == 'low_stock',
                Alert.product_id == product_id,
                Alert.is_resolved == False,  # noqa
            ).update({'is_resolved': True})
            db.session.commit()
            logger.info("Resolved low-stock alerts for %s", product.name)


def _handle_write_off(event):
    """Send notification about written-off stock."""
    product_id = event.get('product_id')
    quantity = event.get('quantity', 0)
    if product_id:
        product = db.session.get(Product, product_id)
        if product:
            message = (
                f"📋 Stock Write-Off: {product.name} (SKU: {product.sku})\n"
                f"Quantity written off: {quantity} units\n"
                f"Remaining stock: {product.current_stock} units"
            )
            try:
                NotificationService.send_alert(
                    f"StockPilot: Write-Off - {product.name}",
                    message,
                )
            except Exception as e:
                logger.error("SNS write-off notification failed: %s", e)


def _handle_expiry_check():
    """Periodic expiry scan — create alerts for near-expiry and expired batches."""
    logger.info("Running expiry check...")

    # Near-expiry (7 days)
    near_expiry = check_expiring_batches(days=7)
    for batch in near_expiry:
        message = (
            f"⏰ Near Expiry: {batch.product.name} batch {batch.batch_number}\n"
            f"Expires: {batch.expiry_date}\n"
            f"Remaining: {batch.remaining_quantity} units\n"
            f"Action needed within 7 days."
        )
        alert = _create_alert_if_new(
            'near_expiry', batch.product_id, message,
            batch_id=batch.id, cooldown_minutes=1440,  # 24 hours
        )
        if alert:
            try:
                NotificationService.send_alert(
                    f"StockPilot: Near Expiry - {batch.product.name}",
                    message,
                )
                alert.notification_sent = True
                db.session.commit()
            except Exception as e:
                logger.error("SNS expiry notification failed: %s", e)

    # Expired batches
    expired = check_expired_batches()
    for batch in expired:
        message = (
            f"🚨 EXPIRED: {batch.product.name} batch {batch.batch_number}\n"
            f"Expired on: {batch.expiry_date}\n"
            f"Remaining units: {batch.remaining_quantity}\n"
            f"These units should NOT be sold. Write-off required."
        )
        alert = _create_alert_if_new(
            'expired', batch.product_id, message,
            batch_id=batch.id, cooldown_minutes=1440,
        )
        if alert:
            try:
                NotificationService.send_alert(
                    f"StockPilot: EXPIRED - {batch.product.name}",
                    message,
                )
                alert.notification_sent = True
                db.session.commit()
            except Exception as e:
                logger.error("SNS expired notification failed: %s", e)

    logger.info("Expiry check complete: %d near-expiry, %d expired",
                len(near_expiry), len(expired))


def run_worker():
    """Main worker loop."""
    app = create_app()
    last_expiry_check = 0

    with app.app_context():
        logger.info("StockPilot worker started")

        while RUNNING:
            try:
                # ── Poll SQS ──
                events = QueueService.poll_events(max_messages=10, wait_seconds=5)
                for receipt_handle, event in events:
                    try:
                        process_event(event)
                        QueueService.delete_message(receipt_handle)
                    except Exception as e:
                        logger.error("Event processing failed (will retry): %s", e)

                # ── Periodic expiry check ──
                now = time.time()
                if now - last_expiry_check >= EXPIRY_CHECK_INTERVAL:
                    _handle_expiry_check()
                    last_expiry_check = now

            except Exception as e:
                logger.error("Worker loop error: %s", e, exc_info=True)
                time.sleep(10)

            if app.config.get('USE_LOCAL_QUEUE'):
                time.sleep(POLL_INTERVAL)

        logger.info("Worker shutting down")


if __name__ == '__main__':
    run_worker()
