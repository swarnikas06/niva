import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.provider import (
    MockProvider,
    MemoryExtractionRequest,
    ExtractedCandidate,
    GeminiProvider,
)
from app.core.prompts.memory_extraction import MemoryExtractionPromptBuilder


@pytest.fixture
def mock_provider():
    return MockProvider()


@pytest.mark.asyncio
async def test_extract_memories_explicit_preference(mock_provider):
    req = MemoryExtractionRequest(
        userMessage="I prefer Python for backend development.",
        conversationId="11111111-1111-1111-1111-111111111111",
    )
    res = await mock_provider.extract_memories(req)
    assert res.extracted_count == 1
    cand = res.candidates[0]
    assert cand.category == "user_preference"
    assert "Python" in cand.content
    assert cand.confidence_type == "explicit"
    assert cand.confidence >= 0.90
    assert cand.importance >= 5


@pytest.mark.asyncio
async def test_extract_memories_explicit_fact(mock_provider):
    req = MemoryExtractionRequest(
        userMessage="I live in Tokyo and work as a software architect.",
        conversationId="11111111-1111-1111-1111-111111111111",
    )
    res = await mock_provider.extract_memories(req)
    assert res.extracted_count >= 1
    categories = [c.category for c in res.candidates]
    assert "semantic_fact" in categories
    assert all(c.confidence_type == "explicit" for c in res.candidates)


@pytest.mark.asyncio
async def test_extract_memories_inferred_uncertainty(mock_provider):
    req = MemoryExtractionRequest(
        userMessage="I think I might learn Kubernetes next month.",
        conversationId="11111111-1111-1111-1111-111111111111",
    )
    res = await mock_provider.extract_memories(req)
    assert res.extracted_count == 1
    cand = res.candidates[0]
    assert cand.category == "open_loop"
    assert cand.confidence_type == "inferred"
    assert cand.confidence < 0.85
    # Must preserve uncertainty, not claim user knows Kubernetes
    assert "learning Kubernetes" in cand.content or "Kubernetes" in cand.content


@pytest.mark.asyncio
async def test_extract_memories_precision_rejects_chitchat(mock_provider):
    """Routine greetings and small talk must yield 0 candidates."""
    greetings = ["Hello!", "Hi there", "Good morning", "Thanks", "How are you today?"]
    for msg in greetings:
        req = MemoryExtractionRequest(
            userMessage=msg,
            conversationId="11111111-1111-1111-1111-111111111111",
        )
        res = await mock_provider.extract_memories(req)
        assert res.extracted_count == 0, f"Expected 0 candidates for greeting '{msg}', got {res.extracted_count}"


@pytest.mark.asyncio
async def test_extract_memories_no_operational_duplication(mock_provider):
    """Tasks, assignments, and calendar to-dos must NOT be converted to memories."""
    operational_msgs = [
        "Finish my assignment tomorrow before 5pm.",
        "Buy groceries on the way home.",
        "Submit the project report to the client.",
    ]
    for msg in operational_msgs:
        req = MemoryExtractionRequest(
            userMessage=msg,
            conversationId="11111111-1111-1111-1111-111111111111",
        )
        res = await mock_provider.extract_memories(req)
        assert res.extracted_count == 0, f"Expected 0 candidates for task '{msg}', got {res.extracted_count}"


def test_extracted_candidate_validation():
    # Valid candidate
    cand = ExtractedCandidate(
        category="user_preference",
        content="User prefers dark mode.",
        confidence=0.95,
        confidenceType="explicit",
        importance=6,
    )
    assert cand.category == "user_preference"
    assert cand.confidence == 0.95

    # Invalid category rejected
    with pytest.raises(Exception):
        ExtractedCandidate(
            category="invalid_category",  # type: ignore
            content="User prefers dark mode.",
            confidence=0.95,
            confidenceType="explicit",
        )

    # Invalid confidence type rejected
    with pytest.raises(Exception):
        ExtractedCandidate(
            category="user_preference",
            content="User prefers dark mode.",
            confidence=0.95,
            confidenceType="guessed",  # type: ignore
        )

    # Confidence out of bounds (> 1.0)
    with pytest.raises(Exception):
        ExtractedCandidate(
            category="user_preference",
            content="User prefers dark mode.",
            confidence=1.5,
            confidenceType="explicit",
        )

    # Empty content rejected
    with pytest.raises(Exception):
        ExtractedCandidate(
            category="user_preference",
            content="   ",
            confidence=0.95,
            confidenceType="explicit",
        )


def test_prompt_builder_structure():
    prompt = MemoryExtractionPromptBuilder.build_prompt(
        user_message="I prefer Python for backend development.",
        recent_history=[
            {"senderRole": "user", "content": "What language should we use?"},
            {"senderRole": "assistant", "content": "We have options like Node or Python."},
        ],
        character_persona={"name": "The Focused Strategist", "archetypeId": "niva_strategist"},
    )
    assert "The Focused Strategist" in prompt
    assert "RECENT CONVERSATION HISTORY" in prompt
    assert "CURRENT USER MESSAGE TO ANALYZE" in prompt
    assert "I prefer Python for backend development." in prompt


@pytest.mark.asyncio
async def test_api_extract_memories_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Valid request
        resp = await client.post(
            "/api/v1/companion/extract-memories",
            json={
                "conversationId": "11111111-1111-1111-1111-111111111111",
                "userMessage": "I prefer Python for writing backend microservices.",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] in ("mock", "gemini")
        assert data["extractedCount"] >= 1
        assert len(data["candidates"]) >= 1
        first_cand = data["candidates"][0]
        assert first_cand["category"] == "user_preference"
        assert first_cand["confidenceType"] == "explicit"
        assert first_cand["confidence"] >= 0.90

        # Empty user message rejected (422 Unprocessable Entity)
        err_resp = await client.post(
            "/api/v1/companion/extract-memories",
            json={
                "conversationId": "11111111-1111-1111-1111-111111111111",
                "userMessage": "",
            },
        )
        assert err_resp.status_code == 422


@pytest.mark.asyncio
async def test_gemini_unconfigured_error():
    unconfigured_provider = GeminiProvider(api_key="")
    assert not unconfigured_provider.is_configured()

    req = MemoryExtractionRequest(
        userMessage="I live in Tokyo.",
        conversationId="11111111-1111-1111-1111-111111111111",
    )
    with pytest.raises(RuntimeError) as exc_info:
        await unconfigured_provider.extract_memories(req)
    assert "GEMINI_API_KEY" in str(exc_info.value)
