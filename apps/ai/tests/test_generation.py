import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.provider import MockProvider, GeminiProvider, TextGenerationRequest
from app.core.prompt_synthesizer import PromptSynthesizer


@pytest.fixture
def sample_context_frame():
    return {
        "assembledAt": "2026-10-02T12:00:00.000Z",
        "identity": {
            "userId": "11111111-1111-1111-1111-111111111111",
            "displayName": "Aria Sharma",
            "preferredName": "Aria",
            "occupationRole": "Software Engineer",
            "primaryFocus": "Distributed Systems",
            "timezone": "UTC",
        },
        "companion": {
            "archetypeId": "niva_anchor",
            "name": "The Balanced Anchor",
            "tagline": "Grounded, thoughtful, and context-aware continuity.",
            "description": "Balanced empathy and structured thinking.",
            "defaultTraits": {
                "warmth": 75,
                "directness": 65,
                "humor": 50,
                "challengeLevel": 60,
                "proactivity": "medium",
                "responseLength": "balanced",
            },
            "presenceStatus": "active",
            "interactionMode": "study",
            "continuityStreakDays": 5,
            "totalInteractions": 42,
            "lastInteractionAt": "2026-10-02T11:45:00.000Z",
            "activeFocusGoalTitle": "Master System Design",
            "activeFocusProjectTitle": "Distributed Cache in Go",
        },
        "communicationPreferences": {
            "warmth": 80,
            "directness": 60,
            "humor": 50,
            "challengeLevel": 60,
            "proactivity": "high",
            "responseLength": "concise",
        },
        "lifeGroundTruth": {
            "activeGoals": [
                {
                    "id": "goal-1",
                    "title": "Master System Design",
                    "priority": "high",
                    "progressPercentage": 35,
                }
            ],
            "activeProjects": [
                {
                    "id": "proj-1",
                    "title": "Distributed Cache in Go",
                    "status": "in_progress",
                }
            ],
            "relevantTasks": [
                {
                    "id": "task-1",
                    "title": "Write Raft heartbeat tests",
                    "priority": "urgent",
                    "status": "todo",
                }
            ],
            "upcomingCommitments": [
                {
                    "id": "comm-1",
                    "title": "Mock Interview with SRE",
                    "importance": "critical",
                    "dueAt": "2026-10-05T09:00:00Z",
                    "hoursUntilDue": 69,
                }
            ],
        },
        "dialogueContext": {
            "conversationId": "22222222-2222-2222-2222-222222222222",
            "title": "System Architecture Review",
            "messages": [
                {
                    "sequenceNumber": 1,
                    "senderRole": "user",
                    "content": "Hello Anchor, let's review Raft consensus today.",
                },
                {
                    "sequenceNumber": 2,
                    "senderRole": "assistant",
                    "content": "Ready when you are. Where would you like to start?",
                },
            ],
        },
        "temporalGrounding": {
            "utcTimestamp": "2026-10-02T12:00:00Z",
            "userLocalTime": "2026-10-02T12:00:00Z",
            "timezone": "UTC",
            "dayOfWeek": "Friday",
            "timeOfDayGreeting": "Good afternoon",
            "minutesSinceLastInteraction": 15,
        },
    }


def test_prompt_synthesizer(sample_context_frame):
    user_msg = "What should I review first for my goal?"
    system_inst, history = PromptSynthesizer.synthesize(sample_context_frame, user_msg)

    # 1. System instruction contains persona name and guidance
    assert "The Balanced Anchor" in system_inst
    assert "Aria" in system_inst
    assert "Active Goal Focus: Master System Design" in system_inst
    assert "Distributed Cache in Go" in system_inst
    assert "Good afternoon" in system_inst
    assert "INVIOLABLE OPERATIONAL RULES" in system_inst

    # 2. History contains previous turns
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Hello Anchor, let's review Raft consensus today."
    assert history[1]["role"] == "model"
    assert history[1]["content"] == "Ready when you are. Where would you like to start?"


