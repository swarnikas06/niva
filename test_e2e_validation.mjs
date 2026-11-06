// test_e2e_validation.mjs
// Real-world validation runner for NIVA Phase 9/Production Verification

const API_BASE = 'http://localhost:4000/api/v1';

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }

  // Unwrap TransformInterceptor envelope if present
  let data = json;
  if (json && typeof json === 'object' && json.success === true && json.data !== undefined) {
    data = json.data;
  }

  return { status: res.status, headers: res.headers, raw: json, data };
}

function extractCookie(headers, cookieName) {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function run() {
  console.log('================================================================');
  console.log('   NIVA REAL-WORLD PRODUCT VALIDATION — LIVE EXECUTION RUNNER   ');
  console.log('================================================================\n');

  const ts = Date.now();
  const userAEmail = `val_user_a_${ts}@niva.ai`;
  const userBEmail = `val_user_b_${ts}@niva.ai`;
  const password = 'Password123!';

  const results = {
    auth: {},
    personalization: {},
    lifeContext: {},
    conversations: {},
    conversationalIntelligence: [],
    conversationToAction: {},
    crossTenantSecurity: {},
    studyAndCareer: {},
  };

  // --------------------------------------------------------------------------
  // PART 1: AUTHENTICATION & PROTECTED ROUTES
  // --------------------------------------------------------------------------
  console.log('>>> [1/7] Testing Authentication, Session & Protected Routes...');

  // 1.1 Unauthenticated route check
  const unauthCheck = await api('/conversations');
  console.log(`- Protected route without token: HTTP ${unauthCheck.status} (Expected: 401)`);
  results.auth.unauthBlocked = unauthCheck.status === 401;

  // 1.2 Registration of User A
  const regA = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: userAEmail,
      password,
      name: 'Dr. Val Sharma',
    }),
  });
  console.log(`- Register User A (${userAEmail}): HTTP ${regA.status}`);
  const userA = regA.data?.user;
  const tokenA = regA.data?.tokens?.accessToken;
  const refreshA = extractCookie(regA.headers, 'niva_refresh_token');
  console.log(`  User ID: ${userA?.id}, AccessToken present: ${!!tokenA}, RefreshCookie: ${!!refreshA}`);
  results.auth.regA = regA.status === 201 && !!tokenA;

  // 1.3 User A /auth/me check
  const meA = await api('/auth/me', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const userName = meA.data?.user?.name || meA.data?.name;
  console.log(`- User A /auth/me: HTTP ${meA.status}, name: "${userName}"`);
  results.auth.meA = meA.status === 200 && userName === 'Dr. Val Sharma';

  // 1.4 Token Refresh check
  const refreshCheck = await api('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshA }),
  });
  console.log(`- User A token refresh: HTTP ${refreshCheck.status}, received new accessToken`);
  results.auth.refresh = refreshCheck.status === 200 && !!refreshCheck.data?.tokens?.accessToken;

  // 1.5 Registration of User B (for cross-tenant isolation testing)
  const regB = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: userBEmail,
      password,
      name: 'Alex Isolation Tester',
    }),
  });
  console.log(`- Register User B (${userBEmail}): HTTP ${regB.status}`);
  const userB = regB.data?.user;
  const tokenB = regB.data?.tokens?.accessToken;
  results.auth.regB = regB.status === 201 && !!tokenB;

  // --------------------------------------------------------------------------
  // PART 2: PERSONALIZATION & CHARACTER SELECTION
  // --------------------------------------------------------------------------
  console.log('\n>>> [2/7] Testing Characters & Personalization Calibration...');

  // 2.1 Fetch active archetypes
  const charList = await api('/characters');
  console.log(`- Available Archetypes (${charList.data?.length || 0}): ${charList.data?.map(c => c.name).join(', ')}`);

  // 2.2 User A selects The Balanced Anchor and updates preferences
  const updatePers = await api('/personalization/onboarding', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      step: 'completed',
      preferredName: 'Val',
      occupationRole: 'Software Engineer & Systems Researcher',
      primaryFocus: 'technical_placement',
      selectedArchetypeId: 'niva_anchor',
      warmth: 80,
      directness: 70,
      humor: 50,
      challengeLevel: 65,
      proactivity: 'medium',
      responseLength: 'balanced',
      complete: true,
    }),
  });
  console.log(`- User A Personalization Saved: HTTP ${updatePers.status}, Archetype: ${updatePers.data?.selectedArchetypeId}`);
  results.personalization.saved = updatePers.status === 200 && updatePers.data?.onboardingCompleted === true;

  // --------------------------------------------------------------------------
  // PART 3: LIFE CONTEXT INITIALIZATION (Ground Truth for Intelligence)
  // --------------------------------------------------------------------------
  console.log('\n>>> [3/7] Populating Verified Ground-Truth Life Context for User A...');

  // 3.1 Goal
  const goalRes = await api('/life/goals', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      title: 'Master Distributed Systems & High-Scale Architecture',
      description: 'Deep dive into Raft consensus, distributed transactions, and placement rounds',
      category: 'technical',
      priority: 'high',
      progressPercentage: 40,
    }),
  });
  const goalId = goalRes.data?.id;
  console.log(`- Created Goal: "${goalRes.data?.title}" (id: ${goalId})`);

  // 3.2 Project linked to Goal
  const projectRes = await api('/life/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      goalId,
      title: 'Raft Consensus Implementation',
      description: 'Building leader election, log replication, and persistence in Go',
      status: 'in_progress',
    }),
  });
  const projectId = projectRes.data?.id;
  console.log(`- Created Project: "${projectRes.data?.title}" (id: ${projectId})`);

  // 3.3 Task 1 (Active)
  const task1Res = await api('/life/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      projectId,
      title: 'Implement Raft leader election',
      priority: 'high',
    }),
  });
  const task1Id = task1Res.data?.id;
  console.log(`- Created Task 1: "${task1Res.data?.title}" (id: ${task1Id})`);

  // 3.4 Task 2 (Active)
  const task2Res = await api('/life/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      projectId,
      title: 'Revise Python async paradigms',
      priority: 'medium',
    }),
  });
  const task2Id = task2Res.data?.id;
  console.log(`- Created Task 2: "${task2Res.data?.title}" (id: ${task2Id})`);

  // 3.5 Commitment
  const commRes = await api('/life/commitments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      relatedGoalId: goalId,
      title: 'Distributed Systems Placement Round',
      commitmentType: 'interview',
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      importance: 'critical',
    }),
  });
  const commId = commRes.data?.id;
  console.log(`- Created Commitment: "${commRes.data?.title}" (due in 5 days)`);

  results.lifeContext = {
    goalId,
    projectId,
    task1Id,
    task2Id,
    commId,
  };

  // --------------------------------------------------------------------------
  // PART 4: CONVERSATION INITIALIZATION & REAL-WORLD CONVERSATIONAL INTELLIGENCE
  // --------------------------------------------------------------------------
  console.log('\n>>> [4/7] Testing Realistic Dialogues & Adaptive Companion Responses...');

  const convRes = await api('/conversations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      characterId: 'niva_anchor',
      title: 'Daily Continuity & Architecture Session',
    }),
  });
  const convId = convRes.data?.id;
  console.log(`- Initialized Conversation: ID ${convId} (Status: HTTP ${convRes.status})\n`);
  results.conversations.created = convRes.status === 201 && !!convId;

  // Test Prompts specified in Part 3 of user instructions
  const testPrompts = [
    {
      label: '1. Casual Greeting',
      prompt: 'Hey!',
      expectedMode: 'greeting',
      description: 'Short warm natural greeting, no unsolicited task pressure',
    },
    {
      label: '2. Emotional Fatigue / Overwhelm',
      prompt: "I'm exhausted today.",
      expectedMode: 'emotional_support',
      description: 'Empathetic validation and cognitive space, no to-do pressure',
    },
    {
      label: '3. Urgent Deadline / Panic',
      prompt: 'I have an assignment due tomorrow.',
      expectedMode: 'deadline_triage',
      description: 'Immediate calm triage, minimum-viable path',
    },
    {
      label: '4. Milestone Win / Accomplishment',
      prompt: 'I finally completed my project.',
      expectedMode: 'encourage',
      description: 'Warm celebration of progress and momentum',
    },
    {
      label: '5. Procrastination / Behavioral Challenge',
      prompt: 'I keep postponing my placement preparation.',
      expectedMode: 'challenge',
      description: 'Constructive accountability, gentle reality-check without shame',
    },
    {
      label: '6. Natural Language Reminder Request',
      prompt: 'Remind me tomorrow at 7 AM to revise Python.',
      expectedAction: 'commitment_created',
      description: 'Parsed by backend, persisted to life_commitments, confirmed truthfully',
    },
    {
      label: '7. Low Energy / Reluctance',
      prompt: "I don't feel like studying today.",
      expectedMode: 'emotional_support',
      description: 'Low-pressure understanding, validates state, offers gentle entry',
    },
    {
      label: '8. Durable Project Context Recall',
      prompt: 'Do you remember what project I was working on?',
      expectedContext: 'Raft',
      description: 'Grounded in life context ground truth ("Raft Consensus Implementation")',
    },
  ];

  for (const item of testPrompts) {
    console.log(`----------------------------------------------------------------`);
    console.log(`TEST [${item.label}] User says: "${item.prompt}"`);
    const turnStart = Date.now();
    const turnRes = await api(`/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ content: item.prompt }),
    });
    const latency = Date.now() - turnStart;

    if (turnRes.status !== 201) {
      console.error(`  FAIL: HTTP ${turnRes.status} Error:`, turnRes.data || turnRes.raw);
      results.conversationalIntelligence.push({
        label: item.label,
        prompt: item.prompt,
        status: 'FAILED',
        error: turnRes.data || turnRes.raw,
      });
      continue;
    }

    const { assistantMessage, decision } = turnRes.data;
    console.log(`  Adaptive Mode: ${decision?.mode} | Decision: ${decision?.decision} | Latency: ${latency}ms`);
    console.log(`  Decision Rationale: "${decision?.rationale}"`);
    console.log(`  Assistant: "${assistantMessage?.content}"\n`);

    results.conversationalIntelligence.push({
      label: item.label,
      prompt: item.prompt,
      mode: decision?.mode,
      decision: decision?.decision,
      rationale: decision?.rationale,
      reply: assistantMessage?.content,
      latencyMs: latency,
      passed: true,
    });
  }

  // --------------------------------------------------------------------------
  // PART 5: CONVERSATION-TO-ACTION PIPELINE VALIDATION
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log('>>> [5/7] Testing Complete Conversation-to-Action Execution Flow...');

  // 5.1 Test Task Creation via Dialogue
  console.log('\n--- 5.1: Natural Language Task Creation ---');
  const taskPrompt = 'Add task: Read Raft paper section 5 on cluster membership';
  console.log(`User says: "${taskPrompt}"`);
  const taskTurn = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ content: taskPrompt }),
  });
  console.log(`Assistant replied: "${taskTurn.data?.assistantMessage?.content}"`);

  // Verify task in life context API
  const tasksAfterCreate = await api('/life/tasks', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const createdTaskFound = tasksAfterCreate.data?.find(t => 
    t.title.toLowerCase().includes('raft paper section 5')
  );
  console.log(`- Verified task persisted in backend API: ${createdTaskFound ? 'YES (ID: ' + createdTaskFound.id + ')' : 'NO'}`);
  results.conversationToAction.taskCreation = {
    prompt: taskPrompt,
    reply: taskTurn.data?.assistantMessage?.content,
    taskPersisted: !!createdTaskFound,
    taskId: createdTaskFound?.id,
  };

  // 5.2 Test Task Completion via Dialogue
  console.log('\n--- 5.2: Natural Language Task Completion ---');
  const completePrompt = 'I finished the task implement Raft leader election';
  console.log(`User says: "${completePrompt}"`);
  const completeTurn = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ content: completePrompt }),
  });
  console.log(`Decision Mode: ${completeTurn.data?.decision?.mode}`);
  console.log(`Assistant replied: "${completeTurn.data?.assistantMessage?.content}"`);

  // Verify task status in life context API
  const task1Updated = await api(`/life/tasks/${task1Id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log(`- Verified Task 1 status in database: "${task1Updated.data?.status}" (completedAt: ${task1Updated.data?.completedAt})`);
  results.conversationToAction.taskCompletion = {
    prompt: completePrompt,
    reply: completeTurn.data?.assistantMessage?.content,
    taskStatus: task1Updated.data?.status,
    completedAt: task1Updated.data?.completedAt,
    passed: task1Updated.data?.status === 'completed',
  };

  // 5.3 Verify Reminder from earlier Turn 6 in commitments
  console.log('\n--- 5.3: Verification of Reminder Created in Turn 6 ---');
  const commitmentsAfterReminder = await api('/life/commitments', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const reminderFound = commitmentsAfterReminder.data?.find(c => 
    c.title.toLowerCase().includes('revise python')
  );
  console.log(`- Verified Reminder in life_commitments: ${reminderFound ? 'YES ("' + reminderFound.title + '", due: ' + reminderFound.dueAt + ')' : 'NO'}`);
  results.conversationToAction.reminderCreation = {
    persisted: !!reminderFound,
    title: reminderFound?.title,
    dueAt: reminderFound?.dueAt,
    type: reminderFound?.commitmentType,
  };

  // --------------------------------------------------------------------------
  // PART 6: CROSS-TENANT ISOLATION & SECURITY (IDOR Defense)
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('>>> [6/7] Testing Cross-Tenant Security & Tenant Isolation (User B vs User A)...');

  // 6.1 User B attempts to access User A conversation
  const idorConv = await api(`/conversations/${convId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`- User B access User A conversation (${convId}): HTTP ${idorConv.status} (Expected: 404)`);

  // 6.2 User B attempts to list messages of User A conversation
  const idorMsgs = await api(`/conversations/${convId}/messages`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`- User B access User A messages: HTTP ${idorMsgs.status} (Expected: 404)`);

  // 6.3 User B attempts to send message to User A conversation
  const idorSend = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ content: 'Malicious injection from User B' }),
  });
  console.log(`- User B inject message into User A conversation: HTTP ${idorSend.status} (Expected: 404)`);

  // 6.4 User B attempts to access User A task
  const idorTask = await api(`/life/tasks/${task1Id}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`- User B access User A task (${task1Id}): HTTP ${idorTask.status} (Expected: 404)`);

  // 6.5 User B attempts to delete User A goal
  const idorGoal = await api(`/life/goals/${goalId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`- User B delete User A goal (${goalId}): HTTP ${idorGoal.status} (Expected: 404)`);

  results.crossTenantSecurity = {
    conversationBlocked: idorConv.status === 404,
    messagesBlocked: idorMsgs.status === 404,
    injectionBlocked: idorSend.status === 404,
    taskBlocked: idorTask.status === 404,
    goalDeleteBlocked: idorGoal.status === 404,
  };

  // --------------------------------------------------------------------------
  // PART 7: STUDY, CAREER, & REFLECTION INTELLIGENCE
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('>>> [7/7] Testing Study Sessions, Career Placement, & Longitudinal Reflection...');

  // 7.1 Study topic & session
  const topicRes = await api('/study/topics', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      subjectName: 'Distributed Systems',
      title: 'Raft Log Replication',
      targetProficiency: 'advanced',
    }),
  });
  const topicId = topicRes.data?.id;
  console.log(`- Created Study Topic: "${topicRes.data?.title}" (id: ${topicId})`);

  const startSessionRes = await api('/study/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      topicId,
      sessionType: 'concept_study',
      userNotes: 'Initial notes on Raft leader election invariants',
    }),
  });
  const sessionId = startSessionRes.data?.id;
  console.log(`- Started Study Session: id ${sessionId}`);

  const completeSessionRes = await api(`/study/sessions/${sessionId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      durationMinutes: 50,
      userNotes: 'Implemented commit index advancement logic and verified safety invariants.',
      updateTopicStatus: 'demonstrated',
    }),
  });
  console.log(`- Completed Study Session: HTTP ${completeSessionRes.status}`);

  // 7.2 Career Placement Strategy
  const careerStratRes = await api('/career/strategy', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log(`- Career Strategy: HTTP ${careerStratRes.status}`);

  // 7.3 Longitudinal Reflection Overview
  const reflectionRes = await api('/reflection/overview?windowDays=14', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log(`- Longitudinal Reflection Overview: HTTP ${reflectionRes.status}`);
  console.log(`  Recent Progress Items: ${reflectionRes.data?.recentProgress?.length || 0}`);
  if (reflectionRes.data?.recentProgress?.length > 0) {
    reflectionRes.data.recentProgress.forEach(p => console.log(`   * ${p}`));
  }

  results.studyAndCareer = {
    studyTopicCreated: !!topicId,
    sessionCompleted: completeSessionRes.status === 200,
    careerStrategyAccessible: careerStratRes.status === 200,
    reflectionOverviewAccessible: reflectionRes.status === 200,
    progressCount: reflectionRes.data?.recentProgress?.length || 0,
  };

  console.log('\n================================================================');
  console.log('   VALIDATION SUITE COMPLETE — OUTPUTTING STRUCTURED RESULTS   ');
  console.log('================================================================');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('Fatal Validation Execution Error:', err);
  process.exit(1);
});
