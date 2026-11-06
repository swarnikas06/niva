import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.provider import (
    MockProvider,
    CandidateEvaluationRequest,
    CandidateEvaluationResponse,
)
from app.core.prompts.memory_evaluation import MemoryEvaluationPromptBuilder


@pytest.fixture
def mock_provider():
    return MockProvider()


@pytest.mark.asyncio
async def test_evaluate_durable_preference_accept(mock_provider):
    req = CandidateEvaluationRequest(
        candidateId="c-001",
        category="user_preference",
        content="User prefers dark mode for all IDEs and operating system interfaces.",
        confidence=0.95,
        confidenceType="explicit",
    )
    res = await mock_provider.evaluate_candidate(req)
    assert res.decision == "accept"
    assert res.confidence >= 0.85
    assert "durable" in res.reason.lower() or "preference" in res.reason.lower()


@pytest.mark.asyncio
async def test_evaluate_transient_statement_reject(mock_provider):
    req = CandidateEvaluationRequest(
        candidateId="c-002",
        category="episodic_event",
        content="User is having coffee right now and feeling a bit tired.",
        confidence=0.8,
        confidenceType="explicit",
    )
    res = await mock_provider.evaluate_candidate(req)
    assert res.decision in ("reject", "defer")
    assert "transient" in res.reason.lower() or "temporary" in res.reason.lower()


@pytest.mark.asyncio
async def test_evaluate_operational_task_reject(mock_provider):
    req = CandidateEvaluationRequest(
        candidateId="c-003",
        category="open_loop",
        content="TODO: buy milk and groceries before 6pm today.",
        confidence=0.9,
        confidenceType="explicit",
    )
    res = await mock_provider.evaluate_candidate(req)
    assert res.decision == "reject"
    assert "operational" in res.reason.lower() or "task" in res.reason.lower() or "todo" in res.reason.lower()


@pytest.mark.asyncio
async def test_evaluate_duplicate_memory_reject(mock_provider):
    req = CandidateEvaluationRequest(
        candidateId="c-004",
        category="user_preference",
        content="User prefers dark mode in their editor.",
        confidence=0.95,
        confidenceType="explicit",
        existingMemories=[
            {
                "id": "mem-101",
                "content": "User prefers dark mode for all IDEs and editors.",
                "category": "user_preference",
                "similarity": 0.94,
            }
        ],
    )
    res = await mock_provider.evaluate_candidate(req)
    assert res.decision == "reject"
    assert res.duplicate_of_memory_id == "mem-101"
    assert "duplicate" in res.reason.lower()


@pytest.mark.asyncio
async def test_evaluate_contradiction_supersede(mock_provider):
    req = CandidateEvaluationRequest(
        candidateId="c-005",
        category="semantic_fact",
        content="User now lives in London, United Kingdom.",
        confidence=0.95,
        confidenceType="explicit",
        existingMemories=[
            {
                "id": "mem-102",
                "content": "User lives in Tokyo, Japan.",
                "category": "semantic_fact",
                "similarity": 0.72,
            }
        ],
    )
    res = await mock_provider.evaluate_candidate(req)
    assert res.decision == "supersede"
    assert res.supersedes_memory_id == "mem-102"
    assert "contradicts" in res.reason.lower() or "supersedes" in res.reason.lower() or "moved" in res.reason.lower()


@pytest.mark.asyncio
async def test_evaluate_open_loop_accept(mock_provider):
    req = CandidateEvaluationRequest(
        candidateId="c-006",
        category="open_loop",
        content="User is considering adopting Rust for backend microservices next year.",
        confidence=0.85,
        confidenceType="inferred",
    )
    res = await mock_provider.evaluate_candidate(req)
    assert res.decision == "accept"
    assert "open-loop" in res.reason.lower() or "long-term" in res.reason.lower() or "durable" in res.reason.lower()


@pytest.mark.asyncio
async def test_evaluate_inferred_information_accept(mock_provider):
    req = CandidateEvaluationRequest(
        candidateId="c-007",
        category="user_preference",
        content="User seems to prefer strong type systems over dynamically typed languages.",
        confidence=0.75,
        confidenceType="inferred",
    )
    res = await mock_provider.evaluate_candidate(req)
    assert res.decision == "accept"
    assert res.confidence == 0.75


@pytest.mark.asyncio
async def test_evaluate_candidate_api_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/companion/evaluate-candidate",
            json={
                "candidateId": "c-test-api",
                "category": "user_preference",
                "content": "User prefers concise answers with code examples.",
                "confidence": 0.95,
                "confidenceType": "explicit",
                "existingMemories": [],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["candidateId"] == "c-test-api"
        assert data["decision"] in ("accept", "reject", "supersede", "defer")
        assert "reason" in data
        assert "latencyMs" in data


def test_prompt_builder_structure():
    from app.core.prompts.memory_evaluation import MEMORY_EVALUATION_SYSTEM_INSTRUCTION
    assert "Memory Evaluation Engine" in MEMORY_EVALUATION_SYSTEM_INSTRUCTION
    assert "DURABILITY VS TRANSIENCE" in MEMORY_EVALUATION_SYSTEM_INSTRUCTION
    assert "NO OPERATIONAL DUPLICATION" in MEMORY_EVALUATION_SYSTEM_INSTRUCTION
    assert "DUPLICATE HANDLING" in MEMORY_EVALUATION_SYSTEM_INSTRUCTION
    assert "CONTRADICTION & SUPERSESSION" in MEMORY_EVALUATION_SYSTEM_INSTRUCTION
    assert "OUTPUT FORMAT" in MEMORY_EVALUATION_SYSTEM_INSTRUCTION

    builder = MemoryEvaluationPromptBuilder()
    prompt = builder.build(
        candidate={
            "id": "c-test",
            "category": "user_preference",
            "content": "Prefers typescript",
            "confidence": 0.9,
            "confidenceType": "explicit",
        },
        existing_memories=[
            {
                "id": "m-1",
                "content": "Likes Javascript",
                "category": "user_preference",
                "similarity": 0.85,
            }
        ],
    )
    assert "CANDIDATE TO EVALUATE" in prompt
    assert "EXISTING ACTIVE USER MEMORIES" in prompt
    assert "Prefers typescript" in prompt
    assert "Likes Javascript" in prompt
    assert "TASK" in prompt
