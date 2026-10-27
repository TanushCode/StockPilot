"""
StockPilot — Seed / Demo Data Script.

Creates demonstration manager & staff accounts plus realistic
inventory data for presentation purposes.

Usage:
    cd backend
    python seed.py

WARNING: This drops and recreates all tables. Demo data only.
"""
from datetime import date, datetime, timedelta, timezone
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from app.models import User, Supplier, Product, StockBatch, StockMovement, Alert
from app.auth import hash_password

app = create_app('development')


def seed():
    with app.app_context():
        db.create_all()

        # ── Clear existing demo data ──
        db.session.query(Alert).delete()
        db.session.query(StockMovement).delete()
        db.session.query(StockBatch).delete()
        db.session.query(Product).delete()
        db.session.query(Supplier).delete()
        db.session.query(User).delete()
        db.session.commit()

        # ═══════════════════ USERS ══════════════════════════════════
        manager = User(
            username='manager',
            email='manager@stockpilot.demo',
            password_hash=hash_password('manager123'),
            role='manager',
        )
        staff = User(
            username='staff',
            email='staff@stockpilot.demo',
            password_hash=hash_password('staff123'),
            role='staff',
        )
        db.session.add_all([manager, staff])
        db.session.flush()

        # ═══════════════════ SUPPLIERS ══════════════════════════════
        sup_metro = Supplier(
            name='Metro Wholesale',
            contact_person='Rajesh Kumar',
            phone='+91-9876543210',
            email='rajesh@metrowholesale.in',
            address='Sector 18, Noida, UP',
            lead_time_days=3,
        )
        sup_fresh = Supplier(
            name='FreshFarm Dairy',
            contact_person='Priya Singh',
            phone='+91-9123456789',
            email='priya@freshfarm.in',
            address='Anand, Gujarat',
            lead_time_days=2,
        )
        sup_stat = Supplier(
            name='National Stationery Co.',
            contact_person='Amit Verma',
            phone='+91-8765432109',
            email='amit@nationalstat.in',
            address='Sadar Bazaar, Delhi',
            lead_time_days=5,
        )
        db.session.add_all([sup_metro, sup_fresh, sup_stat])
        db.session.flush()

        today = date.today()

        # ═══════════════════ PRODUCTS & BATCHES ═════════════════════
        products_data = [
            # (sku, name, cat, supplier, cost, price, stock, min_t, reorder, target, lead, track_expiry, batches)
            {
                'sku': 'GRO-001', 'name': 'Tata Salt (1kg)', 'category': 'Grocery',
                'supplier': sup_metro, 'cost': 22.0, 'price': 28.0,
                'min_t': 20, 'reorder': 50, 'target': 100, 'lead': 3, 'track_expiry': False,
                'batches': [
                    {'bn': 'SALT-2024-A', 'qty': 80, 'date': today - timedelta(days=15), 'cost': 22.0},
                ],
            },
            {
                'sku': 'DAI-001', 'name': 'Amul Butter (500g)', 'category': 'Dairy',
                'supplier': sup_fresh, 'cost': 260.0, 'price': 290.0,
                'min_t': 10, 'reorder': 20, 'target': 40, 'lead': 2, 'track_expiry': True,
                'batches': [
                    {'bn': 'BTR-2024-A', 'qty': 25, 'date': today - timedelta(days=10),
                     'cost': 260.0, 'expiry': today + timedelta(days=45), 'mfg': today - timedelta(days=10)},
                    {'bn': 'BTR-2024-B', 'qty': 10, 'date': today - timedelta(days=30),
                     'cost': 255.0, 'expiry': today + timedelta(days=5), 'mfg': today - timedelta(days=30)},
                    # ^^^ near-expiry batch (5 days left)
                ],
            },
            {
                'sku': 'DAI-002', 'name': 'Mother Dairy Milk (1L)', 'category': 'Dairy',
                'supplier': sup_fresh, 'cost': 54.0, 'price': 60.0,
                'min_t': 15, 'reorder': 30, 'target': 60, 'lead': 1, 'track_expiry': True,
                'batches': [
                    {'bn': 'MLK-2024-A', 'qty': 5, 'date': today - timedelta(days=3),
                     'cost': 54.0, 'expiry': today + timedelta(days=4), 'mfg': today - timedelta(days=3)},
                    # ^^^ low-stock product (5 < 15 threshold)
                ],
            },
            {
                'sku': 'SNK-001', 'name': 'Lay\'s Classic Chips (52g)', 'category': 'Snacks',
                'supplier': sup_metro, 'cost': 18.0, 'price': 20.0,
                'min_t': 30, 'reorder': 60, 'target': 120, 'lead': 3, 'track_expiry': True,
                'batches': [
                    {'bn': 'CHIP-2024-A', 'qty': 60, 'date': today - timedelta(days=20),
                     'cost': 18.0, 'expiry': today + timedelta(days=90), 'mfg': today - timedelta(days=20)},
                    {'bn': 'CHIP-2024-OLD', 'qty': 12, 'date': today - timedelta(days=120),
                     'cost': 17.0, 'expiry': today - timedelta(days=5), 'mfg': today - timedelta(days=120)},
                    # ^^^ expired batch
                ],
            },
            {
                'sku': 'BEV-001', 'name': 'Coca-Cola (500ml)', 'category': 'Beverages',
                'supplier': sup_metro, 'cost': 35.0, 'price': 40.0,
                'min_t': 25, 'reorder': 50, 'target': 100, 'lead': 3, 'track_expiry': True,
                'batches': [
                    {'bn': 'COLA-2024-A', 'qty': 80, 'date': today - timedelta(days=5),
                     'cost': 35.0, 'expiry': today + timedelta(days=180), 'mfg': today - timedelta(days=5)},
                ],
            },
            {
                'sku': 'STA-001', 'name': 'Classmate Notebook (200 pages)', 'category': 'Stationery',
                'supplier': sup_stat, 'cost': 45.0, 'price': 60.0,
                'min_t': 20, 'reorder': 40, 'target': 80, 'lead': 5, 'track_expiry': False,
                'batches': [
                    {'bn': 'NB-2024-A', 'qty': 50, 'date': today - timedelta(days=25), 'cost': 45.0},
                ],
            },
            {
                'sku': 'STA-002', 'name': 'Reynolds Ball Pen (Pack of 5)', 'category': 'Stationery',
                'supplier': sup_stat, 'cost': 50.0, 'price': 65.0,
                'min_t': 15, 'reorder': 30, 'target': 60, 'lead': 5, 'track_expiry': False,
                'batches': [
                    {'bn': 'PEN-2024-A', 'qty': 8, 'date': today - timedelta(days=10), 'cost': 50.0},
                    # ^^^ low stock (8 < 15)
                ],
            },
            {
                'sku': 'GRO-002', 'name': 'Maggi Noodles (Pack of 4)', 'category': 'Grocery',
                'supplier': sup_metro, 'cost': 48.0, 'price': 56.0,
                'min_t': 20, 'reorder': 40, 'target': 80, 'lead': 3, 'track_expiry': True,
                'batches': [
                    {'bn': 'MAG-2024-A', 'qty': 40, 'date': today - timedelta(days=7),
                     'cost': 48.0, 'expiry': today + timedelta(days=150), 'mfg': today - timedelta(days=7)},
                ],
            },
        ]

        for pd in products_data:
            total_stock = sum(b['qty'] for b in pd['batches'])
            product = Product(
                sku=pd['sku'], name=pd['name'], category=pd['category'],
                supplier_id=pd['supplier'].id,
                purchase_cost=pd['cost'], selling_price=pd['price'],
                current_stock=total_stock,
                min_stock_threshold=pd['min_t'], reorder_quantity=pd['reorder'],
                target_stock_level=pd['target'], lead_time_days=pd['lead'],
                track_expiry=pd['track_expiry'],
            )
            db.session.add(product)
            db.session.flush()

            for bd in pd['batches']:
                batch = StockBatch(
                    product_id=product.id,
                    batch_number=bd['bn'],
                    quantity_received=bd['qty'],
                    remaining_quantity=bd['qty'],
                    purchase_date=bd['date'],
                    manufacture_date=bd.get('mfg'),
                    expiry_date=bd.get('expiry'),
                    unit_cost=bd['cost'],
                )
                db.session.add(batch)
                db.session.flush()

                # Record receive movement
                mv = StockMovement(
                    product_id=product.id,
                    batch_id=batch.id,
                    movement_type='receive',
                    quantity=bd['qty'],
                    previous_stock=0,
                    new_stock=bd['qty'],
                    unit_cost=bd['cost'],
                    reason='Initial stock (demo data)',
                    user_id=manager.id,
                    created_at=datetime.combine(bd['date'], datetime.min.time()).replace(tzinfo=timezone.utc),
                )
                db.session.add(mv)

        # ── Add some sales movements for reorder calculations ──
        # Simulate sales over the last 30 days for Coca-Cola and Maggi
        cola = Product.query.filter_by(sku='BEV-001').first()
        maggi = Product.query.filter_by(sku='GRO-002').first()

        for i in range(20):
            day = today - timedelta(days=i + 1)
            for prod, qty in [(cola, 3), (maggi, 2)]:
                if prod:
                    mv = StockMovement(
                        product_id=prod.id,
                        movement_type='sale',
                        quantity=qty,
                        previous_stock=prod.current_stock,
                        new_stock=prod.current_stock - qty,
                        reason='Demo sale',
                        user_id=staff.id,
                        created_at=datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc),
                    )
                    db.session.add(mv)

        # ── Add some demo alerts ──
        milk = Product.query.filter_by(sku='DAI-002').first()
        if milk:
            alert = Alert(
                alert_type='low_stock',
                product_id=milk.id,
                message=f'Low stock alert: {milk.name} has only {milk.current_stock} units (threshold: {milk.min_stock_threshold})',
                event_id='demo-low-stock-milk',
            )
            db.session.add(alert)

        chips = Product.query.filter_by(sku='SNK-001').first()
        if chips:
            expired_batch = StockBatch.query.filter(
                StockBatch.product_id == chips.id,
                StockBatch.expiry_date < today,
            ).first()
            if expired_batch:
                alert = Alert(
                    alert_type='expired',
                    product_id=chips.id,
                    batch_id=expired_batch.id,
                    message=f'Expired batch: {expired_batch.batch_number} of {chips.name} expired on {expired_batch.expiry_date}',
                    event_id='demo-expired-chips',
                )
                db.session.add(alert)

        db.session.commit()
        print("[SUCCESS] Seed data created successfully!")
        print()
        print("Demo accounts:")
        print("  Manager -> username: manager  password: manager123")
        print("  Staff   -> username: staff    password: staff123")
        print()
        print("Demo data includes:")
        print("  - 8 products across Grocery, Dairy, Snacks, Beverages, Stationery")
        print("  - 3 suppliers")
        print("  - Near-expiry batch (Amul Butter BTR-2024-B)")
        print("  - Expired batch (Lay's Chips CHIP-2024-OLD)")
        print("  - Low-stock products (Mother Dairy Milk, Reynolds Pen)")
        print("  - 20 days of sales history for reorder calculations")
        print("  - Sample alerts for low stock and expired items")


if __name__ == '__main__':
    seed()
