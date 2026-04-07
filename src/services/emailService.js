const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const createTransport = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendOtpEmail = async (to, otpCode) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email service not configured - OTP not sent');
    return false;
  }
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"${process.env.FROM_NAME || 'Hotel Management'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject: 'Your Login OTP',
    html: `<h2>Your OTP is: <strong>${otpCode}</strong></h2><p>Valid for 5 minutes.</p>`,
  });
  return true;
};

const sendPasswordResetEmail = async (to, resetToken) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email service not configured - reset email not sent');
    return false;
  }
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"${process.env.FROM_NAME || 'Hotel Management'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject: 'Password Reset Request',
    html: `<h2>Password Reset</h2><p>Click the link below to reset your password (valid 10 minutes):</p><a href="${resetUrl}">${resetUrl}</a>`,
  });
  return true;
};

module.exports = { sendOtpEmail, sendPasswordResetEmail };
