"""
NIVA Memory Candidate Evaluation Prompt
Version: v1.0.0
Phase: 3C — Memory Evaluation, Lifecycle, Deduplication & Durable Knowledge

Defines structured instructions for evaluating memory candidates against existing memories,
durability criteria, operational entity non-duplication, and contradiction/supersession rules.
"""

from typing import List, Dict, Optional, Any

MEMORY_EVALUATION_PROMPT_VERSION = "1.0.0"

MEMORY_EVALUATION_SYSTEM_INSTRUCTION = """You are NIVA's Memory Evaluation Engine.
Your responsibility is to critically evaluate a proposed MEMORY CANDIDATE to decide whether it should become durable long-term knowledge.
You must NOT blindly accept candidates. You must maintain epistemic rigor, durability standards, and historical consistency.

=== CRITICAL EVALUATION RULES ===

1. DURABILITY VS TRANSIENCE:
   - DURABLE (Acceptable): Enduring user preferences, core habits, biographical facts, professional background, long-term skills, unresolved intellectual open loops.
   - TRANSIENT (Must Reject): Momentary physical or emotional states ("I am tired today", "I was busy", "I am drinking coffee", "I have a headache").

2. NO OPERATIONAL DUPLICATION:
   - Operational tasks, calendar deadlines, and immediate to-dos ("exam tomorrow", "submit assignment by Friday", "buy groceries") belong strictly to Life Context.
   - If a candidate represents an operational task, commitment, or immediate deadline, REJECT it with reason: "Operational commitment belongs in Life Context".

3. DUPLICATE HANDLING:
   - Review the candidate against the provided EXISTING ACTIVE MEMORIES.
   - If the candidate expresses essentially the same underlying fact or preference already recorded in an active memory (even if worded differently, e.g. "User likes using Python rather than C++" vs "User prefers Python for programming"):
     -> DECISION: "reject"
     -> DUPLICATE_OF_MEMORY_ID: "<id of existing matching memory>"
     -> REASON: "Semantic duplicate of existing active memory"

4. CONTRADICTION & SUPERSESSION:
   - If the candidate updates, supersedes, or directly contradicts an existing active memory (e.g. candidate says user now focuses on C++ instead of Python, while existing memory says user prefers Python):
     -> DECISION: "supersede"
     -> SUPERSEDES_MEMORY_ID: "<id of existing contradicted memory>"
     -> REASON: "Candidate contradicts and updates prior active memory"

5. DEFERRAL:
   - If the candidate is ambiguous, premature, or speculative without enough evidence to decide durability:
     -> DECISION: "defer"
     -> REASON: "Insufficient conversational evidence to determine durability"

6. NO PERSONALITY OR PSYCHOLOGICAL DIAGNOSIS:
   - Never diagnose psychological disorders, neurodivergence, or personality pathologies.

=== ALLOWED DECISIONS (EXACT STRING MATCH REQUIRED) ===
- "accept": Candidate is durable, non-duplicate, non-operational, and ready to be stored as active memory.
- "reject": Candidate is transient, operational, duplicate, or unverified.
- "supersede": Candidate updates/contradicts an existing active memory and will replace it.
- "defer": Candidate is inconclusive and requires further context before promotion.

=== OUTPUT FORMAT ===
You MUST return a valid JSON object with this exact structure:
{
  "candidateId": "<candidate UUID>",
  "decision": "accept" | "reject" | "supersede" | "defer",
  "reason": "Clear explanation of the evaluation decision",
  "confidence": 0.95,
  "supersedesMemoryId": "<UUID or null>",
  "duplicateOfMemoryId": "<UUID or null>"
}
"""


class MemoryEvaluationPromptBuilder:
    """
    Constructs the prompt for evaluating a memory candidate against existing memories.
    """

    @classmethod
    def build(
        cls,
        candidate: Dict[str, Any],
        existing_memories: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        return cls.build_prompt(
            candidate_id=str(candidate.get("id") or candidate.get("candidateId") or "unknown"),
            category=str(candidate.get("category", "semantic_fact")),
            content=str(candidate.get("content", "")),
            confidence=float(candidate.get("confidence", 1.0)),
            confidence_type=str(candidate.get("confidenceType") or candidate.get("confidence_type") or "explicit"),
            existing_memories=existing_memories,
            context=context,
        )

    @staticmethod
    def build_prompt(
        candidate_id: str,
        category: str,
        content: str,
        confidence: float,
        confidence_type: str,
        existing_memories: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        sections: List[str] = []

        sections.append(
            f"=== CANDIDATE TO EVALUATE ===\n"
            f"Candidate ID: {candidate_id}\n"
            f"Category: {category}\n"
            f"Content: \"{content}\"\n"
            f"Confidence: {confidence:.2f} ({confidence_type})\n"
        )

        if existing_memories and len(existing_memories) > 0:
            mem_lines: List[str] = []
            for mem in existing_memories:
                m_id = mem.get("id", "unknown")
                m_cat = mem.get("category", "unknown")
                m_content = mem.get("content", "")
                sim = mem.get("similarity")
                sim_str = f" [Similarity: {sim:.2f}]" if sim is not None else ""
                mem_lines.append(f"- ID: {m_id} | Category: {m_cat}{sim_str}\n  Content: \"{m_content}\"")
            sections.append("=== EXISTING ACTIVE USER MEMORIES (FOR COMPARISON) ===\n" + "\n".join(mem_lines) + "\n")
        else:
            sections.append("=== EXISTING ACTIVE USER MEMORIES ===\nNone on record.\n")

        if context:
            sections.append(f"=== ADDITIONAL CONTEXT ===\n{context}\n")

        sections.append(
            "=== TASK ===\n"
            "Evaluate the candidate memory according to the system directives. "
            "Determine decision: 'accept', 'reject', 'supersede', or 'defer'. "
            "Return ONLY the structured JSON object."
        )

        return "\n".join(sections)
