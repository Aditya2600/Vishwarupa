import os

os.environ.setdefault('HEYGEN_API_KEY', 'test-key')

from app.services.heygen_client import HeyGenClient


def test_summarize_provider_error_keeps_structured_detail_with_code() -> None:
    payload = {
        "data": {
            "error": {
                "code": "MOVIO_BAD_REQUEST",
                "detail": "Avatar avatar_123 is not available in region ap-south-1.",
            }
        }
    }

    detail = HeyGenClient.summarize_provider_error(payload)

    assert "Avatar avatar_123 is not available in region ap-south-1." in detail
    assert "(code: MOVIO_BAD_REQUEST)" in detail


def test_summarize_provider_error_returns_friendly_credit_message() -> None:
    payload = {
        "data": {
            "error": {
                "code": "MOVIO_PAYMENT_INSUFFICIENT_CREDIT",
                "detail": "insufficient credit",
            }
        }
    }

    detail = HeyGenClient.summarize_provider_error(payload)

    assert detail == "You don't have enough credits to generate this video."


def test_summarize_provider_error_preserves_plain_string_details() -> None:
    detail = HeyGenClient.summarize_provider_error("Gateway timeout from upstream provider")

    assert detail == "Video generation is taking longer than expected. Please try again shortly."


def test_summarize_provider_error_falls_back_when_payload_is_empty() -> None:
    detail = HeyGenClient.summarize_provider_error({})

    assert detail == "Video generation failed. Please try again in a moment."
