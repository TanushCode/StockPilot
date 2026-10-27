"""
StockPilot — Flask application factory.
"""
import os
import logging
from flask import Flask, jsonify

from app.extensions import db, migrate, cors
from app.config import config_map


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)

    # ── Load config ──
    cfg_class = config_map.get(config_name)
    if cfg_class is None:
        raise RuntimeError(f"Unknown config: {config_name}")

    if config_name == 'production':
        app.config.from_object(cfg_class())
    else:
        app.config.from_object(cfg_class)

    # ── Logging ──
    logging.basicConfig(
        level=logging.DEBUG if app.config['DEBUG'] else logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    )

    # ── Extensions ──
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # Ensure local upload dir exists
    if app.config.get('USE_LOCAL_STORAGE'):
        os.makedirs(app.config.get('LOCAL_UPLOAD_DIR', './uploads'), exist_ok=True)

    # ── Register blueprints ──
    from app.routes.auth_routes import auth_bp
    from app.routes.product_routes import product_bp
    from app.routes.inventory_routes import inventory_bp
    from app.routes.file_routes import file_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(file_bp)

    # ── Health check ──
    @app.route('/api/health')
    def health():
        try:
            db.session.execute(db.text('SELECT 1'))
            db_status = 'connected'
        except Exception as e:
            db_status = f'error: {e}'
        return jsonify({
            'status': 'ok',
            'database': db_status,
            'environment': config_name,
        })

    # ── Error handlers ──
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error'}), 500

    return app