@pytest.mark.asyncio
async def test_mock_provider():
    provider = MockProvider()
    assert provider.provider_name == "mock"
    assert provider.is_configured() is True

    req = TextGenerationRequest(
        prompt="What is my primary goal?",
        system_instruction="You are The Balanced Anchor.\nActive Goal Focus: Master System Design",
    )
    res = await provider.generate_text(req)

    assert res.provider == "mock"
    assert "Master System Design" in res.content
    assert res.latency_ms > 0
    assert res.usage.total_tokens is not None


def test_gemini_provider_configuration():
    # When api_key is empty
    p1 = GeminiProvider(api_key="")
    assert p1.provider_name == "gemini"
    assert p1.is_configured() is False

    # When api_key is non-empty
    p2 = GeminiProvider(api_key="valid-test-key")
    assert p2.is_configured() is True


@pytest.mark.asyncio
async def test_generate_reply_endpoint(sample_context_frame):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "conversationId": "22222222-2222-2222-2222-222222222222",
            "userMessage": "What is my active focus goal right now?",
            "contextFrame": sample_context_frame,
            "temperature": 0.7,
            "maxOutputTokens": 1024,
            "requestId": "test-req-1234",
        }
        response = await client.post("/api/v1/companion/generate-reply", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "content" in data
        assert len(data["content"]) > 0
        assert data["requestId"] == "test-req-1234"
        assert "latencyMs" in data
        assert "usage" in data
        assert data["provider"] in ["gemini", "mock"]


@pytest.mark.asyncio
async def test_generate_reply_validation_failure():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Empty userMessage should fail validation (422)
        payload = {
            "conversationId": "22222222-2222-2222-2222-222222222222",
            "userMessage": "",
            "contextFrame": {},
        }
        response = await client.post("/api/v1/companion/generate-reply", json=payload)
        assert response.status_code == 422


def test_prompt_synthesizer_with_memories(sample_context_frame):
    frame_with_memories = dict(sample_context_frame)
    frame_with_memories["relevantMemories"] = [
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "category": "user_preference",
            "content": "User prefers black coffee with oat milk and no sugar",
            "confidence": 0.95,
            "confidenceType": "explicit",
            "importance": 7,
            "relevanceScore": 0.88,
            "similarity": 0.82,
            "lastReinforcedAt": "2026-10-02T12:00:00.000Z",
            "createdAt": "2026-10-01T12:00:00.000Z",
        },
        {
            "id": "44444444-4444-4444-4444-444444444444",
            "category": "semantic_fact",
            "content": "User works remotely from Seattle",
            "confidence": 0.80,
            "confidenceType": "inferred",
            "importance": 5,
            "relevanceScore": 0.72,
            "similarity": 0.70,
            "lastReinforcedAt": "2026-10-01T12:00:00.000Z",
            "createdAt": "2026-10-01T12:00:00.000Z",
        }
    ]

    system_instruction, _ = PromptSynthesizer.synthesize(
        frame_with_memories,
        "What kind of coffee do I drink?"
    )

    assert "=== RETRIEVED DURABLE MEMORIES (PERSISTENT USER KNOWLEDGE) ===" in system_instruction
    assert "User prefers black coffee with oat milk and no sugar" in system_instruction
    assert "User works remotely from Seattle" in system_instruction
    assert "[User Preference]" in system_instruction
    assert "[Semantic Fact]" in system_instruction
    assert "=== MEMORY GROUNDING DIRECTIVES ===" in system_instruction
    assert "FRESH TRUTH TRUMPS PAST MEMORY" in system_instruction
    assert "EPISTEMIC QUALIFICATION" in system_instruction


@pytest.mark.asyncio
async def test_mock_provider_grounds_on_retrieved_memory(sample_context_frame):
    frame_with_memories = dict(sample_context_frame)
    frame_with_memories["relevantMemories"] = [
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "category": "user_preference",
            "content": "User prefers black coffee with oat milk and no sugar",
            "confidence": 0.95,
            "confidenceType": "explicit",
            "importance": 7,
            "relevanceScore": 0.88,
            "similarity": 0.82,
            "lastReinforcedAt": "2026-10-02T12:00:00.000Z",
            "createdAt": "2026-10-01T12:00:00.000Z",
        }
    ]

    system_instruction, history = PromptSynthesizer.synthesize(
        frame_with_memories,
        "Do you remember my coffee preference?"
    )

    provider = MockProvider()
    response = await provider.generate_text(
        TextGenerationRequest(
            prompt="Do you remember my coffee preference?",
            system_instruction=system_instruction,
            history=history,
        )
    )

    assert "black coffee" in response.content.lower() or "recall" in response.content.lower()
    assert response.provider == "mock"


