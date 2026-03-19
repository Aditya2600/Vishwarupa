import os

os.environ.setdefault('HEYGEN_API_KEY', 'test-key')

from app.models import DirectVideoRequest
from app.services.video_service import VideoService


def test_build_direct_payload_uses_inline_script_and_dimensions() -> None:
    service = VideoService(client=object())
    request = DirectVideoRequest(
        customer_name='Ramesh Kumar',
        lan='LAN12345',
        client_name='ABC Finance',
        tos=38450,
        loan_amount=120000,
        contact_details='1800-123-456',
        avatar_id='avatar_123',
        voice_id='voice_123',
        include_captions=True,
        script_text='Namaste {{customer_name}}. Your account {{lan}} has dues of {{tos}}.',
        video_width=720,
        video_height=1280,
    )

    payload = service._build_direct_payload(request)

    assert payload['caption'] is True
    assert payload['dimension'] == {'width': 720, 'height': 1280}
    assert payload['video_inputs'][0]['character']['avatar_id'] == 'avatar_123'
    assert payload['video_inputs'][0]['voice']['input_text'] == 'Namaste Ramesh Kumar. Your account LAN12345 has dues of ₹38,450.'
    assert payload['video_inputs'][0]['voice']['voice_id'] == 'voice_123'
    assert payload['video_inputs'][0]['voice']['text'] == {
        'input_text': 'Namaste Ramesh Kumar. Your account LAN12345 has dues of ₹38,450.',
        'voice_id': 'voice_123',
    }


class _StubVoiceClient:
    def __init__(self, voices: list[dict]) -> None:
        self._voices = voices

    def list_voices(self) -> dict:
        return {"data": {"voices": self._voices}}


class _FailingVoiceClient:
    def list_voices(self) -> dict:
        raise RuntimeError("voice list unavailable")


class _RetryOnUnavailableVoiceClient:
    def __init__(self) -> None:
        self.payloads: list[dict] = []

    def list_voices(self) -> dict:
        return {"data": {"voices": []}}

    def generate_video_direct(self, payload: dict) -> dict:
        self.payloads.append(payload)
        voice = payload["video_inputs"][0]["voice"]
        if voice.get("voice_id"):
            raise RuntimeError("voice_id=abc123: Voice is not available (status: FAILED)")
        return {"video_id": "video_456", "status": "submitted"}


def _base_request(**kwargs) -> DirectVideoRequest:
    payload = {
        "customer_name": "Ramesh Kumar",
        "lan": "LAN12345",
        "client_name": "ABC Finance",
        "avatar_id": "avatar_123",
        "voice_id": "voice_unavailable",
        "voice_gender": "female",
        "script_text": "Hello {{customer_name}}",
    }
    payload.update(kwargs)
    return DirectVideoRequest(**payload)


def test_build_direct_payload_falls_back_when_selected_voice_status_is_failed() -> None:
    service = VideoService(client=_StubVoiceClient([
        {"voice_id": "voice_unavailable", "status": "FAILED", "gender": "female"},
        {"voice_id": "voice_fallback_female", "status": "ACTIVE", "gender": "female"},
    ]))

    payload = service._build_direct_payload(_base_request())

    assert payload["video_inputs"][0]["voice"]["voice_id"] == "voice_fallback_female"
    assert payload["video_inputs"][0]["voice"]["text"]["voice_id"] == "voice_fallback_female"


def test_build_direct_payload_falls_back_when_selected_voice_is_missing() -> None:
    service = VideoService(client=_StubVoiceClient([
        {"voice_id": "voice_male", "status": "ACTIVE", "gender": "male"},
        {"voice_id": "voice_female", "status": "ACTIVE", "gender": "female"},
    ]))

    payload = service._build_direct_payload(_base_request(voice_id="voice_not_in_catalog"))

    assert payload["video_inputs"][0]["voice"]["voice_id"] == "voice_female"


def test_build_direct_payload_keeps_requested_voice_when_voice_lookup_fails() -> None:
    service = VideoService(client=_FailingVoiceClient())

    payload = service._build_direct_payload(_base_request(voice_id="voice_keep_me"))

    assert payload["video_inputs"][0]["voice"]["voice_id"] == "voice_keep_me"


def test_generate_direct_retries_without_voice_id_when_provider_rejects_voice() -> None:
    retry_client = _RetryOnUnavailableVoiceClient()
    service = VideoService(client=retry_client)

    result = service.generate_direct(_base_request(voice_id="voice_bad"), wait=False)

    assert result.video_id == "video_456"
    assert len(retry_client.payloads) == 2
    assert retry_client.payloads[0]["video_inputs"][0]["voice"]["voice_id"] == "voice_bad"
    assert "voice_id" not in retry_client.payloads[1]["video_inputs"][0]["voice"]
    assert "voice_id" not in retry_client.payloads[1]["video_inputs"][0]["voice"]["text"]
