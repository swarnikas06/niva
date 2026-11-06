import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.provider import (
    MockProvider,
    InterviewQuestionRequest,
    InterviewAnswerEvaluationRequest,
)


@pytest.mark.asyncio
async def test_mock_provider_question_generation():
    provider = MockProvider()
    request = InterviewQuestionRequest(
        targetRole={"title": "Senior Distributed Systems Engineer", "seniorityLevel": "senior", "roleFamily": "software_engineering"},
        skill={"name": "Distributed Systems", "category": "systems_architecture"},
        sessionType="technical",
        difficulty="advanced",
        questionNumber=1,
        totalQuestions=3,
        relevantContext=["VoiceShield AI real-time audio pipeline"],
    )
    res = await provider.generate_interview_question(request)
    assert res.question_text is not None
    assert len(res.question_text) > 20
    assert "VoiceShield AI" in res.question_text
    assert res.difficulty == "advanced"
    assert res.targeted_skill == "Distributed Systems"
    assert res.provider == "mock"


@pytest.mark.asyncio
async def test_mock_provider_evaluate_answer_strong():
    provider = MockProvider()
    request = InterviewAnswerEvaluationRequest(
        targetRole={"title": "Senior Distributed Systems Engineer", "seniorityLevel": "senior"},
        skill={"name": "Distributed Systems"},
        sessionType="technical",
        difficulty="intermediate",
        questionText="How do you handle consumer group rebalances in Kafka?",
        userAnswer=(
            "When consumer group rebalance occurs, partition assignment locks briefly. "
            "To minimize rebalance latency and backpressure, we configure cooperative sticky assignors. "
            "This maintains partition continuity and avoids complete consumption freezes, balancing "
            "throughput against rebalance overhead while keeping state caches warm."
        ),
    )
    res = await provider.evaluate_interview_answer(request)
    assert res.overall_rating == "strong"
    assert len(res.dimensions) == 5
    assert len(res.strengths) > 0
    assert res.follow_up_needed is False
    assert res.evidence_summary is not None


@pytest.mark.asyncio
async def test_mock_provider_evaluate_answer_insufficient():
    provider = MockProvider()
    request = InterviewAnswerEvaluationRequest(
        targetRole={"title": "Senior Backend Engineer", "seniorityLevel": "senior"},
        skill={"name": "Python"},
        sessionType="technical",
        difficulty="intermediate",
        questionText="Explain the GIL in Python.",
        userAnswer="I don't know.",
    )
    res = await provider.evaluate_interview_answer(request)
    assert res.overall_rating == "insufficient"
    assert res.follow_up_needed is True
    assert res.suggested_next_difficulty == "foundation"


@pytest.mark.asyncio
async def test_api_generate_question_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "targetRole": {
                "title": "Data Infrastructure Engineer",
                "seniorityLevel": "mid",
                "roleFamily": "data_ai_ml",
            },
            "skill": {
                "name": "SQL & Query Optimization",
                "category": "data_infrastructure",
            },
            "sessionType": "technical",
            "difficulty": "intermediate",
            "questionNumber": 1,
            "totalQuestions": 3,
        }
        resp = await client.post("/api/v1/career/generate-question", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "questionText" in data
        assert data["difficulty"] == "intermediate"
        assert data["targetedSkill"] == "SQL & Query Optimization"
        assert "latencyMs" in data


@pytest.mark.asyncio
async def test_api_evaluate_answer_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "targetRole": {
                "title": "Backend Software Engineer",
                "seniorityLevel": "senior",
            },
            "skill": {
                "name": "Python",
            },
            "sessionType": "technical",
            "difficulty": "intermediate",
            "questionText": "How would you handle high concurrency in Python?",
            "userAnswer": (
                "In Python, for I/O bound workloads I utilize asyncio with an event loop. "
                "For CPU-bound tasks, because of GIL lock contention, I delegate work to "
                "a multiprocessing pool or background Celery workers, optimizing memory footprint "
                "and measuring latency trade-offs with APM tracing."
            ),
        }
        resp = await client.post("/api/v1/career/evaluate-answer", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["overallRating"] in ["strong", "adequate"]
        assert len(data["dimensions"]) == 5
        assert isinstance(data["strengths"], list)
        assert isinstance(data["gaps"], list)
        assert "feedbackNotes" in data
