"""Auth routes — login, token refresh, current-user info."""
from flask import Blueprint, request, jsonify, g

from app.extensions import db
from app.models import User
from app.auth import hash_password, verify_password, create_token, login_required

import logging
logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not verify_password(password, user.password_hash):
        logger.warning("AUTH FAIL username=%s", username)
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403

    token = create_token(user)
    logger.info("AUTH OK user=%s role=%s", user.username, user.role)
    return jsonify({
        'token': token,
        'user': user.to_dict(),
    })


@auth_bp.route('/me', methods=['GET'])
@login_required
def me():
    return jsonify({'user': g.current_user.to_dict()})


@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    old_pw = data.get('old_password', '')
    new_pw = data.get('new_password', '')

    if not old_pw or not new_pw:
        return jsonify({'error': 'Both old and new passwords are required'}), 400

    if len(new_pw) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if not verify_password(old_pw, g.current_user.password_hash):
        return jsonify({'error': 'Current password is incorrect'}), 401

    g.current_user.password_hash = hash_password(new_pw)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'})
