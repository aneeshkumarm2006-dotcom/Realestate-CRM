const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY,
  },
});

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_BG = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#D97706',
  low: '#6B7280',
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const buildHtml = ({ taskName, priority, dueDate, taskLink }) => {
  const priorLabel = escapeHtml(PRIORITY_LABELS[priority] || priority);
  const priorBg = PRIORITY_BG[priority] || '#6B7280';
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'No due date set';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New task assigned</title>
  <style>
    body { margin: 0; padding: 0; background: #F3F4F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #2563EB; padding: 28px 32px; }
    .header-logo { font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.02em; }
    .body { padding: 32px; }
    .title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 6px; }
    .subtitle { font-size: 14px; color: #6B7280; margin: 0 0 24px; line-height: 1.5; }
    .task-card { background: #F9FAFB; border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
    .task-name { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 18px; }
    .meta-row { display: flex; align-items: flex-start; gap: 28px; flex-wrap: wrap; }
    .meta-item { display: flex; flex-direction: column; gap: 4px; }
    .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF; }
    .priority-badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; color: #FFFFFF; background: ${priorBg}; }
    .meta-value { font-size: 13px; font-weight: 500; color: #374151; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: #2563EB; color: #FFFFFF !important; font-size: 14px; font-weight: 600; padding: 13px 32px; border-radius: 8px; text-decoration: none; }
    .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 18px 32px; }
    .footer p { font-size: 12px; color: #9CA3AF; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Macan</div>
    </div>
    <div class="body">
      <p class="title">You've been assigned a task</p>
      <p class="subtitle">A new task has been assigned to you. Review the details below and click the button to open it.</p>
      <div class="task-card">
        <p class="task-name">${escapeHtml(taskName)}</p>
        <div class="meta-row">
          <div class="meta-item">
            <span class="meta-label">Priority</span>
            <span class="priority-badge">${priorLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Due Date</span>
            <span class="meta-value">${escapeHtml(dueDateStr)}</span>
          </div>
        </div>
      </div>
      <div class="cta">
        <a href="${taskLink}">View Task &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <p>You received this email because a task was assigned to you in Macan. If you believe this is an error, contact your administrator.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send a task-assignment email to a single recipient.
 *
 * @param {object} opts
 * @param {string} opts.to         — recipient email address
 * @param {string} opts.taskName   — task title
 * @param {string} opts.priority   — "critical" | "high" | "medium" | "low"
 * @param {Date|string|null} opts.dueDate  — optional due date
 * @param {string} opts.taskLink   — direct URL to the board/task
 */
const sendTaskAssignmentEmail = async ({ to, taskName, priority, dueDate, taskLink }) => {
  const html = buildHtml({ taskName, priority, dueDate, taskLink });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@davnoot.com',
    to,
    subject: `You've been assigned: ${taskName}`,
    html,
  });
};

const buildInviteHtml = ({ orgName, inviteLink, inviteCode }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to join ${escapeHtml(orgName)}</title>
  <style>
    body { margin: 0; padding: 0; background: #F3F4F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #2563EB; padding: 28px 32px; }
    .header-logo { font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.02em; }
    .body { padding: 32px; }
    .title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 6px; }
    .subtitle { font-size: 14px; color: #6B7280; margin: 0 0 24px; line-height: 1.5; }
    .code-box { background: #F3F4F8; border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
    .code-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9CA3AF; margin-bottom: 4px; }
    .code-value { font-size: 20px; font-weight: 700; color: #111827; letter-spacing: 0.08em; font-family: 'Courier New', monospace; }
    .divider { border: none; border-top: 1px solid #E5E7EB; margin: 24px 0; }
    .cta { text-align: center; }
    .cta a { display: inline-block; background: #2563EB; color: #FFFFFF !important; font-size: 14px; font-weight: 600; padding: 13px 32px; border-radius: 8px; text-decoration: none; }
    .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 18px 32px; }
    .footer p { font-size: 12px; color: #9CA3AF; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Macan</div>
    </div>
    <div class="body">
      <p class="title">You've been invited to join ${escapeHtml(orgName)}</p>
      <p class="subtitle">An admin has invited you to collaborate on <strong>${escapeHtml(orgName)}</strong> in Macan. Use the invite code below or click the button to join.</p>
      <div class="code-box">
        <div>
          <div class="code-label">Invite Code</div>
          <div class="code-value">${escapeHtml(inviteCode)}</div>
        </div>
      </div>
      <hr class="divider" />
      <div class="cta">
        <a href="${inviteLink}">Join ${escapeHtml(orgName)} &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <p>You received this invite from an admin of ${escapeHtml(orgName)}. If you don't recognise this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send an organisation invite email.
 *
 * @param {object} opts
 * @param {string} opts.to         — recipient email address
 * @param {string} opts.orgName    — organisation name
 * @param {string} opts.inviteLink — full URL to join the org
 * @param {string} opts.inviteCode — raw invite code (for manual entry)
 */
const sendInviteEmail = async ({ to, orgName, inviteLink, inviteCode }) => {
  const html = buildInviteHtml({ orgName, inviteLink, inviteCode });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@davnoot.com',
    to,
    subject: `You've been invited to join ${orgName} on Macan`,
    html,
  });
};

module.exports = { sendTaskAssignmentEmail, sendInviteEmail };
