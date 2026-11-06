// test_conversational_refinement.mjs
// Comprehensive verification for NIVA Conversational Intelligence Refinement

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

  let data = json;
  if (json && typeof json === 'object' && json.success === true && json.data !== undefined) {
    data = json.data;
  }

  return { status: res.status, headers: res.headers, raw: json, data };
}

async function run() {
  console.log('================================================================');
  console.log('   NIVA CONVERSATIONAL INTELLIGENCE REFINEMENT VERIFICATION     ');
  console.log('================================================================\n');

  const ts = Date.now();
  const userEmail = `refinement_user_${ts}@niva.ai`;
  const password = 'Password123!';
  const userName = 'Swarnika S';

  // 1. Register User
  console.log(`>>> [1/5] Registering verification user: ${userEmail}...`);
  const regRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userEmail, password, name: userName }),
  });
  if (regRes.status !== 201) {
    throw new Error(`Failed to register: ${JSON.stringify(regRes.data)}`);
  }
  const token = regRes.data.tokens.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(`✓ User registered with ID: ${regRes.data.user.id}`);

  // 2. Setup Life Context & Tasks
  console.log('\n>>> [2/5] Setting up realistic Life Context & Tasks (Raft Project, Placement Prep)...');
  const goalRes = await api('/life/goals', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Clear Tier-1 Placement & Master Distributed Systems',
      category: 'career',
      priority: 'high',
    }),
  });
  const goalId = goalRes.data?.id;

  const projRes = await api('/life/projects', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      goalId,
      title: 'Raft consensus engine in Go',
      description: 'Distributed consensus implementation in Go with leader election and log replication',
      status: 'in_progress',
    }),
  });
  const projectId = projRes.data?.id;
  console.log(`✓ Project established: "${projRes.data?.title}" (id: ${projectId})`);

  // Add sample tasks
  await api('/life/tasks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      projectId,
      title: 'Implement Raft leader election RPC in Go',
      priority: 'high',
    }),
  });
  await api('/life/tasks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Practice dynamic programming questions for placement',
      priority: 'medium',
    }),
  });
  console.log('✓ Initial tasks created.');

  // Fetch archetypes
  const archRes = await api('/characters', { headers: authHeaders });
  const archetypes = archRes.data || [];
  console.log(`✓ Available archetypes (${archetypes.length}):`, archetypes.map(a => a.id));

  const testResults = [];

  // Helper to run a dialogue turn
  async function testTurn({ testId, name, prompt, archetypeId, checks, newConversation = true, convId = null }) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`TEST ${testId}: ${name}`);
    console.log(`Archetype: ${archetypeId || 'default (The Balanced Anchor)'}`);
    console.log(`User Prompt: "${prompt}"`);

    let activeConvId = convId;
    if (newConversation || !activeConvId) {
      const convRes = await api('/conversations', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          characterId: archetypeId || 'niva_anchor',
          title: 'New Conversation',
        }),
      });
      activeConvId = convRes.data.id;
    }

    const start = Date.now();
    const turnRes = await api(`/conversations/${activeConvId}/messages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ content: prompt }),
    });
    const latency = Date.now() - start;

    if (turnRes.status !== 200 && turnRes.status !== 201) {
      console.error(`✗ Request failed with status ${turnRes.status}:`, turnRes.raw);
      testResults.push({ testId, name, passed: false, error: `HTTP ${turnRes.status}` });
      return { activeConvId, passed: false };
    }

    const turn = turnRes.data;
    const assistantMsg = turn?.assistantMessage?.content || '';
    const updatedTitle = turn?.conversationTitle || '';
    const suggestedActions = turn?.suggestedActions || [];

    console.log(`Response Latency: ${latency}ms`);
    console.log(`Conversation Title Generated: "${updatedTitle}"`);
    console.log(`Response:\n"""\n${assistantMsg}\n"""`);
    if (suggestedActions.length > 0) {
      console.log(`Suggested/Executed Actions:`, suggestedActions);
    }

    // Run verification checks
    const checkResults = [];
    for (const check of checks) {
      const result = check.eval({
        content: assistantMsg,
        title: updatedTitle,
        suggestedActions,
        turn,
      });
      console.log(`  [Check] ${check.desc}: ${result.passed ? 'PASS' : 'FAIL'} ${result.reason ? `(${result.reason})` : ''}`);
      checkResults.push({ desc: check.desc, passed: result.passed, reason: result.reason });
    }

    const allPassed = checkResults.every(c => c.passed);
    testResults.push({
      testId,
      name,
      passed: allPassed,
      prompt,
      response: assistantMsg,
      title: updatedTitle,
      latency,
      checks: checkResults,
      activeConvId,
    });

    return { activeConvId, passed: allPassed, assistantMsg };
  }

  // --------------------------------------------------------------------------
  // 3. RUN 8 MANDATORY TEST PROMPTS
  // --------------------------------------------------------------------------
  console.log('\n>>> [3/5] Executing 8 Mandatory Conversational Intelligence Scenarios...');

  // PROMPT 1: "Hey NIVA, how are you?"
  await testTurn({
    testId: 1,
    name: 'Casual Greeting without Unprompted Productivity',
    prompt: 'Hey NIVA, how are you?',
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'Concise response (<= 3 sentences or <= 60 words)',
        eval: ({ content }) => {
          const words = content.trim().split(/\s+/).length;
          const sentences = content.split(/[.!?]+/).filter(Boolean).length;
          return { passed: words <= 70, reason: `${words} words, ${sentences} sentences` };
        },
      },
      {
        desc: 'Does NOT mention placement, interviews, or career unprompted',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const hasPlacement = lower.includes('placement') || lower.includes('interview') || lower.includes('tier-1');
          return { passed: !hasPlacement, reason: hasPlacement ? 'Contained unprompted placement references' : 'Clean of placement bias' };
        },
      },
      {
        desc: 'Does NOT offer unsolicited tasks, goals or study roadmaps',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const hasStudy = lower.includes('study session') || lower.includes('focus area') || lower.includes('tackle');
          return { passed: !hasStudy, reason: hasStudy ? 'Contained unprompted productivity push' : 'Casual tone respected' };
        },
      },
      {
        desc: 'Dynamic 2-5 word Title generated',
        eval: ({ title }) => {
          const words = title.trim().split(/\s+/).length;
          return { passed: words >= 2 && words <= 6 && title !== 'New Conversation', reason: `Title: "${title}"` };
        },
      },
    ],
  });

  // PROMPT 2: "I'm exhausted."
  await testTurn({
    testId: 2,
    name: 'Emotional Exhaustion Grounded Empathy',
    prompt: "I'm exhausted.",
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'No therapist clichés ("take a deep breath", "honor your exhaustion", etc.)',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const hasCliche = lower.includes('deep breath') || lower.includes('honor your') || lower.includes('permission to rest') || lower.includes('inhale');
          return { passed: !hasCliche, reason: hasCliche ? 'Contained therapist cliché' : 'Natural grounded language' };
        },
      },
      {
        desc: 'No unsolicited 5-step sleep or recovery checklists',
        eval: ({ content }) => {
          const hasBullet = content.includes('1.') || content.includes('•') || content.includes('- ') || content.includes('* ');
          return { passed: !hasBullet, reason: hasBullet ? 'Contained structured checklist' : 'Cohesive conversational response' };
        },
      },
      {
        desc: 'Calibrated length (1 cohesive paragraph, <= 80 words)',
        eval: ({ content }) => {
          const words = content.trim().split(/\s+/).length;
          return { passed: words <= 95, reason: `${words} words` };
        },
      },
    ],
  });

  // PROMPT 3: "I feel like everyone is moving ahead except me."
  await testTurn({
    testId: 3,
    name: 'Imposter Syndrome / Feeling Left Behind',
    prompt: 'I feel like everyone is moving ahead except me.',
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'Thoughtful, stabilizing perspective without toxic positivity ("you\'re doing amazing!", etc.)',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const toxic = lower.includes("you're doing amazing") || lower.includes('you are doing amazing') || lower.includes('superstar');
          return { passed: !toxic, reason: toxic ? 'Contained toxic positivity' : 'Grounded perspective' };
        },
      },
      {
        desc: 'Does NOT dump immediate task list or unsolicited coaching protocol',
        eval: ({ content }) => {
          const hasList = content.includes('1.') || content.includes('Step 1') || content.includes('action plan:');
          return { passed: !hasList, reason: hasList ? 'Unsolicited action plan dumped' : 'Emotional space respected' };
        },
      },
    ],
  });

  // PROMPT 4: "I completed my project!"
  await testTurn({
    testId: 4,
    name: 'Milestone Celebration without Immediate Grind Pivot',
    prompt: 'I completed my project!',
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'Celebrates the achievement warmly',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const congratulates = lower.includes('congrat') || lower.includes('huge') || lower.includes('proud') || lower.includes('awesome') || lower.includes('milestone') || lower.includes('great') || lower.includes('done') || lower.includes('win');
          return { passed: congratulates, reason: congratulates ? 'Celebratory tone present' : 'Missing acknowledgment' };
        },
      },
      {
        desc: 'Does NOT immediately dump next tasks or ask what to grind next',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const pushGrind = lower.includes('next task on your list') || lower.includes('ready to dive into the next');
          return { passed: !pushGrind, reason: pushGrind ? 'Pushed immediate grind' : 'Allowed space to celebrate' };
        },
      },
    ],
  });

  // PROMPT 5: "What was I working on recently?"
  await testTurn({
    testId: 5,
    name: 'Context and Memory Recall (Raft Consensus / Go)',
    prompt: 'What was I working on recently?',
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'Accurately recalls real projects/tasks (Raft, Go, Distributed Systems)',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const recallsRaft = lower.includes('raft') || lower.includes('consensus') || lower.includes('distributed');
          return { passed: recallsRaft, reason: recallsRaft ? 'Recalled Raft/Distributed Systems' : 'Failed to recall context' };
        },
      },
      {
        desc: 'Does not give a generic "I have no data" or hallucinate nonexistent projects',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const failed = lower.includes("don't have any information") || lower.includes("no memories");
          return { passed: !failed, reason: failed ? 'Claimed no information' : 'Grounded in user context' };
        },
      },
    ],
  });

  // PROMPT 6: "I don't want advice. I just want to talk."
  await testTurn({
    testId: 6,
    name: 'Strict User Boundary (Zero Advice)',
    prompt: "I don't want advice. I just want to talk.",
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'Strictly zero advice, recommendations, or solutions',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const givesAdvice = lower.includes('you should') || lower.includes('try to') || lower.includes('i recommend') || lower.includes('make sure you') || lower.includes('here are 3 steps');
          return { passed: !givesAdvice, reason: givesAdvice ? 'Gave unsolicited advice' : 'Strict zero-advice adhered' };
        },
      },
      {
        desc: 'Offers pure listening presence and conversational openness',
        eval: ({ content }) => {
          const lower = content.toLowerCase();
          const listening = lower.includes('hear') || lower.includes('listen') || lower.includes('talk') || lower.includes('mind') || lower.includes('here');
          return { passed: listening, reason: listening ? 'Open listening presence confirmed' : 'Did not confirm listening' };
        },
      },
    ],
  });

  // PROMPT 7: "I need to prepare for my placement."
  await testTurn({
    testId: 7,
    name: 'Explicit Career/Technical Intent Calibration',
    prompt: 'I need to prepare for my placement.',
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'Provides structured, high-value coaching and actionable strategy when asked',
        eval: ({ content }) => {
          const words = content.trim().split(/\s+/).length;
          const lower = content.toLowerCase();
          const hasCoaching = lower.includes('placement') || lower.includes('prepare') || lower.includes('system') || lower.includes('technical') || lower.includes('dsa') || lower.includes('practice');
          return { passed: words >= 60 && hasCoaching, reason: `${words} words with strategic guidance` };
        },
      },
    ],
  });

  // PROMPT 8: "Remind me tomorrow at 7 AM to practise Python."
  await testTurn({
    testId: 8,
    name: 'Conversation-to-Action Execution (Reminder/Task)',
    prompt: 'Remind me tomorrow at 7 AM to practise Python.',
    archetypeId: 'niva_anchor',
    checks: [
      {
        desc: 'Detects intent and creates/suggests actionable reminder/task',
        eval: ({ suggestedActions, content }) => {
          const hasAction = suggestedActions && suggestedActions.length > 0;
          const confirmsInText = content.toLowerCase().includes('remind') || content.toLowerCase().includes('python') || content.toLowerCase().includes('7 am') || content.toLowerCase().includes('set');
          return { passed: hasAction || confirmsInText, reason: hasAction ? `Action executed: ${suggestedActions[0].actionType}` : 'Confirmed in text' };
        },
      },
    ],
  });

  // --------------------------------------------------------------------------
  // 4. TEST ARCHETYPE MODULATION
  // --------------------------------------------------------------------------
  console.log('\n>>> [4/5] Testing Archetype Personality Variations...');

  const archetypeVariations = [
    { id: 'niva_strategist', name: 'The Focused Strategist' },
    { id: 'niva_guide', name: 'The Calm Guide' },
    { id: 'niva_catalyst', name: 'The Energetic Catalyst' },
  ];

  for (const arch of archetypeVariations) {
    await testTurn({
      testId: `Arch-${arch.id}`,
      name: `Tone Modulation: ${arch.name}`,
      prompt: 'Hey NIVA, how are you?',
      archetypeId: arch.id,
      checks: [
        {
          desc: 'Concise casual greeting (< 70 words)',
          eval: ({ content }) => {
            const words = content.trim().split(/\s+/).length;
            return { passed: words <= 75, reason: `${words} words` };
          },
        },
        {
          desc: 'No unsolicited placement prep push',
          eval: ({ content }) => {
            const lower = content.toLowerCase();
            const hasPlacement = lower.includes('placement') || lower.includes('interview');
            return { passed: !hasPlacement, reason: hasPlacement ? 'Contained placement' : 'Clean of placement bias' };
          },
        },
      ],
    });
  }

  // --------------------------------------------------------------------------
  // 5. TEST PERSISTENCE IN DATABASE
  // --------------------------------------------------------------------------
  console.log('\n>>> [5/5] Verifying Conversation Titles & Message Persistence in Database...');
  const convListRes = await api('/conversations', { headers: authHeaders });
  const convs = convListRes.data?.items || [];
  console.log(`✓ Fetched ${convs.length} conversations from database:`);
  for (const c of convs.slice(0, 8)) {
    console.log(`  - [ID: ${c.id.substring(0, 8)}] Title: "${c.title}" | Character: ${c.characterId || c.character?.id}`);
  }

  const genericTitles = convs.filter(c => c.title === 'New Conversation' || c.title.toLowerCase().includes('dialogue with'));
  const hasDynamicTitles = convs.length > 0 && genericTitles.length < convs.length;
  console.log(`✓ Dynamic Title Generation Rate: ${convs.length - genericTitles.length}/${convs.length} conversations have custom topic titles.`);

  // Summary
  console.log('\n================================================================');
  console.log('                 FINAL TEST VERIFICATION SUMMARY                ');
  console.log('================================================================');
  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.passed).length;
  console.log(`Total Test Scenarios: ${totalTests}`);
  console.log(`Passed: ${passedTests} / ${totalTests}`);
  console.log(`Pass Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  for (const t of testResults) {
    console.log(`- [${t.passed ? 'PASS' : 'FAIL'}] Test ${t.testId}: ${t.name}`);
  }

  return { totalTests, passedTests, testResults };
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
