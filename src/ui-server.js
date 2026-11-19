// ZledgerCraft - owner-only server account, audit and backup panel.
// Rendering is kept separate from the main UI; values and helpers are supplied
// by ui.js so this module has no hidden dependency on application state.

export function serverFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function serverUsersPanel({
  accounts,
  authUser,
  USER_ROLES,
  roleLabel,
  esc,
  serverScopeEditor,
  serverCompanyChecks,
  authSessions,
  serverAuditRows,
  serverAuditChain,
  SERVER_EVENT_LABELS,
  serverAuditEvents,
  serverEventChain,
  serverBackups,
  serverBackupInfo,
  reportSettings,
  authLoginEvents,
  neonAuth,
  postgres,
  panel,
}) {
  const ownerCount = accounts.filter((account) => account.role === 'owner').length;
  const rows = accounts
    .map((account) => {
      const isCurrent = account.id === authUser?.id;
      const lastOwner = account.role === 'owner' && ownerCount <= 1;
      return `<tr class="${isCurrent ? 'selected' : ''}">
        <td><strong>${esc(account.name)}</strong><br><span class="muted small">@${esc(account.username)}${account.email ? `<br>${esc(account.email)}` : ''}</span></td>
        <td><span class="badge">${esc(roleLabel(account.role))}</span>${!neonAuth && account.mfaEnabled ? ' <span class="badge">2FA</span>' : ''}${!neonAuth && account.requireMfa ? ' <span class="badge">2FA required</span>' : ''}</td>
        <td class="muted small">${esc(USER_ROLES[account.role]?.blurb ?? '')}</td>
        <td>${serverScopeEditor(account)}</td>
        <td class="row-actions">
          <button class="btn small" type="button" data-action="set-server-email" data-id="${esc(account.id)}">${account.email ? 'Change email' : 'Set email'}</button>
          ${neonAuth ? '' : `<button class="btn small" type="button" data-action="reset-server-password" data-id="${esc(account.id)}">Reset password</button>
          <button class="btn small" type="button" data-action="${account.mfaEnabled ? 'disable-server-mfa' : 'enable-server-mfa'}" data-id="${esc(account.id)}">${account.mfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}</button>
          ${account.mfaEnabled ? `<button class="btn small" type="button" data-action="${account.requireMfa ? 'unrequire-server-mfa' : 'require-server-mfa'}" data-id="${esc(account.id)}">${account.requireMfa ? 'Clear 2FA requirement' : 'Require 2FA'}</button>` : ''}`}
          <button class="btn small" type="button" data-action="revoke-server-sessions" data-id="${esc(account.id)}"
            ${isCurrent ? 'disabled' : ''}>Sign out sessions</button>
          <button class="btn small danger" type="button" data-action="delete-server-user" data-id="${esc(account.id)}"
            ${isCurrent || lastOwner ? 'disabled' : ''}>Remove</button>
        </td>
      </tr>`;
    })
    .join('');

  return panel(
    `Server accounts <span class="count">${accounts.length}</span>`,
    `<p class="muted">${neonAuth ? 'These profiles control ZledgerCraft roles and company access. Email/password credentials are handled by Neon Auth. Add the email here before that person creates or signs in with their Neon Auth account.' : 'These are real server accounts. Passwords are stored as scrypt hashes; the browser receives only the signed-in name and role.'} Owner can manage companies, years, accounts and restores. Accountant can edit vouchers and masters. Viewer is read-only. Company access is enforced by the server, not just hidden in this screen.</p>
    <form id="server-user-form" class="form-grid" novalidate>
      <label class="field"><span>Display name</span><input name="name" maxlength="80" placeholder="e.g. Priya" required></label>
      <label class="field"><span>Username</span><input name="username" maxlength="40" autocapitalize="none" placeholder="e.g. priya" required></label>
      <label class="field"><span>${neonAuth ? 'Email (must match Neon Auth)' : 'Email (optional, for reset links)'}</span><input type="email" name="email" maxlength="200" autocomplete="email" placeholder="priya@example.com" ${neonAuth ? 'required' : ''}></label>
      <label class="field"><span>Role</span><select name="role">${Object.entries(USER_ROLES).map(([role, meta]) => `<option value="${role}">${esc(meta.label)}</option>`).join('')}</select></label>
      ${neonAuth ? '' : '<label class="field"><span>Temporary password</span><input type="password" name="password" minlength="8" autocomplete="new-password" required></label>'}
      <label class="field"><span>Company access</span><select name="scopeMode"><option value="all">All companies (including future)</option><option value="selected">Selected companies</option><option value="none">No companies</option></select></label>
      <div class="field scope-field"><span>Companies for selected access</span><div class="check-grid">${serverCompanyChecks(null)}</div><small class="muted">Ignored when All companies or the Owner role is selected.</small></div>
      <div class="field form-actions"><button class="btn primary" type="submit">Create account</button></div>
      <p id="server-user-error" class="form-error" role="alert"></p>
    </form>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Account</th><th>Role</th><th>Description</th><th>Company access</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <h3 class="section-title">Change my password</h3>
    ${neonAuth ? '<p class="muted small">Passwords are managed by Neon Auth. Use the reset link on the sign-in screen.</p>' : `<form id="change-password-form" class="form-grid" novalidate>
      <label class="field"><span>Current password</span><input type="password" name="currentPassword" autocomplete="current-password" required></label>
      <label class="field"><span>New password</span><input type="password" name="newPassword" minlength="8" autocomplete="new-password" required></label>
      <label class="field"><span>Confirm new password</span><input type="password" name="confirmPassword" minlength="8" autocomplete="new-password" required></label>
      <label class="field"><span>Authenticator code (if enabled)</span><input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"></label>
      <div class="field form-actions"><button class="btn primary" type="submit">Change password</button></div>
      <p id="change-password-error" class="form-error" role="alert"></p>
    </form>`}
    <h3 class="section-title">Active sessions</h3>
    <p class="muted small">Sessions are HttpOnly cookies and expire after seven days. Revoking a session signs that browser out immediately.</p>
    <div class="form-actions"><button class="btn small" type="button" data-action="refresh-auth-sessions">Refresh sessions</button></div>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Account</th><th>Signed in</th><th>Expires</th><th>Device</th><th></th></tr></thead>
      <tbody>${authSessions.length
        ? authSessions
            .map(
              (session) => `<tr>
                <td>@${esc(session.username)}</td>
                <td>${esc(new Date(session.createdAt).toLocaleString('en-IN'))}</td>
                <td>${esc(new Date(session.expiresAt).toLocaleString('en-IN'))}</td>
                <td class="muted small">${esc(session.userAgent || 'Unknown device')}</td>
                <td><button class="btn small danger" type="button" data-action="revoke-server-session" data-id="${esc(session.id)}">Revoke</button></td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="5" class="muted">No active sessions.</td></tr>'}</tbody>
    </table></div>
    <h3 class="section-title">Server save audit</h3>
    <p class="muted small">Every accepted workspace save is recorded in ${postgres ? 'Postgres' : 'SQLite'} with the signed-in account, role, revision and payload size. The rows are hash-chained; verification detects edits made outside the server. This is separate from the in-app audit trail and is only shown to owners.</p>
    <p class="muted small">${serverAuditChain.ok === null
      ? 'Chain status unavailable.'
      : serverAuditChain.ok
        ? `<span class="badge">Chain verified</span> ${serverAuditChain.checked} save row(s).`
        : `<span class="badge danger">Chain broken</span> at row ${serverAuditChain.brokenId ?? 'unknown'}.`}</p>
    <div class="form-actions"><button class="btn small" type="button" data-action="refresh-server-audit">Refresh server audit</button></div>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Time</th><th>Account</th><th>Role</th><th>Revision</th><th>Bytes</th></tr></thead>
      <tbody>${serverAuditRows.length
        ? serverAuditRows
            .slice(0, 20)
            .map(
              (row) => `<tr>
                <td>${esc(new Date(row.at).toLocaleString('en-IN'))}</td>
                <td>@${esc(row.username)}</td>
                <td>${esc(roleLabel(row.role))}</td>
                <td class="num">${esc(row.rev)}</td>
                <td class="num">${esc(serverFileSize(row.bytes))}</td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="5" class="muted">No server saves recorded yet.</td></tr>'}</tbody>
    </table></div>
    <h3 class="section-title">Server account audit</h3>
    <p class="muted small">Account creation, role and company changes, password resets, 2FA changes, session revocations, clears, restores and manual backups are hash-chained separately from workspace saves.</p>
    <p class="muted small">${serverEventChain.ok === null
      ? 'Event-chain status unavailable.'
      : serverEventChain.ok
        ? `<span class="badge">Chain verified</span> ${serverEventChain.checked} event(s).`
        : `<span class="badge danger">Chain broken</span> at event ${serverEventChain.brokenId ?? 'unknown'}.`}</p>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Time</th><th>Account</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
      <tbody>${serverAuditEvents.length
        ? serverAuditEvents
            .slice(0, 20)
            .map(
              (event) => `<tr>
                <td>${esc(new Date(event.at).toLocaleString('en-IN'))}</td>
                <td>@${esc(event.username)}</td>
                <td>${esc(SERVER_EVENT_LABELS[event.action] ?? event.action)}</td>
                <td>${esc(event.target || '—')}</td>
                <td class="muted small">${esc(event.detail || '')}</td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="5" class="muted">No server account events recorded yet.</td></tr>'}</tbody>
    </table></div>
    <h3 class="section-title">Server backups</h3>
    <p class="muted small">A daily ${postgres ? 'Postgres JSON' : 'SQLite'} snapshot is created after the first save of the day and kept for ${serverBackupInfo.keep} snapshots at ${serverBackupInfo.hours}-hour intervals. ${serverBackupInfo.offsite?.configured ? `Verified snapshots are also uploaded to the configured R2 bucket (${esc(serverBackupInfo.offsite.bucket || 'offsite')}).` : 'These copies stay on this server; configure R2 for an offsite copy.'} Downloading a backup keeps an off-server copy. Restoring replaces the server books with that snapshot, creates a pre-restore backup first, and leaves server accounts and passwords unchanged.</p>
    <div class="form-actions">
      <button class="btn small primary" type="button" data-action="create-server-backup">Create backup now</button>
      <button class="btn small" type="button" data-action="refresh-server-backups">Refresh list</button>
    </div>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Backup</th><th>Created</th><th>Size</th><th></th></tr></thead>
      <tbody>${serverBackups.length
        ? serverBackups
            .map(
              (backup) => `<tr>
                <td><code>${esc(backup.name)}</code></td>
                <td>${esc(new Date(backup.createdAt).toLocaleString('en-IN'))}</td>
                <td class="num">${esc(serverFileSize(backup.bytes))}</td>
                <td class="row-actions"><a class="btn small" href="/api/backups/${encodeURIComponent(backup.name)}" download>Download</a><button class="btn small danger" type="button" data-action="restore-server-backup" data-id="${esc(backup.name)}">Restore</button></td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="4" class="muted">No server backups yet.</td></tr>'}</tbody>
    </table></div>
    <h3 class="section-title">Recent backup attempts</h3>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Time</th><th>Source</th><th>Result</th><th>Backup</th><th>Offsite</th><th>Error</th></tr></thead>
      <tbody>${serverBackupInfo.history?.length
        ? serverBackupInfo.history
            .slice(0, 10)
            .map(
              (attempt) => `<tr>
                <td>${esc(new Date(attempt.at).toLocaleString('en-IN'))}</td>
                <td>${esc(attempt.reason || 'manual')}</td>
                <td>${attempt.status === 'ok' ? 'OK' : attempt.status === 'warning' ? 'Warning' : 'Failed'}</td>
                <td>${attempt.name ? `<code>${esc(attempt.name)}</code>` : '-'}</td>
                <td>${attempt.offsite ? 'Yes' : 'No'}</td>
                <td>${esc(attempt.error || '-')}</td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="6" class="muted">No backup attempts yet.</td></tr>'}</tbody>
    </table></div>
    <h3 class="section-title">Scheduled reports</h3>
    <p class="muted small">A signed daily management summary is emailed through Resend after the scheduled backup check. The link is read-only, expires automatically and never exposes the full workspace. ${reportSettings.emailConfigured ? 'Resend is configured.' : 'Resend is not configured on this server, so delivery and manual sends are disabled.'} ${reportSettings.secretConfigured ? '' : 'Set ZL_REPORT_SECRET (or a server password) to sign report links.'}</p>
    <form id="report-settings-form" class="form-grid">
      <label class="field inline-field"><input type="checkbox" name="enabled" ${reportSettings.enabled ? 'checked' : ''}> <span>Email the daily summary automatically</span></label>
      <label class="field"><span>Recipients</span><input name="recipients" maxlength="1000" placeholder="owner@example.com, accounts@example.com" value="${esc(reportSettings.recipients || '')}"><small class="muted">Comma, semicolon or whitespace separated; up to 10 addresses.</small></label>
      <div class="field form-actions">
        <button class="btn primary" type="button" data-action="save-report-settings">Save report settings</button>
        <button class="btn" type="button" data-action="send-report-now">Send now</button>
        <button class="btn" type="button" data-action="preview-report">Preview signed link</button>
      </div>
    </form>
    <p class="muted small">${reportSettings.lastSentAt ? `Last successful report: ${esc(new Date(reportSettings.lastSentAt).toLocaleString('en-IN'))}.` : 'No report has been delivered from this workspace yet.'}</p>
    ${reportSettings.lastError ? `<p class="muted small"><strong>Last report attempt failed${reportSettings.lastAttemptAt ? ` ${esc(new Date(reportSettings.lastAttemptAt).toLocaleString('en-IN'))}` : ''}:</strong> ${esc(reportSettings.lastError)}</p>` : ''}
    <h3 class="section-title">Recent report attempts</h3>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Time</th><th>Source</th><th>Result</th><th>Recipients</th><th>Error</th></tr></thead>
      <tbody>${reportSettings.history?.length
        ? reportSettings.history
            .slice(0, 10)
            .map(
              (attempt) => `<tr>
                <td>${esc(new Date(attempt.at).toLocaleString('en-IN'))}</td>
                <td>${esc(attempt.source || 'manual')}</td>
                <td>${attempt.status === 'sent' ? 'Sent' : 'Failed'}</td>
                <td>${esc(attempt.recipients || '-')}</td>
                <td>${esc(attempt.error || '-')}</td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="5" class="muted">No report attempts yet.</td></tr>'}</tbody>
    </table></div>
    <h3 class="section-title">Recent sign-ins</h3>
    <p class="muted small">A sign-in attempt log is kept on the server. Passwords are never recorded. Signing out an account ends every current session for that account.</p>
    <div class="form-actions"><button class="btn small" type="button" data-action="refresh-auth-logins">Refresh sign-ins</button></div>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Time</th><th>Account</th><th>Result</th><th>Source</th></tr></thead>
      <tbody>${authLoginEvents.length
        ? authLoginEvents
            .slice(0, 20)
            .map(
              (event) => `<tr>
                <td>${esc(new Date(event.at).toLocaleString('en-IN'))}</td>
                <td>@${esc(event.username)}</td>
                <td><span class="badge ${event.ok ? '' : 'danger'}">${event.ok ? 'success' : 'failed'}</span></td>
                <td class="muted small">${esc(event.ip)}${event.userAgent ? `<br>${esc(event.userAgent)}` : ''}</td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="4" class="muted">No sign-in attempts recorded yet.</td></tr>'}</tbody>
    </table></div>`,
    'Accounts are created here, not in browser storage. Changing a password signs that account out everywhere.',
  );
}
