import pytest
import math
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.provider import (
    MockProvider,
    EmbeddingRequest,
    GeminiProvider,
)


@pytest.fixture
def mock_provider():
    return MockProvider()


@pytest.mark.asyncio
async def test_mock_embedding_dimensions(mock_provider):
    req = EmbeddingRequest(text="User prefers Python for software development.")
    res = await mock_provider.generate_embedding(req)

    assert res.dimensions == 768
    assert len(res.embedding) == 768
    assert res.provider == "mock"
    assert res.model == "mock-embedding-v1"

    # Verify vector is unit-normalized (L2 norm ~ 1.0)
    l2_norm = math.sqrt(sum(x * x for x in res.embedding))
    assert abs(l2_norm - 1.0) < 0.01


@pytest.mark.asyncio
async def test_mock_embedding_deterministic(mock_provider):
    text = "User lives in Tokyo."
    res1 = await mock_provider.generate_embedding(EmbeddingRequest(text=text))
    res2 = await mock_provider.generate_embedding(EmbeddingRequest(text=text))

    assert res1.embedding == res2.embedding


@pytest.mark.asyncio
async def test_api_embed_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Valid embedding request
        resp = await client.post(
            "/api/v1/companion/embed",
            json={"text": "User loves dark roast coffee with oat milk."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["dimensions"] == 768
        assert len(data["embedding"]) == 768
        assert data["provider"] in ("mock", "gemini")
        assert isinstance(data["latencyMs"], (int, float))

        # Empty text rejected (422 Unprocessable Entity)
        err_resp = await client.post(
            "/api/v1/companion/embed",
            json={"text": ""},
        )
        assert err_resp.status_code == 422


@pytest.mark.asyncio
async def test_gemini_embedding_unconfigured_error():
    unconfigured_provider = GeminiProvider(api_key="")
    assert not unconfigured_provider.is_configured()

    req = EmbeddingRequest(text="Test embedding")
    with pytest.raises(RuntimeError) as exc_info:
        await unconfigured_provider.generate_embedding(req)
    assert "GEMINI_API_KEY" in str(exc_info.value)
