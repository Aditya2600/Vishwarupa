"""Unit tests for the Remotion renderer HTTP client + service routing.

No network, no HeyGen/S3/credentials — httpx is exercised through a MockTransport.
"""

import os

os.environ.setdefault("HEYGEN_API_KEY", "test")
os.environ.setdefault("FRONTEND_URL", "http://localhost")
os.environ.setdefault("CPAAS_API_BASE_URL", "http://localhost")

import httpx
import pytest

from app.services.errors import PermanentError, TransientError
from app.services.remotion_renderer_client import RendererClient
from app.services.remotion_service import service_entry_composition


def _client_with(monkeypatch, handler):
    """Patch httpx.Client inside the client module to use a MockTransport."""
    import app.services.remotion_renderer_client as mod

    real_client = httpx.Client  # capture before patching to avoid recursion

    def factory(*args, **kwargs):
        return real_client(transport=httpx.MockTransport(handler), timeout=kwargs.get("timeout"))

    monkeypatch.setattr(mod.httpx, "Client", factory)
    return RendererClient(base_url="http://renderer:3000")


def _render(client, **overrides):
    kwargs = dict(
        entry_point="src/index.jsx",
        composition_id="main",
        input_props={"leadId": "abc"},
        output_location="/app/output/abc.mp4",
        job_id="abc",
        request_mode="account_notice",
    )
    kwargs.update(overrides)
    return client.render(**kwargs)


def test_success_returns_payload(monkeypatch):
    def handler(request):
        return httpx.Response(200, json={"ok": True, "durationMs": 42, "outputLocation": "/app/output/abc.mp4"})

    client = _client_with(monkeypatch, handler)
    result = _render(client)
    assert result["ok"] is True
    assert result["durationMs"] == 42


def test_timeout_is_transient(monkeypatch):
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)

    client = _client_with(monkeypatch, handler)
    with pytest.raises(TransientError):
        _render(client)


def test_connect_error_is_transient(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("down", request=request)

    client = _client_with(monkeypatch, handler)
    with pytest.raises(TransientError):
        _render(client)


def test_5xx_is_transient(monkeypatch):
    def handler(request):
        return httpx.Response(500, json={"stage": "render", "error": "chromium crashed"})

    client = _client_with(monkeypatch, handler)
    with pytest.raises(TransientError):
        _render(client)


def test_4xx_is_permanent(monkeypatch):
    def handler(request):
        return httpx.Response(400, json={"stage": "select", "error": "No composition with id"})

    client = _client_with(monkeypatch, handler)
    with pytest.raises(PermanentError):
        _render(client)


def test_malformed_200_is_transient(monkeypatch):
    # 200 but not a well-formed success -> must NOT be trusted as completed.
    def handler(request):
        return httpx.Response(200, json={"ok": False})

    client = _client_with(monkeypatch, handler)
    with pytest.raises(TransientError):
        _render(client)


def test_non_json_200_is_transient(monkeypatch):
    def handler(request):
        return httpx.Response(200, text="not json")

    client = _client_with(monkeypatch, handler)
    with pytest.raises(TransientError):
        _render(client)


def test_missing_url_is_permanent():
    with pytest.raises(PermanentError):
        RendererClient(base_url="").render(
            entry_point="src/index.jsx",
            composition_id="main",
            input_props={},
            output_location="/app/output/x.mp4",
            job_id="x",
        )


def _make_service(tmp_path):
    """A RemotionService with its Remotion/output paths redirected to tmp."""
    from app.config import settings
    from app.services.remotion_service import RemotionService

    remotion_dir = tmp_path / "Remotion"
    (remotion_dir / "public").mkdir(parents=True)
    output_dir = tmp_path / "output"
    output_dir.mkdir()

    svc = RemotionService()
    svc.remotion_path = remotion_dir
    svc.public_path = remotion_dir / "public"
    svc.assets_path = remotion_dir / "public" / "assets"
    svc.assets_path.mkdir(parents=True, exist_ok=True)
    return svc, output_dir


def test_backend_service_calls_client_not_cli(tmp_path, monkeypatch):
    import asyncio
    import subprocess

    from app.config import settings
    from app.models import RemotionVideoRequest
    import app.services.remotion_service as rs
    import app.services.remotion_renderer_client as rc

    svc, output_dir = _make_service(tmp_path)
    monkeypatch.setattr(settings, "default_output_dir", str(output_dir))
    monkeypatch.setattr(settings, "remotion_render_backend", "service")

    calls = {"client": 0, "subprocess": 0}

    class SpyClient:
        def render(self, *, output_location, **kwargs):
            calls["client"] += 1
            from pathlib import Path
            Path(output_location).parent.mkdir(parents=True, exist_ok=True)
            Path(output_location).write_bytes(b"fake-mp4")
            return {"ok": True}

    monkeypatch.setattr(rc, "RendererClient", SpyClient)
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: calls.__setitem__("subprocess", calls["subprocess"] + 1))

    request = RemotionVideoRequest(template_key="account_notice")
    render_payload = {"id": "vid123"}
    asyncio.run(svc.render_video(request, "vid123", {}, render_payload))

    assert calls["client"] == 1
    assert calls["subprocess"] == 0


def test_backend_cli_calls_subprocess_not_client(tmp_path, monkeypatch):
    import asyncio
    import subprocess

    from app.config import settings
    from app.models import RemotionVideoRequest
    import app.services.remotion_renderer_client as rc

    svc, output_dir = _make_service(tmp_path)
    monkeypatch.setattr(settings, "default_output_dir", str(output_dir))
    monkeypatch.setattr(settings, "remotion_render_backend", "cli")

    calls = {"client": 0, "subprocess": 0}

    class SpyClient:
        def render(self, **kwargs):
            calls["client"] += 1
            return {"ok": True}

    monkeypatch.setattr(rc, "RendererClient", SpyClient)

    class FakeProc:
        returncode = 0

    def fake_run(cmd, **kwargs):
        calls["subprocess"] += 1
        out = output_dir / "vid456.mp4"
        out.write_bytes(b"fake-mp4")
        return FakeProc()

    monkeypatch.setattr(subprocess, "run", fake_run)

    request = RemotionVideoRequest(template_key="account_notice")
    render_payload = {"id": "vid456"}
    asyncio.run(svc.render_video(request, "vid456", {}, render_payload))

    assert calls["subprocess"] == 1
    assert calls["client"] == 0


def test_service_entry_composition_routing():
    assert service_entry_composition("loan_reminder") == ("src/Root.tsx", "LoanReminderVideo")
    assert service_entry_composition("collection_reminder") == ("src/Root.tsx", "CollectionReminderVideo")
    assert service_entry_composition("tvs_credit_emi") == ("src/index.jsx", "TVSCreditEMITemplate")
    assert service_entry_composition("scene_loan_offer") == ("src/index.jsx", "SceneLoanOfferVideo")
    assert service_entry_composition("account_notice") == ("src/index.jsx", "main")
    assert service_entry_composition(None) == ("src/index.jsx", "main")
