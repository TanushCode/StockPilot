"""
StockPilot — AWS Service Wrappers.

Provides S3, SQS and SNS helpers with local-development fallbacks.
Production uses real Boto3 calls via the EC2 instance IAM role.
Local dev uses filesystem storage and in-memory queues.
"""
import os
import json
import uuid
import logging
import shutil
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from flask import current_app

logger = logging.getLogger(__name__)


# ════════════════════════════ S3 ════════════════════════════════════
class StorageService:
    """Upload files, generate presigned URLs. Falls back to local FS."""

    @staticmethod
    def _use_local():
        return current_app.config.get('USE_LOCAL_STORAGE', True)

    @classmethod
    def upload_file(cls, file_obj, object_key, content_type='application/octet-stream'):
        if cls._use_local():
            return cls._local_upload(file_obj, object_key)
        return cls._s3_upload(file_obj, object_key, content_type)

    @classmethod
    def get_download_url(cls, object_key):
        if cls._use_local():
            return f"/api/files/local/{object_key}"
        return cls._s3_presigned_url(object_key)

    @classmethod
    def delete_file(cls, object_key):
        if cls._use_local():
            path = os.path.join(current_app.config['LOCAL_UPLOAD_DIR'], object_key)
            if os.path.exists(path):
                os.remove(path)
            return True
        try:
            s3 = boto3.client('s3', region_name=current_app.config['AWS_REGION'])
            s3.delete_object(Bucket=current_app.config['S3_BUCKET'], Key=object_key)
            return True
        except ClientError as e:
            logger.error("S3 delete failed: %s", e)
            return False

    # ── S3 ──
    @staticmethod
    def _s3_upload(file_obj, object_key, content_type):
        s3 = boto3.client('s3', region_name=current_app.config['AWS_REGION'])
        try:
            s3.upload_fileobj(
                file_obj,
                current_app.config['S3_BUCKET'],
                object_key,
                ExtraArgs={'ContentType': content_type},
            )
            logger.info("S3 upload OK: %s", object_key)
            return object_key
        except ClientError as e:
            logger.error("S3 upload FAILED key=%s: %s", object_key, e)
            raise

    @staticmethod
    def _s3_presigned_url(object_key):
        s3 = boto3.client('s3', region_name=current_app.config['AWS_REGION'])
        try:
            url = s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': current_app.config['S3_BUCKET'],
                    'Key': object_key,
                },
                ExpiresIn=current_app.config['S3_PRESIGNED_EXPIRY'],
            )
            return url
        except ClientError as e:
            logger.error("Presigned URL failed: %s", e)
            raise

    # ── Local ──
    @staticmethod
    def _local_upload(file_obj, object_key):
        upload_dir = current_app.config['LOCAL_UPLOAD_DIR']
        dest = os.path.join(upload_dir, object_key)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        file_obj.save(dest)
        logger.info("Local upload: %s", dest)
        return object_key


# ════════════════════════════ SQS ═══════════════════════════════════
# In-memory queue for local development
_local_queue = []


class QueueService:
    """Publish inventory events to SQS (or in-memory for local dev)."""

    @staticmethod
    def _use_local():
        return current_app.config.get('USE_LOCAL_QUEUE', True)

    @classmethod
    def publish_event(cls, event_type: str, payload: dict):
        event = {
            'event_id': f"evt-{uuid.uuid4().hex[:12]}",
            'event_type': event_type,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            **payload,
        }
        if cls._use_local():
            _local_queue.append(event)
            logger.info("Local queue event: %s", event['event_type'])
            return event['event_id']
        return cls._sqs_send(event)

    @staticmethod
    def _sqs_send(event):
        sqs = boto3.client('sqs', region_name=current_app.config['AWS_REGION'])
        try:
            resp = sqs.send_message(
                QueueUrl=current_app.config['SQS_QUEUE_URL'],
                MessageBody=json.dumps(event),
                MessageGroupId='stockpilot',  # for FIFO queues; ignored by standard
            )
            logger.info("SQS sent message_id=%s", resp['MessageId'])
            return event['event_id']
        except ClientError as e:
            logger.error("SQS send FAILED: %s", e)
            raise

    @classmethod
    def poll_events(cls, max_messages=10, wait_seconds=20):
        """Long-poll SQS. Returns list of (receipt_handle, event_dict)."""
        if cls._use_local():
            events = list(_local_queue)
            _local_queue.clear()
            return [(None, e) for e in events]
        sqs = boto3.client('sqs', region_name=current_app.config['AWS_REGION'])
        resp = sqs.receive_message(
            QueueUrl=current_app.config['SQS_QUEUE_URL'],
            MaxNumberOfMessages=max_messages,
            WaitTimeSeconds=wait_seconds,
        )
        results = []
        for msg in resp.get('Messages', []):
            try:
                body = json.loads(msg['Body'])
                results.append((msg['ReceiptHandle'], body))
            except json.JSONDecodeError:
                logger.warning("Non-JSON SQS message: %s", msg['Body'])
        return results

    @classmethod
    def delete_message(cls, receipt_handle):
        if cls._use_local() or receipt_handle is None:
            return
        sqs = boto3.client('sqs', region_name=current_app.config['AWS_REGION'])
        sqs.delete_message(
            QueueUrl=current_app.config['SQS_QUEUE_URL'],
            ReceiptHandle=receipt_handle,
        )


# ════════════════════════════ SNS ═══════════════════════════════════
class NotificationService:
    """Publish alerts to SNS (or log for local dev)."""

    @staticmethod
    def _use_local():
        return current_app.config.get('USE_LOCAL_SNS', True)

    @classmethod
    def send_alert(cls, subject: str, message: str):
        if cls._use_local():
            logger.info("LOCAL SNS → %s: %s", subject, message[:200])
            return "local-message-id"
        return cls._sns_publish(subject, message)

    @staticmethod
    def _sns_publish(subject, message):
        sns = boto3.client('sns', region_name=current_app.config['AWS_REGION'])
        try:
            resp = sns.publish(
                TopicArn=current_app.config['SNS_TOPIC_ARN'],
                Subject=subject[:100],
                Message=message,
            )
            logger.info("SNS published message_id=%s", resp['MessageId'])
            return resp['MessageId']
        except ClientError as e:
            logger.error("SNS publish FAILED: %s", e)
            raise
