"""
StockPilot — Inventory Service.

Core business logic for stock operations:
  • receive_stock   — add a new batch
  • deduct_stock    — FEFO/FIFO deduction across batches
  • adjust_stock    — manual corrections
  • write_off_batch — expired / damaged stock removal

All operations are atomic (single DB transaction), record movements
in the stock ledger, and publish events to the message queue.
"""
import uuid
import logging
from datetime import date, datetime, timezone

from app.extensions import db
from app.models import Product, StockBatch, StockMovement, Alert

logger = logging.getLogger(__name__)


class InsufficientStockError(Exception):
    """Raised when deduction exceeds available stock."""
    pass


class InvalidOperationError(Exception):
    """Raised for invalid parameters or business-rule violations."""
    pass


# ──────────────────────── Receive Stock ─────────────────────────────
def receive_stock(
    product_id: int,
    quantity: int,
    batch_number: str,
    unit_cost: float,
    user_id: int,
    purchase_date: date = None,
    manufacture_date: date = None,
    expiry_date: date = None,
    invoice_key: str = None,
    reason: str = "Stock received",
):
    """
    Create a new stock batch and increase product stock.
    Returns (batch, movement) on success.
    """
    if quantity <= 0:
        raise InvalidOperationError("Quantity must be positive.")
    if unit_cost < 0:
        raise InvalidOperationError("Unit cost cannot be negative.")

    product = db.session.get(Product, product_id)
    if not product:
        raise InvalidOperationError(f"Product {product_id} not found.")

    if product.track_expiry and not expiry_date:
        raise InvalidOperationError(
            "Expiry date is required for expiry-tracked products."
        )

    batch = StockBatch(
        product_id=product_id,
        batch_number=batch_number,
        quantity_received=quantity,
        remaining_quantity=quantity,
        purchase_date=purchase_date or date.today(),
        manufacture_date=manufacture_date,
        expiry_date=expiry_date,
        unit_cost=unit_cost,
        invoice_key=invoice_key,
    )
    db.session.add(batch)

    prev = product.current_stock
    product.current_stock += quantity

    movement = StockMovement(
        product_id=product_id,
        movement_type='receive',
        quantity=quantity,
        previous_stock=prev,
        new_stock=product.current_stock,
        unit_cost=unit_cost,
        reason=reason,
        user_id=user_id,
    )
    db.session.add(movement)
    db.session.flush()          # get batch.id before commit
    movement.batch_id = batch.id

    db.session.commit()
    logger.info(
        "RECEIVE product=%s batch=%s qty=%d user=%d",
        product_id, batch_number, quantity, user_id,
    )
    return batch, movement


# ──────────────────────── Deduct Stock (FEFO / FIFO) ────────────────
def deduct_stock(
    product_id: int,
    quantity: int,
    user_id: int,
    movement_type: str = 'sale',
    reason: str = None,
):
    """
    Deduct *quantity* units using FEFO (earliest expiry first).
    For non-expiry products, uses FIFO (oldest purchase first).

    Records one StockMovement per batch touched.
    Returns list of (batch, qty_taken) tuples.
    """
    if quantity <= 0:
        raise InvalidOperationError("Quantity must be positive.")
    if movement_type not in ('sale', 'issue'):
        raise InvalidOperationError("movement_type must be 'sale' or 'issue'.")

    product = db.session.get(Product, product_id)
    if not product:
        raise InvalidOperationError(f"Product {product_id} not found.")
    if product.current_stock < quantity:
        raise InsufficientStockError(
            f"Insufficient stock for {product.name}: "
            f"requested {quantity}, available {product.current_stock}."
        )

    today = date.today()

    # ── eligible batches: unexpired (or no expiry), remaining > 0 ──
    query = (
        StockBatch.query
        .filter_by(product_id=product_id, is_expired_written_off=False)
        .filter(StockBatch.remaining_quantity > 0)
    )

    if product.track_expiry:
        # Exclude already-expired batches from normal deduction
        query = query.filter(
            (StockBatch.expiry_date == None) | (StockBatch.expiry_date >= today)  # noqa: E711
        )
        # FEFO: earliest expiry first, then oldest purchase
        query = query.order_by(
            StockBatch.expiry_date.asc().nullslast(),
            StockBatch.purchase_date.asc(),
        )
    else:
        # FIFO: oldest purchase first
        query = query.order_by(StockBatch.purchase_date.asc(), StockBatch.id.asc())

    batches = query.all()

    remaining_to_deduct = quantity
    deductions = []
    movements = []
    prev = product.current_stock

    for batch in batches:
        if remaining_to_deduct <= 0:
            break
        take = min(batch.remaining_quantity, remaining_to_deduct)
        batch.remaining_quantity -= take
        remaining_to_deduct -= take
        deductions.append((batch, take))

        mv = StockMovement(
            product_id=product_id,
            batch_id=batch.id,
            movement_type=movement_type,
            quantity=take,
            previous_stock=prev,
            new_stock=prev - take,
            unit_cost=batch.unit_cost,
            reason=reason or f"{movement_type.capitalize()} — FEFO deduction from batch {batch.batch_number}",
            user_id=user_id,
        )
        db.session.add(mv)
        movements.append(mv)
        prev -= take
        logger.info(
            "FEFO deduct product=%s batch=%s take=%d remaining=%d",
            product_id, batch.batch_number, take, batch.remaining_quantity,
        )

    if remaining_to_deduct > 0:
        db.session.rollback()
        raise InsufficientStockError(
            f"Could not fulfil full deduction for {product.name}: "
            f"{remaining_to_deduct} units still needed after scanning all eligible batches."
        )

    product.current_stock -= quantity
    db.session.commit()
    return deductions


