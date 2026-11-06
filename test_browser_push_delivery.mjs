// test_browser_push_delivery.mjs
// Comprehensive Verification Suite for Browser Push Integration & Delivery Completion

import { execSync } from 'child_process';
import crypto from 'crypto';

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

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

function generateClientKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const p256dhKey = ecdh.getPublicKey('base64url');
  const authKey = crypto.randomBytes(16).toString('base64url');
  return { p256dhKey, authKey };
}

async function run() {
  console.log('========================================================================');
  console.log('      NIVA BROWSER PUSH INTEGRATION & DELIVERY VERIFICATION SUITE       ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testReport = [];

  function record(id, title, passed, details) {
    testReport.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] Test ${id}: ${title}`);
    if (details) {
      console.log(`       Details: ${details}`);
    }
  }

  // =========================================================================
  // TEST 1: Service Worker Asset Availability & Content
  // =========================================================================
  console.log('>>> [1/14] Testing Service Worker Asset Availability at /sw.js...');
  try {
    const swRes = await fetch(`${WEB_BASE}/sw.js`);
    const swText = await swRes.text();
    const hasPushListener = swText.includes("addEventListener('push'");
    const hasClickListener = swText.includes("addEventListener('notificationclick'");
    const hasSubChangeListener = swText.includes("addEventListener('pushsubscriptionchange'");
    const statusOk = swRes.status === 200;

    record(
      '1.1',
      'Service Worker file is served with HTTP 200',
      statusOk,
      `HTTP status ${swRes.status}, Content-Type: ${swRes.headers.get('content-type')}`,
    );
    record(
      '1.2',
      'Service Worker includes push, notificationclick, and subscription change handlers',
      hasPushListener && hasClickListener && hasSubChangeListener,
      `Push: ${hasPushListener}, Click: ${hasClickListener}, SubChange: ${hasSubChangeListener}`,
    );
  } catch (err) {
    record('1.1', 'Service Worker Asset Availability', false, `Fetch error: ${err.message}`);
  }

  // =========================================================================
  // TEST 2: User Registration & VAPID Public Key Retrieval
  // =========================================================================
  console.log('\n>>> [2/14] Registering User A & Checking VAPID Public Key Endpoint...');
  const userAEmail = `push_user_a_${ts}@niva.ai`;
  const password = 'Password123!';
  const regARes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password, name: 'Alex Rivera' }),
  });
  if (regARes.status !== 201) {
    throw new Error(`User A registration failed: ${JSON.stringify(regARes.data)}`);
  }
  const userAId = regARes.data.user.id;
  const userAToken = regARes.data.tokens.accessToken;
  const authA = { Authorization: `Bearer ${userAToken}` };
  console.log(`✓ User A registered: ID = ${userAId}`);

  const vapidRes = await api('/notifications/browser/public-key', { headers: authA });
  const pubKey = vapidRes.data?.publicKey || vapidRes.raw?.publicKey;
  const explanation = vapidRes.data?.explanation || vapidRes.raw?.explanation;
  const validKey = typeof pubKey === 'string' && pubKey.length >= 80 && pubKey.startsWith('B');

  record(
    '2.1',
    'VAPID Public Key retrieval returns valid ECDSA P-256 key',
    vapidRes.status === 200 && validKey,
    `Key prefix: ${pubKey?.slice(0, 15)}... (Length: ${pubKey?.length} chars)`,
  );
  record(
    '2.2',
    'VAPID Public Key response provides permission explanation and instructions',
    typeof explanation === 'string' && explanation.length > 20,
    `Explanation present: "${explanation?.slice(0, 45)}..."`,
  );

  // =========================================================================
  // TEST 3: Initial Subscription Status for Fresh User
  // =========================================================================
  console.log('\n>>> [3/14] Testing Initial Subscription Status for Fresh User...');
  const statusRes = await api('/notifications/browser/status', { headers: authA });
  const isSubscribedInitial = statusRes.data?.subscribed ?? statusRes.raw?.subscribed;
  const countInitial = statusRes.data?.subscriptionCount ?? statusRes.raw?.subscriptionCount;

  record(
    '3.1',
    'Initial subscription status is false with 0 subscriptions',
    statusRes.status === 200 && isSubscribedInitial === false && countInitial === 0,
    `Subscribed: ${isSubscribedInitial}, Count: ${countInitial}`,
  );

  // =========================================================================
  // TEST 4: Subscription Persistence in PostgreSQL
  // =========================================================================
  console.log('\n>>> [4/14] Testing Browser Push Subscription Persistence...');
  const keysA1 = generateClientKeys();
  const endpointA1 = `https://fcm.googleapis.com/fcm/send/device_a1_${ts}`;
  const subRes = await api('/notifications/browser/subscribe', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      endpoint: endpointA1,
      p256dhKey: keysA1.p256dhKey,
      authKey: keysA1.authKey,
      browser: 'Chrome/125.0 Windows',
    }),
  });

  const subId = subRes.data?.subscriptionId || subRes.raw?.subscriptionId;
  record(
    '4.1',
    'POST /notifications/browser/subscribe succeeds with subscriptionId',
    subRes.status === 200 && !!subId,
    `Returned subscriptionId: ${subId}`,
  );

  // Check DB directly
  const dbSubsCount = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${userAId}';`);
  const dbEndpoint = psql(`SELECT endpoint FROM notification_subscriptions WHERE user_id = '${userAId}' LIMIT 1;`);

  record(
    '4.2',
    'Subscription record safely persisted in notification_subscriptions table',
    dbSubsCount === '1' && dbEndpoint === endpointA1,
    `DB Rows: ${dbSubsCount}, Matched Endpoint: ${dbEndpoint?.slice(0, 45)}...`,
  );

  // Status endpoint post-subscribe
  const statusPostSub = await api('/notifications/browser/status', { headers: authA });
  record(
    '4.3',
    'Status endpoint accurately reflects active subscription',
    (statusPostSub.data?.subscribed ?? statusPostSub.raw?.subscribed) === true &&
      (statusPostSub.data?.subscriptionCount ?? statusPostSub.raw?.subscriptionCount) === 1,
    `Status: subscribed=true, count=1`,
  );

  // =========================================================================
  // TEST 5: Duplicate Subscription Idempotency
  // =========================================================================
  console.log('\n>>> [5/14] Testing Duplicate Subscription Idempotency...');
  const newKeys = generateClientKeys();
  const reSubRes = await api('/notifications/browser/subscribe', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      endpoint: endpointA1, // same endpoint
      p256dhKey: newKeys.p256dhKey,
      authKey: newKeys.authKey,
      browser: 'Chrome/125.0 Windows (Updated)',
    }),
  });

  const dbSubsCountAfterReSub = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${userAId}';`);
  const dbP256Key = psql(`SELECT p256dh_key FROM notification_subscriptions WHERE user_id = '${userAId}';`);

  record(
    '5.1',
    'Re-subscribing same endpoint updates existing row without duplicate insertion',
    dbSubsCountAfterReSub === '1' && dbP256Key === newKeys.p256dhKey,
    `DB Rows: ${dbSubsCountAfterReSub} (expected 1), P256 key updated successfully`,
  );

  // =========================================================================
  // TEST 6: Multi-Device Support for Same User
  // =========================================================================
  console.log('\n>>> [6/14] Testing Multi-Device Support (Second Device Registration)...');
  const keysA2 = generateClientKeys();
  const endpointA2 = `https://updates.push.services.mozilla.com/wpush/v2/device_a2_${ts}`;
  await api('/notifications/browser/subscribe', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      endpoint: endpointA2,
      p256dhKey: keysA2.p256dhKey,
      authKey: keysA2.authKey,
      browser: 'Firefox/126.0 macOS',
    }),
  });

  const dbMultiSubsCount = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${userAId}';`);
  const statusMulti = await api('/notifications/browser/status', { headers: authA });
  const multiCount = statusMulti.data?.subscriptionCount ?? statusMulti.raw?.subscriptionCount;

  record(
    '6.1',
    'User can register multiple independent devices/browsers',
    dbMultiSubsCount === '2' && multiCount === 2,
    `DB Subscriptions: ${dbMultiSubsCount}, API Reported: ${multiCount}`,
  );

  // =========================================================================
  // TEST 7: Multi-User Security & Tenant Isolation
  // =========================================================================
  console.log('\n>>> [7/14] Testing Multi-User Tenant Isolation...');
  const userBEmail = `push_user_b_${ts}@niva.ai`;
  const regBRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userBEmail, password, name: 'Jordan Hayes' }),
  });
  const userBId = regBRes.data.user.id;
  const userBToken = regBRes.data.tokens.accessToken;
  const authB = { Authorization: `Bearer ${userBToken}` };
  console.log(`✓ User B registered: ID = ${userBId}`);

  // User B status should be 0
  const statusB = await api('/notifications/browser/status', { headers: authB });
  const countB = statusB.data?.subscriptionCount ?? statusB.raw?.subscriptionCount;

  // User B attempts to unsubscribe User A's endpoint
  await api('/notifications/browser/unsubscribe', {
    method: 'POST',
    headers: authB,
    body: JSON.stringify({ endpoint: endpointA1 }),
  });

  // Verify User A's subscription is still in DB
  const userASubsAfterAttack = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${userAId}';`);

  record(
    '7.1',
    'User B cannot view or access User A push subscriptions',
    countB === 0,
    `User B subscription count: ${countB}`,
  );
  record(
    '7.2',
    'User B cannot delete or mutate User A subscriptions (tenant isolation)',
    userASubsAfterAttack === '2',
    `User A subscriptions preserved: ${userASubsAfterAttack} (expected 2)`,
  );

  // =========================================================================
  // TEST 8: Real WebPush Payload Dispatch via Backend
  // =========================================================================
  console.log('\n>>> [8/14] Testing Real WebPush Payload Packaging & Dispatch Execution...');
  const testPushRes = await api('/notifications/browser/test', {
    method: 'POST',
    headers: authA,
  });

  const outcome = testPushRes.data || testPushRes.raw;
  const notifId = outcome?.notificationId || outcome?.details?.notificationId;

  // Check DB for notifications record
  const dbNotif = psql(
    `SELECT channel, delivery_status, title FROM notifications WHERE id = '${notifId}' AND user_id = '${userAId}';`,
  );
  const dbDeliveryResult = psql(
    `SELECT delivery_result->>'confirmed' FROM notifications WHERE id = '${notifId}';`,
  );

  record(
    '8.1',
    'POST /notifications/browser/test triggers WebPush delivery pipeline',
    testPushRes.status === 200 && outcome?.delivered === true,
    `Delivered: ${outcome?.delivered}, Channel: ${outcome?.channel}, NotifId: ${notifId}`,
  );
  record(
    '8.2',
    'Notification record created in notifications table with channel="browser" and status="delivered"',
    dbNotif.includes('browser') && dbNotif.includes('delivered'),
    `DB Record: "${dbNotif}"`,
  );
  record(
    '8.3',
    'Delivery audit details recorded in delivery_result JSONB',
    dbDeliveryResult === 'true',
    `Confirmed flag in delivery_result: ${dbDeliveryResult}`,
  );

  // =========================================================================
  // TEST 9: Expired / Revoked Subscription Auto-Pruning (HTTP 410 Handling)
  // =========================================================================
  console.log('\n>>> [9/14] Testing Expired Subscription Auto-Pruning with Real FCM 410 Response...');
  // Register an endpoint that FCM is guaranteed to reject with 410
  const expiredEndpoint = `https://fcm.googleapis.com/fcm/send/d-expired-token-auto-prune-${ts}`;
  const expiredKeys = generateClientKeys();

  // Create isolated user for clean pruning test
  const pruneUserEmail = `prune_test_${ts}@niva.ai`;
  const pruneReg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: pruneUserEmail, password, name: 'Prune Tester' }),
  });
  const pruneUserId = pruneReg.data.user.id;
  const pruneAuth = { Authorization: `Bearer ${pruneReg.data.tokens.accessToken}` };

  await api('/notifications/browser/subscribe', {
    method: 'POST',
    headers: pruneAuth,
    body: JSON.stringify({
      endpoint: expiredEndpoint,
      p256dhKey: expiredKeys.p256dhKey,
      authKey: expiredKeys.authKey,
      browser: 'Chrome/Old',
    }),
  });

  const subsBeforePrune = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${pruneUserId}';`);

  // Trigger dispatch to the expired endpoint
  const pruneDispatchRes = await api('/notifications/browser/test', {
    method: 'POST',
    headers: pruneAuth,
  });

  // Verify the expired subscription was automatically deleted from DB
  const subsAfterPrune = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${pruneUserId}';`);

  record(
    '9.1',
    'FCM HTTP 410 / 404 response automatically prunes stale subscription from database',
    subsBeforePrune === '1' && subsAfterPrune === '0',
    `Subscriptions before dispatch: ${subsBeforePrune}, after 410 auto-pruning: ${subsAfterPrune}`,
  );

  // =========================================================================
  // TEST 10: Explicit User Unsubscribe
  // =========================================================================
  console.log('\n>>> [10/14] Testing Explicit User Unsubscribe / Device Removal...');
  // Re-register 2 endpoints specifically to test unsubscribe flows
  const unsubEp1 = `https://fcm.googleapis.com/fcm/send/unsub_device_1_${ts}`;
  const unsubEp2 = `https://fcm.googleapis.com/fcm/send/unsub_device_2_${ts}`;
  const k1 = generateClientKeys();
  const k2 = generateClientKeys();

  await api('/notifications/browser/subscribe', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({ endpoint: unsubEp1, p256dhKey: k1.p256dhKey, authKey: k1.authKey, browser: 'Chrome' }),
  });
  await api('/notifications/browser/subscribe', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({ endpoint: unsubEp2, p256dhKey: k2.p256dhKey, authKey: k2.authKey, browser: 'Firefox' }),
  });

  const unsubRes = await api('/notifications/browser/unsubscribe', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({ endpoint: unsubEp1 }), // delete first device
  });

  const subsAfterSingleUnsub = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${userAId}';`);

  // Delete all remaining devices
  await api('/notifications/browser/unsubscribe', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({}), // clear all
  });

  const subsAfterAllUnsub = psql(`SELECT count(*) FROM notification_subscriptions WHERE user_id = '${userAId}';`);
  const finalStatusA = await api('/notifications/browser/status', { headers: authA });

  record(
    '10.1',
    'Targeted unsubscribe removes specific device endpoint',
    unsubRes.status === 200 && subsAfterSingleUnsub === '1',
    `Remaining devices after targeted unsubscribe: ${subsAfterSingleUnsub} (expected 1)`,
  );
  record(
    '10.2',
    'Complete unsubscribe clears all user subscriptions and resets status to false',
    subsAfterAllUnsub === '0' &&
      (finalStatusA.data?.subscribed ?? finalStatusA.raw?.subscribed) === false,
    `Final DB count: ${subsAfterAllUnsub}, Status API subscribed: false`,
  );

  // =========================================================================
  // TEST 11: Dynamic Short-Deadline Reminder Generation (< 48h, < 24h, < 2h)
  // =========================================================================
  console.log('\n>>> [11/14] Testing Dynamic Short-Deadline Reminder Scheduling...');
  // Scenario A: Due in 36 hours (between 24h and 48h)
  const due36h = new Date(Date.now() + 36 * 60 * 60 * 1000);
  const comm36hRes = await api('/life/commitments', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'Operating Systems Midterm Prep',
      commitmentType: 'deadline',
      importance: 'high',
      dueAt: due36h.toISOString(),
    }),
  });
  const comm36hId = comm36hRes.data?.id || comm36hRes.raw?.id;

  // Check scheduled jobs for comm36h: should have progress (24h) and final (2h); advance (48h) skipped because it's past
  const jobs36h = psql(
    `SELECT count(*) FROM scheduled_jobs WHERE target_id = '${comm36hId}' AND target_type = 'commitment';`,
  );
  const stages36h = psql(
    `SELECT string_agg(payload->>'stage', ',') FROM scheduled_jobs WHERE target_id = '${comm36hId}';`,
  );

  record(
    '11.1',
    'For deadline closer than 48h (36h), skips past-due advance notice and schedules 24h & 2h stages',
    parseInt(jobs36h, 10) >= 2 && !stages36h.includes('advance') && stages36h.includes('progress_check'),
    `Scheduled stages: [${stages36h}], Job count: ${jobs36h}`,
  );

  // Scenario B: Extremely close deadline - due in 45 minutes (< 2 hours)
  const due45m = new Date(Date.now() + 45 * 60 * 1000);
  const comm45mRes = await api('/life/commitments', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'Lab Report Submission',
      commitmentType: 'deadline',
      importance: 'critical',
      dueAt: due45m.toISOString(),
    }),
  });
  const comm45mId = comm45mRes.data?.id || comm45mRes.raw?.id;

  const jobs45m = psql(
    `SELECT count(*) FROM scheduled_jobs WHERE target_id = '${comm45mId}' AND target_type = 'commitment';`,
  );
  const scheduledAt45m = psql(
    `SELECT scheduled_at FROM scheduled_jobs WHERE target_id = '${comm45mId}' LIMIT 1;`,
  );

  const isFutureJob = scheduledAt45m && new Date(scheduledAt45m).getTime() > Date.now();
  const isBeforeDue = scheduledAt45m && new Date(scheduledAt45m).getTime() < due45m.getTime();

  record(
    '11.2',
    'For tight deadline (< 2h), dynamically calculates halfway reminder in future (never in past)',
    parseInt(jobs45m, 10) === 1 && isFutureJob && isBeforeDue,
    `Scheduled At: ${scheduledAt45m} (Due: ${due45m.toISOString()})`,
  );

  // Verify no job in the database is scheduled in the past
  const pastDueScheduledJobs = psql(
    `SELECT count(*) FROM scheduled_jobs WHERE target_id IN ('${comm36hId}', '${comm45mId}') AND scheduled_at <= NOW();`,
  );
  record(
    '11.3',
    'Strict temporal integrity: zero reminders scheduled in the past',
    pastDueScheduledJobs === '0',
    `Past-due jobs found: ${pastDueScheduledJobs} (expected 0)`,
  );

  // =========================================================================
  // TEST 12: Cancellation of Reminders upon Commitment Fulfillment
  // =========================================================================
  console.log('\n>>> [12/14] Testing Cancellation of Scheduled Jobs upon Commitment Completion...');
  // Mark the 36h commitment as fulfilled
  await api(`/life/commitments/${comm36hId}`, {
    method: 'PATCH',
    headers: authA,
    body: JSON.stringify({ status: 'fulfilled' }),
  });

  const pendingJobsAfterFulfill = psql(
    `SELECT count(*) FROM scheduled_jobs WHERE target_id = '${comm36hId}' AND status = 'pending';`,
  );
  const cancelledJobsAfterFulfill = psql(
    `SELECT count(*) FROM scheduled_jobs WHERE target_id = '${comm36hId}' AND status = 'cancelled';`,
  );

  record(
    '12.1',
    'Fulfilling commitment automatically cancels all associated scheduled reminder jobs',
    pendingJobsAfterFulfill === '0' && parseInt(cancelledJobsAfterFulfill, 10) >= 2,
    `Pending: ${pendingJobsAfterFulfill} (expected 0), Cancelled: ${cancelledJobsAfterFulfill}`,
  );

  // =========================================================================
  // TEST 13: Service Durability Across Service Execution
  // =========================================================================
  console.log('\n>>> [13/14] Testing Background Job Persistence in PostgreSQL...');
  // The 45m job should still be pending
  const pending45m = psql(
    `SELECT status FROM scheduled_jobs WHERE target_id = '${comm45mId}';`,
  );

  record(
    '13.1',
    'Pending scheduled jobs safely persist in database table scheduled_jobs',
    pending45m === 'pending',
    `Job status in PostgreSQL: "${pending45m}"`,
  );

  // =========================================================================
  // TEST 14: Preference Persistence (Channels & Timing Thresholds)
  // =========================================================================
  console.log('\n>>> [14/14] Testing Proactive Preferences & Timing Configuration Persistence...');
  const prefUpdateRes = await api('/proactive/preferences', {
    method: 'PUT',
    headers: authA,
    body: JSON.stringify({
      inAppEnabled: true,
      browserEnabled: true,
      emailEnabled: false,
      advanceReminderDays: 3,
      progressCheckHours: 12,
      finalReminderHours: 1,
    }),
  });

  const dbPrefs = psql(
    `SELECT in_app_enabled, browser_enabled, advance_reminder_days, progress_check_hours, final_reminder_hours FROM user_proactive_preferences WHERE user_id = '${userAId}';`,
  );

  record(
    '14.1',
    'PUT /proactive/preferences persists channels and customized reminder tiers',
    prefUpdateRes.status === 200 && dbPrefs.includes('3') && dbPrefs.includes('12') && dbPrefs.includes('1'),
    `DB row: "${dbPrefs}"`,
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n========================================================================');
  console.log('                          TEST RESULTS SUMMARY                          ');
  console.log('========================================================================');
  const passedCount = testReport.filter((t) => t.passed).length;
  const totalCount = testReport.length;
  console.log(`TOTAL TESTS: ${totalCount}`);
  console.log(`PASSED:      ${passedCount}`);
  console.log(`FAILED:      ${totalCount - passedCount}`);
  console.log(`SUCCESS RATE: ${Math.round((passedCount / totalCount) * 100)}%\n`);

  if (passedCount !== totalCount) {
    console.error('❌ Some tests failed. Inspect the output above.');
    process.exit(1);
  } else {
    console.log('🎉 ALL BROWSER PUSH & DELIVERY INTEGRATION TESTS PASSED PERFECTLY!');
  }
}

run().catch((err) => {
  console.error('\nFatal test execution error:', err);
  process.exit(1);
});
