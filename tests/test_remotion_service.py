import os
from pathlib import Path

import pytest

os.environ.setdefault('HEYGEN_API_KEY', 'test-key')

from app.models import RemotionVideoRequest
from app.services.remotion_service import RemotionService


def make_request(script_text: str | None = None) -> RemotionVideoRequest:
    return RemotionVideoRequest(
        customer_name='Ramesh Kumar',
        lan='LAN12345',
        client_name='ABC Finance',
        tos='38450',
        loan_amount='120000',
        contact_details='1800-555-999',
        product_type='loan',
        language='Hindi',
        script_text=script_text,
        include_captions=True,
        subtitle_color='Teal',
        subtitle_position='Top',
        logo_position='Bottom Right',
        logo_opacity=64,
    )


def test_render_script_supports_aliases_and_single_braces(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path)
    request = make_request(
        '{customer} {client} {loan_amt} {balance} {account_number} {helpline} {product}'
    )

    rendered = service.render_script(request)

    assert rendered == 'Ramesh Kumar ABC Finance 120000 38450 LAN12345 1800-555-999 loan'


def test_ensure_project_available_requires_checkout(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path / 'missing')

    with pytest.raises(RuntimeError, match='Remotion project is incomplete'):
        service.ensure_project_available()


def test_build_render_payload_enriches_scene_data(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path)

    payload = service.build_render_payload(make_request(), 'job-1', 'Rendered script')

    assert payload['display_amounts']['primary']['value'] == '₹38,450'
    assert payload['display_amounts']['secondary']['value'] == '₹1,20,000'
    assert payload['scene_payload']['opening']['headline'].startswith('Ramesh Kumar')
    assert payload['scene_payload']['action']['cta_value'] == '1800-555-999'
    assert payload['headline_text'] == payload['scene_payload']['headline_text']
    assert payload['cta_text'] == payload['scene_payload']['cta_text']
    assert payload['urgency_level'] == 'elevated'
    assert payload['video_width'] == 1280
    assert payload['video_height'] == 720
    assert payload['branding']['subtitles'] == {
        'enabled': True,
        'color': 'Teal',
        'position': 'Top',
    }
    assert payload['branding']['logo'] == {
        'public_path': None,
        'position': 'Bottom Right',
        'opacity': 64,
    }


def test_build_render_payload_preserves_requested_dimensions(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path)
    request = make_request()
    request.video_width = 720
    request.video_height = 1280

    payload = service.build_render_payload(request, 'job-portrait', 'Rendered script')

    assert payload['video_width'] == 720
    assert payload['video_height'] == 1280


def test_build_render_payload_handles_missing_loan_amount_and_product_variants(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path)
    request = make_request()
    request.loan_amount = None
    request.product_type = 'insurance'

    payload = service.build_render_payload(request, 'job-2', 'Rendered script')

    assert payload['display_amounts']['secondary']['available'] is False
    assert payload['display_amounts']['secondary']['value'] == 'राशि उपलब्ध नहीं'
    assert payload['scene_payload']['account']['eyebrow'] == 'बीमा भुगतान स्थिति'
    assert 'बीमा खाते' in payload['scene_payload']['opening']['headline']


def test_format_amount_display_supports_numeric_strings(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path)

    assert service.format_amount_display('₹120000') == '₹1,20,000'
    assert service.format_amount_display('38,450') == '₹38,450'
    assert service.format_amount_display(None) == 'राशि उपलब्ध नहीं'


def test_public_error_message_hides_renderer_noise(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path)

    assert (
        service._public_error_message('Visited "http://localhost:3000/index.html" but got no response.')
        == 'Text video generation failed because the renderer did not respond. Please try again in a moment.'
    )
    assert (
        service._public_error_message('Browser executable could not be found or launched.')
        == 'Text video generation failed because the render browser could not start. Please try again in a moment.'
    )


def test_persist_logo_asset_rejects_invalid_format(tmp_path: Path) -> None:
    service = RemotionService(remotion_path=tmp_path)

    with pytest.raises(ValueError, match='Unsupported logo format'):
        service._persist_logo_asset('job-3', 'logo.svg', b'fake-bytes')
