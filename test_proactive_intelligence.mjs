// test_proactive_intelligence.mjs
// Comprehensive Verification Suite for Personal Understanding & Proactive Intelligence

import { execSync } from 'child_process';

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

function psql(query) {
  try {
    const cmd = `docker exec -i niva-postgres psql -U niva_user -d niva_db -t -A`;
    return execSync(cmd, { input: query, encoding: 'utf-8' }).trim();
  } catch (err) {
    console.error('PSQL Error:', err.message);
    return null;
  }
}

async function run() {
  console.log('========================================================================');
  console.log('   NIVA PERSONAL UNDERSTANDING & PROACTIVE INTELLIGENCE VERIFICATION    ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const userEmail = `proactive_verifier_${ts}@niva.ai`;
  const password = 'Password123!';
  const userName = 'Swarnika S';

  const testReport = [];

  function record(id, title, passed, details) {
    testReport.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] Test ${id}: ${title}`);
    if (details) {
      console.log(`       Details: ${details}`);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 1: Register User & Check Initial State
  // -------------------------------------------------------------------------
  console.log('>>> [1/8] Registering verification user...');
  const regRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userEmail, password, name: userName }),
  });
  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  }
  const token = regRes.data.tokens.accessToken;
  const userId = regRes.data.user.id;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(`✓ User registered: ID = ${userId}\n`);

  // Verify initial profile returns 200 with initialized empty profile
  const initProfileRes = await api('/personalization/profile', { headers: authHeaders });
  record(
    '1.1',
    'Initial Profile Initialization',
    initProfileRes.status === 200 && initProfileRes.data?.userId === userId,
    `Profile returned status ${initProfileRes.status}`,
  );

  // -------------------------------------------------------------------------
  // STEP 2: Natural Profile Learning from Dialogue Turn 1
  // -------------------------------------------------------------------------
  console.log('\n>>> [2/8] Testing Natural Personal Understanding Learning...');
  const convRes = await api('/conversations', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      characterId: 'niva_anchor',
      title: 'Academic & Career Exploration',
    }),
  });
  const convId = convRes.data.id;

  const introPrompt =
    "Hi NIVA! I'm a final-year Computer Science student at Stanford University. I specialize in Go and distributed systems, and I'm preparing for backend infrastructure engineering roles. I prefer structured bullet-point explanations and early morning work.";

  console.log(`User says: "${introPrompt}"`);
  const turn1Res = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: introPrompt }),
  });

  const assistant1 = turn1Res.data?.assistantMessage?.content || '';
  console.log(`NIVA Reply:\n"""\n${assistant1}\n"""`);

  // Give async profile extractor 1 second
  await new Promise((r) => setTimeout(r, 1200));

  // Query profile via API
  const learnedProfileRes = await api('/personalization/profile', { headers: authHeaders });
  const profile = learnedProfileRes.data;

  const eduStr = JSON.stringify(profile?.education || {}).toLowerCase();
  const hasEducation = eduStr.includes('stanford') || eduStr.includes('computer science');
  const hasGo = (profile?.expertiseAreas || []).some((t) => t.toLowerCase().includes('go'));
  const commStr = JSON.stringify(profile?.communicationPreferences || {}).toLowerCase();
  const hasLearningStyle = commStr.includes('bullet') || commStr.includes('concise');
  const routineStr = JSON.stringify(profile?.dailyRoutines || {}).toLowerCase();
  const hasRoutine = routineStr.includes('morning');

  record(
    '2.1',
    'Natural Profile Learning (Education, Tech, Routine, Learning Style)',
    hasEducation && hasGo && hasLearningStyle && hasRoutine,
    `Education: "${profile?.education?.institution || profile?.education?.fieldOfStudy}", Tech: ${JSON.stringify(profile?.expertiseAreas)}, Comm: ${JSON.stringify(profile?.communicationPreferences)}`,
  );

  // Check Database Table user_profiles directly
  const dbProfileStr = psql(`SELECT education, expertise_areas FROM user_profiles WHERE user_id = '${userId}';`);
  record(
    '2.2',
    'Database Persistence of user_profiles Record',
    Boolean(dbProfileStr && dbProfileStr.includes('Stanford')),
    `DB Output: "${dbProfileStr}"`,
  );

  // -------------------------------------------------------------------------
  // STEP 3: Explicit Profile Edit & Attribute Deletion
  // -------------------------------------------------------------------------
  console.log('\n>>> [3/8] Testing Explicit Profile Management (PATCH & DELETE)...');
  const patchRes = await api('/personalization/profile', {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      learningPreferences: {
        style: 'first_principles',
        pace: 'intensive',
      },
      ongoingChallenges: [{ challenge: 'Paxos edge cases', severity: 'medium' }],
    }),
  });

  const patchedChallenges = patchRes.data?.ongoingChallenges || [];
  record(
    '3.1',
    'Explicit Profile Update (PATCH /personalization/profile)',
    patchRes.status === 200 && patchedChallenges.some((c) => c.challenge === 'Paxos edge cases'),
    `Patched challenges: ${JSON.stringify(patchedChallenges)}`,
  );

  // Delete attribute
  const delRes = await api('/personalization/profile/attributes/dailyRoutines', {
    method: 'DELETE',
    headers: authHeaders,
  });
  const afterDelProfile = await api('/personalization/profile', { headers: authHeaders });
  const routineEmpty = !afterDelProfile.data?.dailyRoutines || Object.keys(afterDelProfile.data.dailyRoutines).length === 0;
  record(
    '3.2',
    'Delete Specific Learned Attribute (DELETE /attributes/:key)',
    delRes.status === 200 && routineEmpty,
    `dailyRoutines after delete: ${JSON.stringify(afterDelProfile.data?.dailyRoutines)}`,
  );

  // Continuity check: Ask NIVA what it knows
  console.log('\nTesting Memory/Profile Grounding in Conversation...');
  const recallPrompt = 'What university am I studying at and what language do I specialize in?';
  console.log(`User says: "${recallPrompt}"`);
  const turn2Res = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: recallPrompt }),
  });
  const assistant2 = turn2Res.data?.assistantMessage?.content || '';
  console.log(`NIVA Reply:\n"""\n${assistant2}\n"""`);

  const recallsStanford = assistant2.toLowerCase().includes('stanford');
  const recallsGo = assistant2.toLowerCase().includes('go');
  record(
    '3.3',
    'Companion Recalls Profile without Asking (No Questionnaire)',
    recallsStanford && recallsGo,
    `Stanford mentioned: ${recallsStanford}, Go mentioned: ${recallsGo}`,
  );

  // -------------------------------------------------------------------------
  // STEP 4: Intelligent Deadline Parsing & 3-Tier Scheduling
  // -------------------------------------------------------------------------
  console.log('\n>>> [4/8] Testing Intelligent Deadline Extraction & 3-Tier Scheduling...');
  const deadlinePrompt = 'My Distributed Systems Raft assignment is due on November 15 at 11:59 PM.';
  console.log(`User says: "${deadlinePrompt}"`);
  const turn3Res = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: deadlinePrompt }),
  });

  const actions3 = turn3Res.data?.executedActions || [];
  console.log('Turn 3 Executed Actions:', JSON.stringify(actions3, null, 2));

  const commitmentCreated = actions3.some(
    (a) => a.actionType === 'commitment_created' || a.actionType === 'life_commitment_created' || a.actionType === 'deadline_scheduled'
  );
  record(
    '4.1',
    'Single Deadline Parsing & Commitment Creation',
    commitmentCreated,
    `Action detected: ${commitmentCreated ? actions3[0]?.actionType : 'None'}`,
  );

  // Query Database: check life_commitments and scheduled_jobs
  const dbCommitments = psql(`SELECT id, title, due_at, status FROM life_commitments WHERE user_id = '${userId}';`);
  console.log(`DB Commitments:\n${dbCommitments}`);

  const commitmentId = dbCommitments ? dbCommitments.split('|')[0] : null;

  const dbJobs = psql(`SELECT id, scheduled_at, status, payload->>'stage' FROM scheduled_jobs WHERE user_id = '${userId}' AND target_id = '${commitmentId}';`);
  console.log(`DB Scheduled Jobs for Commitment:\n${dbJobs}`);

  const jobRows = dbJobs ? dbJobs.trim().split('\n').filter(Boolean) : [];
  const has3Tiers = jobRows.length >= 2; // depending on time, advance/progress/final
  record(
    '4.2',
    'Multi-Tier Advance Reminder Jobs in scheduled_jobs Table',
    has3Tiers,
    `Found ${jobRows.length} scheduled jobs for commitment ${commitmentId}`,
  );

  // -------------------------------------------------------------------------
  // STEP 5: Ambiguous Deadline Handling (Clarification Question)
  // -------------------------------------------------------------------------
  console.log('\n>>> [5/8] Testing Ambiguous Deadline Handling (Clarification without Hallucination)...');
  const ambiguousPrompt = 'I have a research paper deadline coming up soon.';
  console.log(`User says: "${ambiguousPrompt}"`);
  const turn4Res = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: ambiguousPrompt }),
  });

  const actions4 = turn4Res.data?.executedActions || [];
  const assistant4 = turn4Res.data?.assistantMessage?.content || '';
  console.log('Turn 4 Executed Actions:', JSON.stringify(actions4, null, 2));
  console.log(`NIVA Reply:\n"""\n${assistant4}\n"""`);

  const askedClarification = actions4.some((a) => a.actionType === 'clarification_needed');
  record(
    '5.1',
    'Ambiguous Deadline Clarification Request (No Phantom Job)',
    askedClarification,
    `Clarification outcome: ${askedClarification}`,
  );

  // -------------------------------------------------------------------------
  // STEP 6: Conversation Continuity, Progress Updates & Rescheduling
  // -------------------------------------------------------------------------
  console.log('\n>>> [6/8] Testing Conversation Continuity & Progress Tracking...');
  // Progress update: User responds about assignment progress
  const progressPrompt = 'Almost done with the Raft assignment. Just need to finish conclusion and run unit tests.';
  console.log(`User says: "${progressPrompt}"`);
  const turn5Res = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: progressPrompt }),
  });

  const actions5 = turn5Res.data?.executedActions || [];
  console.log('Turn 5 Executed Actions:', JSON.stringify(actions5, null, 2));
  const progressUpdated = actions5.some((a) => a.actionType === 'task_progress_updated');
  record(
    '6.1',
    'Progress Update Linking to Active Commitment (No Duplicate Task Created)',
    progressUpdated,
    `Progress outcome: ${progressUpdated}`,
  );

  // Check commitment count in DB - must STILL be exactly 1 commitment, not duplicated!
  const commitmentCountStr = psql(`SELECT count(*) FROM life_commitments WHERE user_id = '${userId}';`);
  record(
    '6.2',
    'Duplicate Prevention on Progress Note',
    commitmentCountStr === '1',
    `Total commitments in DB: ${commitmentCountStr} (expected 1)`,
  );

  // Rescheduling / Postponing
  console.log('\nTesting Rescheduling / Postponing...');
  const postponePrompt = 'Please push my Raft assignment deadline to November 20 at 5:00 PM.';
  console.log(`User says: "${postponePrompt}"`);
  const turn6Res = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: postponePrompt }),
  });

  const actions6 = turn6Res.data?.executedActions || [];
  console.log('Turn 6 Executed Actions:', JSON.stringify(actions6, null, 2));
  const rescheduled = actions6.some((a) => a.actionType === 'commitment_rescheduled');
  record(
    '6.3',
    'Deadline Rescheduling (commitment_rescheduled)',
    rescheduled,
    `Rescheduled outcome: ${rescheduled}`,
  );

  // Verify new due date in DB
  const updatedDueStr = psql(`SELECT due_at FROM life_commitments WHERE id = '${commitmentId}';`);
  const isNov20 = updatedDueStr && updatedDueStr.includes('2026-11-20');
  record(
    '6.4',
    'Database Commitment Due Date Updated to November 20',
    Boolean(isNov20),
    `Updated due date in DB: ${updatedDueStr}`,
  );

  // Completion & Cancellation
  console.log('\nTesting Commitment Completion & Job Cancellation...');
  const completePrompt = 'I finished my Raft assignment!';
  console.log(`User says: "${completePrompt}"`);
  const turn7Res = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: completePrompt }),
  });

  const actions7 = turn7Res.data?.executedActions || [];
  console.log('Turn 7 Executed Actions:', JSON.stringify(actions7, null, 2));
  const fulfilled = actions7.some((a) => a.actionType === 'commitment_fulfilled');
  record(
    '6.5',
    'Commitment Fulfilled Action Detected',
    fulfilled,
    `Fulfilled outcome: ${fulfilled}`,
  );

  // Verify DB status is 'fulfilled'
  const finalStatus = psql(`SELECT status FROM life_commitments WHERE id = '${commitmentId}';`);
  record(
    '6.6',
    'Commitment Status Marked Fulfilled in DB',
    finalStatus === 'fulfilled',
    `Status: ${finalStatus}`,
  );

  // Verify all pending jobs were cancelled
  const cancelledJobsStr = psql(`SELECT count(*) FROM scheduled_jobs WHERE target_id = '${commitmentId}' AND status = 'cancelled';`);
  const remainingPending = psql(`SELECT count(*) FROM scheduled_jobs WHERE target_id = '${commitmentId}' AND status = 'pending';`);
  record(
    '6.7',
    'Automatic Cancellation of Linked Scheduled Jobs',
    parseInt(cancelledJobsStr || '0') > 0 && remainingPending === '0',
    `Cancelled jobs: ${cancelledJobsStr}, Remaining pending: ${remainingPending}`,
  );

  // -------------------------------------------------------------------------
  // STEP 7: Real Background Poller Execution & Notification Delivery
  // -------------------------------------------------------------------------
  console.log('\n>>> [7/8] Testing Background Job Execution & Real Notification Delivery...');

  // Direct insert of an immediately due job in PostgreSQL
  const immediateJobKey = `test:immediate:${Date.now()}`;
  psql(`
    INSERT INTO scheduled_jobs (
      user_id, job_type, target_type, target_id, scheduled_at, status,
      idempotency_key, payload, retry_count, max_retries, created_at, updated_at
    ) VALUES (
      '${userId}',
      'REMINDER',
      'custom',
      'active_milestone_reminder',
      NOW() - INTERVAL '10 seconds',
      'pending',
      '${immediateJobKey}',
      '{"title": "Operating Systems Final Submission", "message": "Reminder: Your Operating Systems Milestone is due soon. Make sure all test cases pass!", "stage": "advance", "channel": "in_app"}'::jsonb,
      0,
      3,
      NOW(),
      NOW()
    );
  `);
  console.log(`Inserted immediate test job with key: ${immediateJobKey}`);

  // Wait 7 seconds for the 5-second polling interval of JobSchedulerService to execute it
  console.log('Waiting 7 seconds for background scheduler poller...');
  await new Promise((r) => setTimeout(r, 7000));

  // Verify job transitioned to 'completed'
  const jobStatusAfter = psql(`SELECT status, retry_count FROM scheduled_jobs WHERE idempotency_key = '${immediateJobKey}';`);
  console.log(`Job status after poller run: ${jobStatusAfter}`);
  record(
    '7.1',
    'Background Scheduler Atomically Claims and Executes Job (status=completed)',
    Boolean(jobStatusAfter && jobStatusAfter.startsWith('completed')),
    `Job Status: ${jobStatusAfter}`,
  );

  // Verify durable notification record in notifications table
  const notifRows = psql(`SELECT id, title, channel, delivery_status, read FROM notifications WHERE user_id = '${userId}';`);
  console.log(`Notifications in DB:\n${notifRows}`);
  record(
    '7.2',
    'Notification Delivered and Persisted in notifications Table',
    Boolean(notifRows && notifRows.includes('Operating Systems')),
    `Notif DB row: ${notifRows}`,
  );

  // Test Notification APIs
  console.log('\nTesting Notification Endpoints...');
  const notifsListRes = await api('/notifications', { headers: authHeaders });
  const unreadCountRes = await api('/notifications/unread-count', { headers: authHeaders });
  const unreadCount = unreadCountRes.data?.unreadCount ?? 0;
  const notifItems = notifsListRes.data?.items || [];
  record(
    '7.3',
    'Notification Query APIs (GET /notifications, GET /unread-count)',
    notifsListRes.status === 200 && unreadCount > 0 && notifItems.length > 0,
    `Total fetched: ${notifItems.length}, Unread count: ${unreadCount}`,
  );

  // Mark single notification read
  const notifId = notifItems[0]?.id;
  if (notifId) {
    const markReadRes = await api(`/notifications/${notifId}/read`, {
      method: 'POST',
      headers: authHeaders,
    });
    record(
      '7.4',
      'Mark Single Notification Read (POST /notifications/:id/read)',
      markReadRes.status === 200 && markReadRes.data?.read === true,
      `Mark read status: ${markReadRes.status}`,
    );
  }

  // Mark all read
  const markAllRes = await api('/notifications/read-all', {
    method: 'POST',
    headers: authHeaders,
  });
  const unreadCountAfter = await api('/notifications/unread-count', { headers: authHeaders });
  record(
    '7.5',
    'Mark All Notifications Read (POST /notifications/read-all)',
    markAllRes.status === 200 && unreadCountAfter.data?.unreadCount === 0,
    `Unread count after read-all: ${unreadCountAfter.data?.unreadCount}`,
  );

  // -------------------------------------------------------------------------
  // STEP 8: Browser Push Subscription & Crash Recovery
  // -------------------------------------------------------------------------
  console.log('\n>>> [8/8] Testing Browser Push & Crash Recovery...');
  const vapidKeyRes = await api('/notifications/browser/public-key', { headers: authHeaders });
  record(
    '8.1',
    'VAPID Public Key Retrieval (GET /browser/public-key)',
    vapidKeyRes.status === 200 && typeof vapidKeyRes.data?.publicKey === 'string',
    `Public Key length: ${vapidKeyRes.data?.publicKey?.length}`,
  );

  // Register mock browser subscription
  const subRes = await api('/notifications/browser/subscribe', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      endpoint: `https://fcm.googleapis.com/fcm/send/test_sub_${Date.now()}`,
      p256dhKey: 'mock-p256dh-key-for-test',
      authKey: 'mock-auth-secret',
      browser: 'Mozilla/5.0 HeadlessChrome Verification',
    }),
  });
  record(
    '8.2',
    'Browser Push Subscription Registration (POST /browser/subscribe)',
    subRes.status === 200 && Boolean(subRes.data?.subscriptionId),
    `Subscription ID: ${subRes.data?.subscriptionId}`,
  );

  // Test Crash Recovery: Insert a stuck 'processing' job with older timestamp
  const stuckJobKey = `test:stuck:${Date.now()}`;
  psql(`
    INSERT INTO scheduled_jobs (
      user_id, job_type, target_type, target_id, scheduled_at, status,
      idempotency_key, payload, retry_count, max_retries, created_at, updated_at
    ) VALUES (
      '${userId}',
      'REMINDER',
      'custom',
      'recovery-test',
      NOW() - INTERVAL '15 minutes',
      'processing',
      '${stuckJobKey}',
      '{"title": "Stuck Job Crash Recovery Test", "message": "This job was interrupted by a hypothetical server crash", "stage": "custom", "channel": "in_app"}'::jsonb,
      1,
      3,
      NOW() - INTERVAL '15 minutes',
      NOW() - INTERVAL '12 minutes'
    );
  `);
  console.log(`Inserted stuck job ${stuckJobKey} with status=processing and updated_at=12m ago.`);

  // Wait 22 seconds for poller recovery cycle (every 4 ticks / 20 seconds)
  console.log('Waiting 22 seconds for scheduler recovery cycle...');
  await new Promise((r) => setTimeout(r, 22000));

  const stuckJobAfter = psql(`SELECT status, retry_count FROM scheduled_jobs WHERE idempotency_key = '${stuckJobKey}';`);
  console.log(`Stuck job status after recovery cycle: ${stuckJobAfter}`);
  const isRecovered = Boolean(
    stuckJobAfter &&
    (stuckJobAfter.startsWith('completed') || stuckJobAfter.startsWith('pending'))
  );
  record(
    '8.3',
    'Crash Recovery Logic: Interrupted Processing Jobs Recovered',
    isRecovered,
    `Stuck job recovered to: ${stuckJobAfter}`,
  );

  // -------------------------------------------------------------------------
  // FINAL SCORECARD
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('                 VERIFICATION SUMMARY SCORECARD                         ');
  console.log('========================================================================');
  const total = testReport.length;
  const passed = testReport.filter((t) => t.passed).length;
  const failed = total - passed;

  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  testReport.forEach((t) => {
    console.log(`${t.passed ? '  ✓' : '  ✗'} [${t.id}] ${t.title}`);
  });

  if (failed > 0) {
    console.error('\n⚠️ Some verification checks failed! Please review above.');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL VERIFICATION CHECKS PASSED WITH 100% ACCURACY!');
  }
}

run().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
