"""
StockPilot — Unit & Integration Test Suite.
Tests auth, FEFO deduction logic, stock receipt, and reorder advisory.
"""
import pytest
from datetime import date, timedelta
from app import create_app
from app.extensions import db
from app.models import User, Product, StockBatch, StockMovement
from app.auth import hash_password, create_token
from app.services.inventory_service import (
    receive_stock, deduct_stock, get_reorder_recommendations,
)


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        # Seed test users
        mgr = User(username='testmgr', email='mgr@test.com', password_hash=hash_password('pass123'), role='manager')
        staff = User(username='teststaff', email='staff@test.com', password_hash=hash_password('pass123'), role='staff')
        db.session.add_all([mgr, staff])
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def mgr_token(app):
    with app.app_context():
        user = User.query.filter_by(username='testmgr').first()
        return create_token(user)


def test_health_check(client):
    res = client.get('/api/health')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'ok'
    assert data['database'] == 'connected'


def test_auth_login(client):
    res = client.post('/api/auth/login', json={'username': 'testmgr', 'password': 'pass123'})
    assert res.status_code == 200
    data = res.get_json()
    assert 'token' in data
    assert data['user']['role'] == 'manager'


def test_stock_receive_and_fefo_deduct(app, mgr_token):
    with app.app_context():
        mgr = User.query.filter_by(username='testmgr').first()

        # Create a batched perishable product
        product = Product(
            sku='TEST-MILK',
            name='Test Milk 1L',
            category='Dairy',
            purchase_cost=25.0,
            selling_price=30.0,
            min_stock_threshold=10,
            reorder_quantity=30,
            track_expiry=True,
        )
        db.session.add(product)
        db.session.commit()

        today = date.today()

        # Batch 1: Expires in 10 days (Earlier)
        b1, _ = receive_stock(
            product_id=product.id,
            quantity=20,
            batch_number='BATCH-EXP-EARLY',
            unit_cost=25.0,
            user_id=mgr.id,
            expiry_date=today + timedelta(days=10),
        )

        # Batch 2: Expires in 30 days (Later)
        b2, _ = receive_stock(
            product_id=product.id,
            quantity=20,
            batch_number='BATCH-EXP-LATER',
            unit_cost=25.0,
            user_id=mgr.id,
            expiry_date=today + timedelta(days=30),
        )

        assert product.current_stock == 40

        # Deduct 15 units -> FEFO must pull 15 units completely from Batch 1!
        deductions = deduct_stock(
            product_id=product.id,
            quantity=15,
            user_id=mgr.id,
            movement_type='sale',
        )

        assert len(deductions) == 1
        assert deductions[0][0].id == b1.id
        assert deductions[0][1] == 15
        assert b1.remaining_quantity == 5
        assert b2.remaining_quantity == 20
        assert product.current_stock == 25

        # Deduct 10 more units -> FEFO pulls remaining 5 from Batch 1 and 5 from Batch 2!
        deductions2 = deduct_stock(
            product_id=product.id,
            quantity=10,
            user_id=mgr.id,
            movement_type='sale',
        )

        assert len(deductions2) == 2
        assert deductions2[0][0].id == b1.id
        assert deductions2[0][1] == 5
        assert deductions2[1][0].id == b2.id
        assert deductions2[1][1] == 5
        assert b1.remaining_quantity == 0
        assert b2.remaining_quantity == 15
        assert product.current_stock == 15
