from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import DEFAULT_CPAAS_API_PREFIX, Settings


def test_cpaas_api_root_url_preserves_explicit_prefix() -> None:
    settings = Settings(
        _env_file=None,
        heygen_api_key='test-key',
        cpaas_api_base_url=f'https://api-resolve-x.credresolve.com{DEFAULT_CPAAS_API_PREFIX}',
    )

    assert settings.cpaas_api_root_url == 'https://api-resolve-x.credresolve.com/cpaas/api/v1'


def test_cpaas_api_root_url_adds_prefix_for_bare_host() -> None:
    settings = Settings(
        _env_file=None,
        heygen_api_key='test-key',
        cpaas_api_base_url='https://api-resolve-x.credresolve.com',
    )

    assert settings.cpaas_api_root_url == 'https://api-resolve-x.credresolve.com/cpaas/api/v1'