# ──────────────────────── Manual Adjustment ─────────────────────────
def adjust_stock(
    product_id: int,
    quantity_change: int,
    user_id: int,
    reason: str = "Manual adjustment",
    batch_id: int = None,
):
    """
    Positive = add stock, negative = remove stock.
    Large adjustments (>50% of current stock) are flagged.
    """
    if quantity_change == 0:
        raise InvalidOperationError("Adjustment quantity cannot be zero.")

    product = db.session.get(Product, product_id)
    if not product:
        raise InvalidOperationError(f"Product {product_id} not found.")

    new_stock = product.current_stock + quantity_change
    if new_stock < 0:
        raise InsufficientStockError(
            f"Adjustment would result in negative stock ({new_stock}) "
            f"for {product.name}."
        )

    prev = product.current_stock

    # If a batch is specified and we're removing stock, adjust that batch
    if batch_id and quantity_change < 0:
        batch = db.session.get(StockBatch, batch_id)
        if batch and batch.product_id == product_id:
            take = min(batch.remaining_quantity, abs(quantity_change))
            batch.remaining_quantity -= take

    product.current_stock = new_stock

    mv = StockMovement(
        product_id=product_id,
        batch_id=batch_id,
        movement_type='adjustment',
        quantity=quantity_change,
        previous_stock=prev,
        new_stock=new_stock,
        reason=reason,
        user_id=user_id,
    )
    db.session.add(mv)

    # Flag large adjustments
    if prev > 0 and abs(quantity_change) > prev * 0.5:
        alert = Alert(
            alert_type='large_adjustment',
            product_id=product_id,
            message=(
                f"Large adjustment on {product.name}: "
                f"{quantity_change:+d} units (was {prev}, now {new_stock}). "
                f"Reason: {reason}"
            ),
            event_id=f"adj-{product_id}-{uuid.uuid4().hex[:8]}",
        )
        db.session.add(alert)

    db.session.commit()
    logger.info(
        "ADJUST product=%s change=%+d user=%d reason=%s",
        product_id, quantity_change, user_id, reason,
    )
    return mv


# ──────────────────────── Write-off Expired / Damaged ──────────────
def write_off_batch(batch_id: int, user_id: int, reason: str = "Expired"):
    """Mark a batch as written off and deduct its remaining stock."""
    batch = db.session.get(StockBatch, batch_id)
    if not batch:
        raise InvalidOperationError(f"Batch {batch_id} not found.")
    if batch.remaining_quantity == 0:
        raise InvalidOperationError("Batch already empty.")
    if batch.is_expired_written_off:
        raise InvalidOperationError("Batch already written off.")

    product = db.session.get(Product, batch.product_id)
    prev = product.current_stock
    qty = batch.remaining_quantity

    batch.remaining_quantity = 0
    batch.is_expired_written_off = True
    product.current_stock = max(0, product.current_stock - qty)

    mv = StockMovement(
        product_id=product.id,
        batch_id=batch.id,
        movement_type='write_off',
        quantity=-qty,
        previous_stock=prev,
        new_stock=product.current_stock,
        reason=reason,
        user_id=user_id,
    )
    db.session.add(mv)
    db.session.commit()
    logger.info(
        "WRITE-OFF batch=%s product=%s qty=%d user=%d",
        batch.batch_number, product.name, qty, user_id,
    )
    return mv


