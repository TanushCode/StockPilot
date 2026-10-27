"""
StockPilot — Authentication helpers.

JWT-based auth with bcrypt password hashing and role-based decorators.
"""
import functools
import logging
from datetime import datetime, timedelta, timezone

import jwt
import bcrypt
from flask import request, jsonify, current_app, g

from app.extensions import db
from app.models import User

logger = logging.getLogger(__name__)


# ───────────────── password hashing ─────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


# ───────────────── JWT tokens ───────────────────────────────────────
def create_token(user: User) -> str:
    payload = {
        'sub': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.now(timezone.utc) + timedelta(
            hours=current_app.config.get('JWT_EXPIRATION_HOURS', 24)
        ),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(
        payload,
        current_app.config['SECRET_KEY'],
        algorithm=current_app.config.get('JWT_ALGORITHM', 'HS256'),
    )


def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        current_app.config['SECRET_KEY'],
        algorithms=[current_app.config.get('JWT_ALGORITHM', 'HS256')],
    )


# ───────────────── decorators ───────────────────────────────────────
def login_required(f):
    """Require a valid JWT in the Authorization header."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        token = auth.split(' ', 1)[1]
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token: %s", e)
            return jsonify({'error': 'Invalid token'}), 401

        user = db.session.get(User, payload['sub'])
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or deactivated'}), 401

        g.current_user = user
        return f(*args, **kwargs)
    return wrapper


def manager_required(f):
    """Require the current user to have the 'manager' role."""
    @functools.wraps(f)
    @login_required
    def wrapper(*args, **kwargs):
        if g.current_user.role != 'manager':
            logger.warning(
                "AUTH DENIED user=%s attempted manager action on %s",
                g.current_user.username, request.path,
            )
            return jsonify({'error': 'Manager role required'}), 403
        return f(*args, **kwargs)
    return wrapper