def test_prompt_synthesizer_adaptive_mode_and_signals(sample_context_frame):
    frame_with_decision = dict(sample_context_frame)
    frame_with_decision["companionDecision"] = {
        "decision": "challenge",
        "mode": "challenge",
        "priority": "normal",
        "rationale": "Repeated postponement detected: 2 reschedules in 7 days",
        "interventionWarranted": True,
        "behavioralSignals": [
            {
                "type": "repeated_postponement",
                "count": 2,
                "windowDays": 7,
                "summary": "Postponed task 'Draft RFC' twice within 7 days",
            }
        ],
    }

    system_instruction, _ = PromptSynthesizer.synthesize(
        frame_with_decision,
        "I will push the RFC to next week again."
    )

    assert "CHALLENGE" in system_instruction
    assert "repeated_postponement" in system_instruction
    assert "CONSTRUCTIVE ACCOUNTABILITY" in system_instruction
    assert "IMMEDIATE USER PRIORITY" in system_instruction


def test_prompt_synthesizer_career_intelligence(sample_context_frame):
    frame_with_career = dict(sample_context_frame)
    frame_with_career["careerContext"] = {
        "profile": {
            "headline": "Staff Distributed Systems Engineer",
            "currentLevel": "senior",
            "targetTimelineMonths": 6,
            "targetCompanyTiers": ["faang_tier", "cloud_infrastructure"],
            "status": "active_preparation",
        },
        "primaryTargetRole": {
            "id": "11111111-1111-1111-1111-111111111111",
            "title": "Principal Storage Architect",
            "roleFamily": "systems_infrastructure",
            "seniorityLevel": "principal",
            "priority": "primary",
        },
        "readinessScore": 68,
        "statedReadiness": "interview_ready",
        "evidenceAlignmentScore": 42,
        "readinessDiscrepancy": "overconfident",
        "criticalGaps": [
            {
                "skillName": "Distributed Consensus (Raft/Paxos)",
                "importance": "mandatory",
                "requiredProficiency": "expert",
                "currentProficiency": "intermediate",
                "hasEvidence": False,
            }
        ],
        "keyStrengths": [
            {
                "skillName": "Rust Concurrency & Memory Safety",
                "evidenceCount": 3,
            }
        ],
        "recentActivities": [
            {
                "title": "Mock Interview: Partition-Tolerant Key Value Store",
                "activityType": "mock_interview",
                "status": "completed",
                "completedAt": "2026-10-08T18:00:00.000Z",
            }
        ],
        "nextPriorities": [
            "Build practical Raft leader election artifact",
            "Practice distributed state machine recovery scenarios",
        ],
    }

    system_instruction, _ = PromptSynthesizer.synthesize(
        frame_with_career,
        "How ready am I for the Principal Storage Architect interviews?"
    )

    assert "=== CAREER TRAJECTORY & PREPARATION INTELLIGENCE ===" in system_instruction
    assert "Principal Storage Architect" in system_instruction
    assert "Calculated Score: 68/100" in system_instruction
    assert "Stated Readiness: interview_ready" in system_instruction
    assert "Evidence Alignment: 42/100" in system_instruction
    assert "Discrepancy: OVERCONFIDENT" in system_instruction
    assert "Distributed Consensus (Raft/Paxos)" in system_instruction
    assert "Rust Concurrency & Memory Safety" in system_instruction
    assert "Mock Interview: Partition-Tolerant Key Value Store" in system_instruction
    assert "Build practical Raft leader election artifact" in system_instruction
    assert "CAREER DIRECTIVES:" in system_instruction


