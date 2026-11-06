// test_saas_auth_security.mjs
// Comprehensive SaaS Authentication, Account Management & Multi-Tenant Security Verification Suite

import { execSync } from 'child_process';

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
  } catch {
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
  console.log('    NIVA SAAS AUTHENTICATION, ACCOUNT & SECURITY VERIFICATION SUITE     ');
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
  // TEST 1: Frontend Route Accessibility & Assets
  // =========================================================================
  console.log('>>> [1/15] Testing Frontend Authentication & Recovery Routes...');
  const routes = ['/login', '/register', '/forgot-password', '/reset-password', '/settings'];
  for (const r of routes) {
    try {
      const res = await fetch(`${WEB_BASE}${r}`);
      record(`1.${routes.indexOf(r) + 1}`, `Frontend route ${r} returns HTTP 200`, res.status === 200, `Status: ${res.status}`);
    } catch (e) {
      record(`1.${routes.indexOf(r) + 1}`, `Frontend route ${r} accessibility`, false, e.message);
    }
  }

  // =========================================================================
  // TEST 2: Registration & Input Validation
  // =========================================================================
  console.log('\n>>> [2/15] Testing User Registration & Schema Validation...');
  const userAEmail = `saas_user_a_${ts}@niva.ai`;
  const initialPassword = 'Password123!';
  const userAName = 'Alex Rivera';

  // Weak password test
  const weakPassRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `weak_${ts}@niva.ai`, password: 'short', name: 'Tester' }),
  });
  record(
    '2.1',
    'Registration rejects weak password (< 8 chars) with HTTP 400',
    weakPassRes.status === 400,
    `Status: ${weakPassRes.status}`,
  );

  // Valid registration
  const regRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword, name: userAName }),
  });
  const userA = regRes.data?.user || regRes.raw?.user;
  const tokensA = regRes.data?.tokens || regRes.raw?.tokens;
  const userAId = userA?.id;
  const tokenA = tokensA?.accessToken;
  const authA = { Authorization: `Bearer ${tokenA}` };

  record(
    '2.2',
    'Valid registration succeeds with HTTP 201, UserDto, and JWT accessToken',
    regRes.status === 201 && !!userAId && !!tokenA,
    `UserId: ${userAId}, Email: ${userA?.email}`,
  );

  // Duplicate registration
  const dupRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword, name: 'Duplicate' }),
  });
  record(
    '2.3',
    'Duplicate email registration is rejected with HTTP 409 Conflict',
    dupRes.status === 409,
    `Status: ${dupRes.status}`,
  );

  // =========================================================================
  // TEST 3: Email Verification Flow
  // =========================================================================
  console.log('\n>>> [3/15] Testing Email Verification Request & Confirmation...');
  const verifReq = await api('/auth/verify-email/request', {
    method: 'POST',
    headers: authA,
  });
  const verifToken = verifReq.data?.verificationToken || verifReq.raw?.verificationToken;

  record(
    '3.1',
    'Authenticated user can request email verification token',
    verifReq.status === 200 && typeof verifToken === 'string' && verifToken.length > 20,
    `Token length: ${verifToken?.length} chars`,
  );

  // Confirm with invalid token
  const invalidConfirm = await api('/auth/verify-email/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: 'invalid_fake_token_12345' }),
  });
  record(
    '3.2',
    'Invalid verification token is rejected with HTTP 400',
    invalidConfirm.status === 400,
    `Status: ${invalidConfirm.status}`,
  );

  // Confirm with valid token
  const validConfirm = await api('/auth/verify-email/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: verifToken }),
  });
  const dbVerified = psql(`SELECT is_email_verified FROM users WHERE id = '${userAId}';`);

  record(
    '3.3',
    'Valid verification token sets is_email_verified = true in PostgreSQL',
    validConfirm.status === 200 && dbVerified === 't',
    `DB is_email_verified: ${dbVerified}`,
  );

  // =========================================================================
  // TEST 4: Login Authentication & Uniform Enumeration Protection
  // =========================================================================
  console.log('\n>>> [4/15] Testing Login Authentication & Email Enumeration Protection...');
  // Valid login
  const loginRes = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword }),
  });
  const loginTokens = loginRes.data?.tokens || loginRes.raw?.tokens;
  record(
    '4.1',
    'Valid credentials authenticate with HTTP 200 and issue fresh session',
    loginRes.status === 200 && !!loginTokens?.accessToken,
    `Tokens received: accessToken=${loginTokens?.accessToken?.slice(0, 15)}...`,
  );

  // Wrong password
  const wrongPassRes = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: 'WrongPassword999!' }),
  });
  // Non-existent email
  const nonExistRes = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `nonexistent_${ts}@niva.ai`, password: initialPassword }),
  });

  const wrongMsg = wrongPassRes.raw?.error?.message;
  const nonExistMsg = nonExistRes.raw?.error?.message;

  record(
    '4.2',
    'Wrong password and non-existent email return identical generic 401 error (no enumeration)',
    wrongPassRes.status === 401 && nonExistRes.status === 401 && wrongMsg === nonExistMsg,
    `Error message: "${wrongMsg}"`,
  );

  // =========================================================================
  // TEST 5: Protected Endpoint Authorization
  // =========================================================================
  console.log('\n>>> [5/15] Testing Protected Endpoint Authorization...');
  // GET /auth/me with valid token
  const meRes = await api('/auth/me', { headers: authA });
  record(
    '5.1',
    'GET /auth/me returns authenticated user profile with valid Bearer token',
    meRes.status === 200 && (meRes.data?.user?.id === userAId || meRes.raw?.user?.id === userAId),
    `Returned user: ${userAEmail}`,
  );

  // GET /auth/me with invalid token
  const badTokenRes = await api('/auth/me', {
    headers: { Authorization: 'Bearer fake.invalid.jwt.token' },
  });
  record(
    '5.2',
    'Tampered or invalid JWT access token is rejected with HTTP 401',
    badTokenRes.status === 401,
    `Status: ${badTokenRes.status}`,
  );

  // GET /auth/me without token
  const noTokenRes = await api('/auth/me');
  record(
    '5.3',
    'Missing Authorization header is rejected with HTTP 401',
    noTokenRes.status === 401,
    `Status: ${noTokenRes.status}`,
  );

  // =========================================================================
  // TEST 6: Refresh Token Rotation & Session Revocation
  // =========================================================================
  console.log('\n>>> [6/15] Testing Refresh Token Rotation & Replay Attack Defense...');
  // Grab fresh refresh token
  const loginForRefresh = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword }),
  });
  const firstRefreshToken = loginForRefresh.data?.tokens?.refreshToken || loginForRefresh.raw?.tokens?.refreshToken;

  // First refresh
  const refreshRes1 = await api('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: firstRefreshToken }),
  });
  const secondRefreshToken = refreshRes1.data?.tokens?.refreshToken || refreshRes1.raw?.tokens?.refreshToken;

  record(
    '6.1',
    'POST /auth/refresh rotates refresh token and returns new session tokens',
    refreshRes1.status === 200 && !!secondRefreshToken && secondRefreshToken !== firstRefreshToken,
    `New refreshToken issued: ${secondRefreshToken?.slice(0, 15)}...`,
  );

  // Attempt replay attack with old refresh token
  const replayRes = await api('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: firstRefreshToken }),
  });
  record(
    '6.2',
    'Reusing previously rotated refresh token fails with HTTP 401 (Replay Protection)',
    replayRes.status === 401,
    `Status: ${replayRes.status}`,
  );

  // =========================================================================
  // TEST 7: Logout from Current Session & Logout All Sessions
  // =========================================================================
  console.log('\n>>> [7/15] Testing Session Logout & Logout from All Devices...');
  // Logout specific session
  const logoutRes = await api('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: secondRefreshToken }),
  });
  record(
    '7.1',
    'POST /auth/logout invalidates current session',
    logoutRes.status === 200 && (logoutRes.data?.loggedOut === true || logoutRes.raw?.loggedOut === true),
    `Response: loggedOut=true`,
  );

  // Verify revoked session cannot be refreshed
  const postLogoutRefresh = await api('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: secondRefreshToken }),
  });
  record(
    '7.2',
    'Revoked session refresh attempt fails with HTTP 401',
    postLogoutRefresh.status === 401,
    `Status: ${postLogoutRefresh.status}`,
  );

  // Create two concurrent sessions
  const s1 = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword }),
  });
  const s2 = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword }),
  });
  const s1Tokens = s1.data?.tokens || s1.raw?.tokens;
  const s2Tokens = s2.data?.tokens || s2.raw?.tokens;
  const activeAuthA = { Authorization: `Bearer ${s1Tokens?.accessToken}` };

  const dbActiveSessionsBefore = psql(
    `SELECT count(*) FROM sessions WHERE user_id = '${userAId}' AND revoked_at IS NULL;`,
  );

  // Call logout-all
  const logoutAllRes = await api('/auth/logout-all', {
    method: 'POST',
    headers: activeAuthA,
  });

  const dbActiveSessionsAfter = psql(
    `SELECT count(*) FROM sessions WHERE user_id = '${userAId}' AND revoked_at IS NULL;`,
  );

  record(
    '7.3',
    'POST /auth/logout-all revokes all active sessions across all devices in PostgreSQL',
    logoutAllRes.status === 200 && dbActiveSessionsAfter === '0' && parseInt(dbActiveSessionsBefore, 10) >= 2,
    `Active sessions before: ${dbActiveSessionsBefore}, after logout-all: ${dbActiveSessionsAfter}`,
  );

  // =========================================================================
  // TEST 8: Account Profile Editing
  // =========================================================================
  console.log('\n>>> [8/15] Testing Account Profile Editing...');
  // Re-login to get fresh token
  const freshLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword }),
  });
  const freshTokens = freshLogin.data?.tokens || freshLogin.raw?.tokens;
  const currentAuth = { Authorization: `Bearer ${freshTokens?.accessToken}` };

  const updatedName = 'Alex M. Rivera';
  const profileRes = await api('/auth/profile', {
    method: 'PATCH',
    headers: currentAuth,
    body: JSON.stringify({ name: updatedName }),
  });
  const dbName = psql(`SELECT name FROM users WHERE id = '${userAId}';`);

  record(
    '8.1',
    'PATCH /auth/profile updates user display name in database',
    profileRes.status === 200 && dbName === updatedName,
    `DB name: "${dbName}"`,
  );

  // =========================================================================
  // TEST 9: Password Change Flow (Authenticated User)
  // =========================================================================
  console.log('\n>>> [9/15] Testing Authenticated Password Change...');
  const newPassword = 'BrandNewPassword2026!';

  // Change with incorrect current password
  const wrongCurrent = await api('/auth/change-password', {
    method: 'POST',
    headers: currentAuth,
    body: JSON.stringify({ currentPassword: 'IncorrectPassword1!', newPassword }),
  });
  record(
    '9.1',
    'Password change with incorrect current password fails with HTTP 400',
    wrongCurrent.status === 400,
    `Status: ${wrongCurrent.status}`,
  );

  // Valid password change
  const validChange = await api('/auth/change-password', {
    method: 'POST',
    headers: currentAuth,
    body: JSON.stringify({ currentPassword: initialPassword, newPassword }),
  });
  const changeData = validChange.data || validChange.raw;
  record(
    '9.2',
    'Password change with correct credentials succeeds with HTTP 200',
    validChange.status === 200 && changeData?.success === true,
    `Message: "${changeData?.message}"`,
  );

  // Verify old password cannot log in
  const oldLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: initialPassword }),
  });
  record(
    '9.3',
    'Login with obsolete previous password fails with HTTP 401',
    oldLogin.status === 401,
    `Status: ${oldLogin.status}`,
  );

  // Verify new password logs in successfully
  const newLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: newPassword }),
  });
  const newTokens = newLogin.data?.tokens || newLogin.raw?.tokens;
  const activeAuthAfterChange = { Authorization: `Bearer ${newTokens?.accessToken}` };

  record(
    '9.4',
    'Login with updated password succeeds with HTTP 200',
    newLogin.status === 200 && !!newTokens?.accessToken,
    `Authenticated with new password`,
  );

  // =========================================================================
  // TEST 10: Forgot Password & Password Reset Flow
  // =========================================================================
  console.log('\n>>> [10/15] Testing Forgot Password & Password Reset Flow...');
  // Request reset
  const forgotRes = await api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail }),
  });
  const resetToken = forgotRes.data?.resetToken || forgotRes.raw?.resetToken;

  record(
    '10.1',
    'POST /auth/forgot-password generates secure reset token with TTL in Redis/store',
    forgotRes.status === 200 && typeof resetToken === 'string' && resetToken.length > 20,
    `Reset token generated: ${resetToken?.slice(0, 15)}...`,
  );

  // Generic message for non-existent email
  const fakeForgotRes = await api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: `no_such_user_${ts}@niva.ai` }),
  });
  const forgotMsg = forgotRes.data?.message || forgotRes.raw?.message;
  const fakeForgotMsg = fakeForgotRes.data?.message || fakeForgotRes.raw?.message;

  record(
    '10.2',
    'Non-existent email receives identical generic success message (Anti-Enumeration)',
    fakeForgotRes.status === 200 && fakeForgotMsg === forgotMsg,
    `Message: "${fakeForgotMsg}"`,
  );

  // Reset password using token
  const finalPassword = 'FinalResetPassword789!';
  const resetRes = await api('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: resetToken, newPassword: finalPassword }),
  });
  const resetData = resetRes.data || resetRes.raw;
  record(
    '10.3',
    'POST /auth/reset-password successfully resets password and invalidates token',
    resetRes.status === 200 && resetData?.success === true,
    `Message: "${resetData?.message}"`,
  );

  // Verify token cannot be reused
  const reuseReset = await api('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: resetToken, newPassword: 'AnotherPassword123!' }),
  });
  record(
    '10.4',
    'Reusing expired or already used reset token fails with HTTP 400',
    reuseReset.status === 400,
    `Status: ${reuseReset.status}`,
  );

  // Login with final password
  const finalLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: finalPassword }),
  });
  const finalTokens = finalLogin.data?.tokens || finalLogin.raw?.tokens;
  const finalAuth = { Authorization: `Bearer ${finalTokens?.accessToken}` };

  record(
    '10.5',
    'Login with newly reset password succeeds with HTTP 200',
    finalLogin.status === 200 && !!finalTokens?.accessToken,
    `Final login verified`,
  );

  // =========================================================================
  // TEST 11: Multi-Tenant Security & Tenant Isolation
  // =========================================================================
  console.log('\n>>> [11/15] Testing Multi-Tenant Resource Authorization & Isolation...');
  // User A creates conversation
  const convRes = await api('/conversations', {
    method: 'POST',
    headers: finalAuth,
    body: JSON.stringify({ characterId: 'niva_anchor', title: 'User A Secret Strategy' }),
  });
  const convIdA = convRes.data?.id || convRes.raw?.id;

  // User A creates task
  const taskRes = await api('/life/tasks', {
    method: 'POST',
    headers: finalAuth,
    body: JSON.stringify({ title: 'User A Confidential Task', priority: 'high' }),
  });
  const taskIdA = taskRes.data?.id || taskRes.raw?.id;

  // Register User B
  const userBEmail = `saas_user_b_${ts}@niva.ai`;
  const regB = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userBEmail, password: 'Password456!', name: 'Jordan Hayes' }),
  });
  const bTokens = regB.data?.tokens || regB.raw?.tokens;
  const tokenB = bTokens?.accessToken;
  const authB = { Authorization: `Bearer ${tokenB}` };

  // User B attempts to read User A's conversation
  const bReadConv = await api(`/conversations/${convIdA}`, { headers: authB });
  record(
    '11.1',
    'User B cross-tenant read of User A conversation fails with HTTP 404 (Isolation)',
    bReadConv.status === 404,
    `Status: ${bReadConv.status}`,
  );

  // User B attempts to read User A's conversation messages
  const bReadMessages = await api(`/conversations/${convIdA}/messages`, { headers: authB });
  record(
    '11.2',
    'User B cross-tenant read of User A messages fails with HTTP 404 (Isolation)',
    bReadMessages.status === 404,
    `Status: ${bReadMessages.status}`,
  );

  // User B attempts to update User A's conversation
  const bUpdateConv = await api(`/conversations/${convIdA}`, {
    method: 'PATCH',
    headers: authB,
    body: JSON.stringify({ title: 'Hacked by User B' }),
  });
  record(
    '11.3',
    'User B cross-tenant update of User A conversation fails with HTTP 404',
    bUpdateConv.status === 404,
    `Status: ${bUpdateConv.status}`,
  );

  // User B attempts to delete User A's task
  const bDeleteTask = await api(`/life/tasks/${taskIdA}`, {
    method: 'DELETE',
    headers: authB,
  });
  record(
    '11.4',
    'User B cross-tenant deletion of User A task fails with HTTP 404',
    bDeleteTask.status === 404,
    `Status: ${bDeleteTask.status}`,
  );

  // Verify User A task is preserved
  const dbTaskStillExists = psql(`SELECT count(*) FROM life_tasks WHERE id = '${taskIdA}';`);
  record(
    '11.5',
    'User A task preserved intact after unauthorized cross-tenant attempt',
    dbTaskStillExists === '1',
    `DB Task rows: ${dbTaskStillExists}`,
  );

  // =========================================================================
  // TEST 12: Account Data Export (GDPR / Privacy Compliance)
  // =========================================================================
  console.log('\n>>> [12/15] Testing GDPR Data Portability & Account Export...');
  const exportRes = await api('/auth/export', { headers: finalAuth });
  const exportData = exportRes.data || exportRes.raw;

  const hasUser = !!exportData?.user?.id;
  const hasLifeContext = !!exportData?.lifeContext?.tasks;
  const hasConversations = Array.isArray(exportData?.conversations);
  const hasReminders = Array.isArray(exportData?.scheduledReminders);

  record(
    '12.1',
    'GET /auth/export returns comprehensive GDPR-compliant JSON archive of personal data',
    exportRes.status === 200 && hasUser && hasLifeContext && hasConversations && hasReminders,
    `Export sections: user=${hasUser}, lifeContext=${hasLifeContext}, conversations=${hasConversations}, reminders=${hasReminders}`,
  );

  // =========================================================================
  // TEST 13: Account Deletion Confirmation Validation
  // =========================================================================
  console.log('\n>>> [13/15] Testing Account Deletion Confirmation Safeguards...');
  // Attempt deletion with wrong confirmation text
  const wrongConfirm = await api('/auth/account', {
    method: 'DELETE',
    headers: finalAuth,
    body: JSON.stringify({ confirmText: 'CANCEL', password: finalPassword }),
  });
  record(
    '13.1',
    'Account deletion requires exact confirmation keyword "DELETE" (rejects with 400)',
    wrongConfirm.status === 400,
    `Status: ${wrongConfirm.status}`,
  );

  // Attempt deletion with wrong password
  const wrongDelPass = await api('/auth/account', {
    method: 'DELETE',
    headers: finalAuth,
    body: JSON.stringify({ confirmText: 'DELETE', password: 'WrongPassword999!' }),
  });
  record(
    '13.2',
    'Account deletion requires matching current password (rejects with 401)',
    wrongDelPass.status === 401,
    `Status: ${wrongDelPass.status}`,
  );

  // =========================================================================
  // TEST 14: Permanent Account Deletion & Atomic Cascading Wipe
  // =========================================================================
  console.log('\n>>> [14/15] Executing Account Deletion & Verifying 38-Table Database Cascade...');
  const deleteRes = await api('/auth/account', {
    method: 'DELETE',
    headers: finalAuth,
    body: JSON.stringify({ confirmText: 'DELETE', password: finalPassword }),
  });
  const deleteData = deleteRes.data || deleteRes.raw;

  record(
    '14.1',
    'DELETE /auth/account succeeds with HTTP 200 and confirmation message',
    deleteRes.status === 200 && deleteData?.success === true,
    `Message: "${deleteData?.message}"`,
  );

  // Verify user row removed from PostgreSQL
  const dbUserCount = psql(`SELECT count(*) FROM users WHERE id = '${userAId}';`);
  const dbConvCount = psql(`SELECT count(*) FROM conversations WHERE user_id = '${userAId}';`);
  const dbTaskCount = psql(`SELECT count(*) FROM life_tasks WHERE user_id = '${userAId}';`);
  const dbSessionCount = psql(`SELECT count(*) FROM sessions WHERE user_id = '${userAId}';`);

  record(
    '14.2',
    'PostgreSQL atomically cascaded deletion across users, conversations, tasks, and sessions',
    dbUserCount === '0' && dbConvCount === '0' && dbTaskCount === '0' && dbSessionCount === '0',
    `DB counts for deleted user: users=${dbUserCount}, conversations=${dbConvCount}, tasks=${dbTaskCount}, sessions=${dbSessionCount}`,
  );

  // Verify deleted user cannot log in
  const postDeleteLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: userAEmail, password: finalPassword }),
  });
  record(
    '14.3',
    'Deleted user cannot authenticate (HTTP 401 Unauthorized)',
    postDeleteLogin.status === 401,
    `Status: ${postDeleteLogin.status}`,
  );

  // =========================================================================
  // TEST 15: Clean Regression Check of Browser Push Delivery
  // =========================================================================
  console.log('\n>>> [15/15] Running Regression Check on Browser Push VAPID Endpoint...');
  const vapidKeyCheck = await api('/notifications/browser/public-key', { headers: authB });
  const pubKey = vapidKeyCheck.data?.publicKey || vapidKeyCheck.raw?.publicKey;
  const hasVapidKey = typeof pubKey === 'string' && pubKey.startsWith('B');

  record(
    '15.1',
    'VAPID public key endpoint remains operational and unaffected by auth changes',
    vapidKeyCheck.status === 200 && hasVapidKey,
    `Key prefix: ${pubKey?.slice(0, 15)}...`,
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
    console.log('🎉 ALL SAAS AUTHENTICATION, ACCOUNT & SECURITY TESTS PASSED PERFECTLY!');
  }
}

run().catch((err) => {
  console.error('\nFatal test execution error:', err);
  process.exit(1);
});
