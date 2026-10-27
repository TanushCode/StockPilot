"""
StockPilot - Flask application configuration.
Handles local (SQLite) and production (RDS via SSM) database setup.
"""
import os
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)


def _get_ssm_parameter(name, with_decryption=True):
    """Retrieve a parameter from AWS Systems Manager Parameter Store."""
    try:
        import boto3
        ssm = boto3.client('ssm', region_name=os.getenv('AWS_REGION', 'ap-south-1'))
        resp = ssm.get_parameter(Name=name, WithDecryption=with_decryption)
        return resp['Parameter']['Value']
    except Exception as e:
        logger.warning("SSM parameter %s unavailable: %s", name, e)
        return None


def _build_rds_url():
    """Build MySQL connection URL from SSM or environment fallback."""
    host = _get_ssm_parameter(os.getenv('SSM_DB_HOST', '/stockpilot/db/host'))
    port = _get_ssm_parameter(os.getenv('SSM_DB_PORT', '/stockpilot/db/port'))
    name = _get_ssm_parameter(os.getenv('SSM_DB_NAME', '/stockpilot/db/name'))
    user = _get_ssm_parameter(os.getenv('SSM_DB_USERNAME', '/stockpilot/db/username'))
    pwd = _get_ssm_parameter(os.getenv('SSM_DB_PASSWORD', '/stockpilot/db/password'))

    # Fallback to environment variables if SSM fails
    host = host or os.getenv('RDS_HOST')
    port = port or os.getenv('RDS_PORT', '3306')
    name = name or os.getenv('RDS_DATABASE', 'stockpilot')
    user = user or os.getenv('RDS_USERNAME')
    pwd = pwd or os.getenv('RDS_PASSWORD')

    if not all([host, user, pwd]):
        raise RuntimeError(
            "Production database configuration incomplete. "
            "Ensure SSM parameters or RDS_HOST/RDS_USERNAME/RDS_PASSWORD are set. "
            "StockPilot does NOT silently fall back to SQLite in production mode."
        )

    return f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{name}?charset=utf8mb4"


class BaseConfig:
    """Shared configuration."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-me')
    JWT_EXPIRATION_HOURS = 24
    JWT_ALGORITHM = 'HS256'

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}

    # S3
    S3_BUCKET = os.getenv('S3_BUCKET_NAME', 'stockpilot-uploads')
    S3_PRESIGNED_EXPIRY = int(os.getenv('S3_PRESIGNED_EXPIRY', '3600'))

    # SQS / SNS
    SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL', '')
    SNS_TOPIC_ARN = os.getenv('SNS_TOPIC_ARN', '')
    AWS_REGION = os.getenv('AWS_REGION', 'ap-south-1')

    # Local-dev toggles
    USE_LOCAL_STORAGE = os.getenv('USE_LOCAL_STORAGE', 'true').lower() == 'true'
    LOCAL_UPLOAD_DIR = os.getenv('LOCAL_UPLOAD_DIR', './uploads')
    USE_LOCAL_QUEUE = os.getenv('USE_LOCAL_QUEUE', 'true').lower() == 'true'
    USE_LOCAL_SNS = os.getenv('USE_LOCAL_SNS', 'true').lower() == 'true'

    # Upload limits
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'csv', 'xlsx'}

    # Alert cooldown (minutes)
    ALERT_COOLDOWN_MINUTES = 60
    EXPIRY_WARNING_DAYS_SHORT = 7
    EXPIRY_WARNING_DAYS_LONG = 30


class DevelopmentConfig(BaseConfig):
    """Local development — uses SQLite."""
    DEBUG = True
    basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(basedir, 'stockpilot_dev.db')}"


class ProductionConfig(BaseConfig):
    """Production — uses RDS MySQL via SSM Parameter Store."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = None  # set in init

    USE_LOCAL_STORAGE = False
    USE_LOCAL_QUEUE = False
    USE_LOCAL_SNS = False

    def __init__(self):
        super().__init__()
        self.SQLALCHEMY_DATABASE_URI = _build_rds_url()


class TestingConfig(BaseConfig):
    """Testing — in-memory SQLite."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    USE_LOCAL_STORAGE = True
    USE_LOCAL_QUEUE = True
    USE_LOCAL_SNS = True


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
}