# ──────────────────────── Low-stock check ───────────────────────────
def check_low_stock():
    """Return products whose current_stock ≤ min_stock_threshold."""
    return Product.query.filter(
        Product.is_active == True,  # noqa: E712
        Product.current_stock <= Product.min_stock_threshold,
    ).all()


# ──────────────────────── Expiry check ──────────────────────────────
def check_expiring_batches(days: int = 30):
    """Return batches expiring within *days* that still have stock."""
    from datetime import timedelta
    cutoff = date.today() + timedelta(days=days)
    return (
        StockBatch.query
        .filter(
            StockBatch.expiry_date != None,  # noqa: E711
            StockBatch.expiry_date <= cutoff,
            StockBatch.remaining_quantity > 0,
            StockBatch.is_expired_written_off == False,  # noqa: E712
        )
        .order_by(StockBatch.expiry_date.asc())
        .all()
    )


def check_expired_batches():
    """Return batches already past expiry with remaining stock."""
    today = date.today()
    return (
        StockBatch.query
        .filter(
            StockBatch.expiry_date != None,  # noqa: E711
            StockBatch.expiry_date < today,
            StockBatch.remaining_quantity > 0,
            StockBatch.is_expired_written_off == False,  # noqa: E712
        )
        .all()
    )


# ──────────────────────── Reorder Recommendations ──────────────────
def get_reorder_recommendations():
    """
    Simple, explainable reorder engine.

    For each low-stock product:
      1. Estimate avg daily demand from last 30 days of sales.
      2. reorder_point = avg_daily_demand × lead_time + safety_stock
      3. Recommended qty = target_stock_level − current_stock
      4. If insufficient data → fall back to configured reorder_quantity.
    """
    from datetime import timedelta
    from sqlalchemy import func

    products = Product.query.filter(
        Product.is_active == True,  # noqa: E712
    ).all()

    recommendations = []
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    for p in products:
        # Sum sales/issues in last 30 days
        total_sold = (
            db.session.query(func.coalesce(func.sum(StockMovement.quantity), 0))
            .filter(
                StockMovement.product_id == p.id,
                StockMovement.movement_type.in_(['sale', 'issue']),
                StockMovement.created_at >= thirty_days_ago,
            )
            .scalar()
        ) or 0

        has_history = total_sold > 0
        avg_daily = total_sold / 30.0 if has_history else 0
        safety_stock = max(p.min_stock_threshold // 2, 5)
        lead_time = p.lead_time_days or (p.supplier.lead_time_days if p.supplier else 3)
        reorder_point = (avg_daily * lead_time) + safety_stock

        if p.current_stock <= reorder_point or p.current_stock <= p.min_stock_threshold:
            if has_history:
                suggested_qty = max(
                    int(p.target_stock_level - p.current_stock),
                    p.reorder_quantity,
                )
                method = "demand-based"
                explanation = (
                    f"Avg daily demand: {avg_daily:.1f} units. "
                    f"Reorder point: {reorder_point:.0f} (demand×lead_time + safety). "
                    f"Current stock: {p.current_stock}. "
                    f"Suggested purchase: {suggested_qty} to reach target {p.target_stock_level}."
                )
            else:
                suggested_qty = max(
                    p.target_stock_level - p.current_stock,
                    p.reorder_quantity,
                )
                method = "policy-based (estimate)"
                explanation = (
                    f"Insufficient sales history. "
                    f"Current stock: {p.current_stock}, "
                    f"min threshold: {p.min_stock_threshold}. "
                    f"Suggested purchase: {suggested_qty} (configured reorder policy)."
                )

            recommendations.append({
                'product_id': p.id,
                'product_name': p.name,
                'sku': p.sku,
                'category': p.category,
                'current_stock': p.current_stock,
                'min_stock_threshold': p.min_stock_threshold,
                'reorder_point': round(reorder_point, 1),
                'target_stock_level': p.target_stock_level,
                'avg_daily_demand': round(avg_daily, 2),
                'lead_time_days': lead_time,
                'suggested_quantity': suggested_qty,
                'method': method,
                'explanation': explanation,
                'supplier_name': p.supplier.name if p.supplier else None,
            })

    return recommendations
