/**
 * Email Service
 * Nodemailer-based email delivery with graceful fallback to console logging.
 * When SMTP is not configured, all functions log with "📧 EMAIL" prefix and return true.
 * @version 2.0.0
 */

'use strict';

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isSmtpConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

const fromAddress = () =>
  `"${process.env.FROM_NAME || 'Hotel Management'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`;

const htmlWrapper = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1E3A5F; padding: 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .footer { background: #f9f9f9; padding: 16px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
    .btn { display: inline-block; padding: 12px 28px; background: #1E3A5F; color: #fff; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 16px 0; }
    .otp-box { font-size: 36px; letter-spacing: 12px; font-weight: bold; color: #1E3A5F; text-align: center; padding: 16px; background: #f0f4f8; border-radius: 6px; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #1E3A5F; color: #fff; padding: 10px; text-align: left; }
    td { padding: 9px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #f9f9f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🏨 ${title}</h1></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${process.env.HOTEL_NAME || 'Hotel Management System'} &mdash;
      This email was sent automatically. Please do not reply.
    </div>
  </div>
</body>
</html>`;

/**
 * Internal send helper — falls back to console log when SMTP not configured.
 * @returns {Promise<boolean>}
 */
const sendMail = async (mailOptions) => {
  if (!isSmtpConfigured()) {
    logger.info(`📧 EMAIL [FALLBACK] To: ${mailOptions.to} | Subject: ${mailOptions.subject}`);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('📧 EMAIL body (text):', mailOptions.text || '(html only)');
    }
    return true;
  }
  try {
    const transporter = createTransport();
    const info = await transporter.sendMail({ from: fromAddress(), ...mailOptions });
    logger.info(`📧 EMAIL sent to ${mailOptions.to} — messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    logger.error(`📧 EMAIL send failed to ${mailOptions.to}:`, err.message);
    return false;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send OTP email with styled HTML template.
 * @param {string} email
 * @param {string} otp
 * @param {string} [name]
 */
const sendOtpEmail = async (email, otp, name = 'Guest') => {
  const subject = 'Your Login OTP Code';
  const body = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Use the one-time password below to complete your login. It expires in <strong>5 minutes</strong>.</p>
    <div class="otp-box">${otp}</div>
    <p>If you did not request this OTP, please ignore this email or contact support immediately.</p>`;
  return sendMail({
    to: email,
    subject,
    text: `Hi ${name}, your OTP is: ${otp}. Valid for 5 minutes.`,
    html: htmlWrapper(subject, body),
  });
};

/**
 * Send password-reset link email.
 * @param {string} email
 * @param {string} token  - Raw reset token (URL-encoded in the link)
 * @param {string} [name]
 */
const sendPasswordResetEmail = async (email, token, name = 'Guest') => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset Your Password';
  const body = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset your password. Click the button below to set a new password.
       This link is valid for <strong>1 hour</strong>.</p>
    <p style="text-align:center;"><a href="${resetUrl}" class="btn">Reset Password</a></p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
    <p style="font-size:12px;color:#999;">If the button doesn't work, copy and paste this URL:<br/>${resetUrl}</p>`;
  return sendMail({
    to: email,
    subject,
    text: `Hi ${name}, reset your password: ${resetUrl}`,
    html: htmlWrapper(subject, body),
  });
};

/**
 * Send welcome email to a newly registered user.
 * @param {string} email
 * @param {string} [name]
 */
const sendWelcomeEmail = async (email, name = 'Guest') => {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  const subject = `Welcome to ${process.env.HOTEL_NAME || 'Hotel Management System'}`;
  const body = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Welcome aboard! Your account has been created successfully.</p>
    <p>You can now log in and explore all features of the hotel management system.</p>
    <p style="text-align:center;"><a href="${loginUrl}" class="btn">Go to Dashboard</a></p>
    <p>If you have any questions, feel free to reach out to our support team.</p>`;
  return sendMail({
    to: email,
    subject,
    text: `Hi ${name}, welcome! Login at ${loginUrl}`,
    html: htmlWrapper(subject, body),
  });
};

/**
 * Send booking confirmation email with details.
 * @param {string} email
 * @param {object} booking
 * @param {object} guest
 * @param {object} room
 */
const sendBookingConfirmation = async (email, booking, guest, room) => {
  const guestName = guest?.name || 'Guest';
  const roomNum = room?.number || 'N/A';
  const roomType = room?.type || 'N/A';
  const checkIn = booking?.checkInDate
    ? new Date(booking.checkInDate).toLocaleDateString('en-IN', { dateStyle: 'long' })
    : 'N/A';
  const checkOut = booking?.checkOutDate
    ? new Date(booking.checkOutDate).toLocaleDateString('en-IN', { dateStyle: 'long' })
    : 'N/A';
  const nights = booking?.checkInDate && booking?.checkOutDate
    ? Math.ceil((new Date(booking.checkOutDate) - new Date(booking.checkInDate)) / 86400000)
    : '—';
  const total = booking?.totalAmount != null
    ? `₹${Number(booking.totalAmount).toLocaleString('en-IN')}`
    : 'N/A';
  const subject = `Booking Confirmed — Room ${roomNum}`;
  const body = `
    <p>Hi <strong>${guestName}</strong>,</p>
    <p>Your booking has been confirmed. Here are the details:</p>
    <table>
      <tr><th colspan="2">Booking Summary</th></tr>
      <tr><td><strong>Booking Ref</strong></td><td>${booking?.bookingNumber || booking?._id || 'N/A'}</td></tr>
      <tr><td><strong>Room</strong></td><td>${roomNum} (${roomType})</td></tr>
      <tr><td><strong>Check-In</strong></td><td>${checkIn}</td></tr>
      <tr><td><strong>Check-Out</strong></td><td>${checkOut}</td></tr>
      <tr><td><strong>Nights</strong></td><td>${nights}</td></tr>
      <tr><td><strong>Total Amount</strong></td><td>${total}</td></tr>
      <tr><td><strong>Status</strong></td><td>${booking?.status || 'Confirmed'}</td></tr>
    </table>
    <p>We look forward to welcoming you. For any changes or queries, please contact us.</p>`;
  return sendMail({
    to: email,
    subject,
    text: `Booking confirmed for ${guestName}. Room ${roomNum}, Check-in: ${checkIn}, Check-out: ${checkOut}, Total: ${total}`,
    html: htmlWrapper(subject, body),
  });
};

/**
 * Send data backup ZIP to admin email.
 * @param {string} adminEmail
 * @param {Buffer} zipBuffer  - ZIP file buffer
 */
const sendDataBackupEmail = async (adminEmail, zipBuffer) => {
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const subject = `[Backup] Hotel Data Backup — ${new Date().toLocaleDateString('en-IN')}`;
  const body = `
    <p>Hi Admin,</p>
    <p>Attached is the automated data backup generated on <strong>${new Date().toLocaleString('en-IN')}</strong>.</p>
    <p>Please store this file in a secure location.</p>`;
  return sendMail({
    to: adminEmail,
    subject,
    text: `Hotel data backup attached. Generated: ${new Date().toISOString()}`,
    html: htmlWrapper(subject, body),
    attachments: [
      {
        filename: `hotel-backup-${now}.zip`,
        content: zipBuffer,
        contentType: 'application/zip',
      },
    ],
  });
};

/**
 * Send security alert / general alert email to admin.
 * @param {string} adminEmail
 * @param {string} subject
 * @param {string} message  - Plain text or HTML message body
 */
const sendAlertEmail = async (adminEmail, subject, message) => {
  const body = `
    <p>Hi Admin,</p>
    <div style="padding:16px;background:#fff3cd;border-left:4px solid #ffc107;border-radius:4px;">
      ${message.replace(/\n/g, '<br/>')}
    </div>
    <p style="margin-top:16px;font-size:12px;color:#999;">
      Generated at ${new Date().toLocaleString('en-IN')}
    </p>`;
  return sendMail({
    to: adminEmail,
    subject: `[ALERT] ${subject}`,
    text: `ALERT: ${subject}\n\n${message}`,
    html: htmlWrapper(`⚠️ Alert: ${subject}`, body),
  });
};

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendBookingConfirmation,
  sendDataBackupEmail,
  sendAlertEmail,
};
