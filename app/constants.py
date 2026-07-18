from pathlib import Path

S3_BUCKET_NAME = "vishvarupa"
SQS_QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/873184615731/Video-generation"

# Local directory where finished hybrid (avatar + Remotion PiP) videos are copied
# and served from under /generated. Shared by the API and the worker so both agree
# on the path. Ephemeral (/tmp) — the durable copy is in S3.
HYBRID_PUBLIC_DIR = Path("/tmp/hybrid-public")

