import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_FRONTEND_ORIGIN_DEV = 'http://localhost:5173';
const DEFAULT_FRONTEND_ORIGIN_PROD = 'https://ieltshub.online';
const DEFAULT_EMAIL_FROM = '"IELTS Hub" <no-reply@ieltshub.online>';

const isProductionEnv = () =>
    String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

const getDefaultFrontendOrigin = () =>
    isProductionEnv() ? DEFAULT_FRONTEND_ORIGIN_PROD : DEFAULT_FRONTEND_ORIGIN_DEV;

const getFrontendBaseUrl = () => {
    const origins = String(process.env.FRONTEND_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    const primaryOrigin = origins[0] || getDefaultFrontendOrigin();
    return primaryOrigin.replace(/\/+$/, '');
};

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendVerificationEmail = async (email, token) => {
    const verifyUrl = `${getFrontendBaseUrl()}/verify-email?token=${token}`;

    const mailOptions = {
        from: process.env.SMTP_FROM || DEFAULT_EMAIL_FROM,
        to: email,
        subject: 'Verify your email address',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to IELTS Hub!</h2>
        <p>Please click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Verify Email</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #666;">Link not working? Copy and paste this URL into your browser:<br>${verifyUrl}</p>
      </div>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending verification email:', error);
        // In development, might want to just log the URL if no SMTP
        if (process.env.NODE_ENV === 'development') {
            console.log('DEV MODE: Verification URL:', verifyUrl);
        }
        // Don't throw logic error to user if email fails, just log it? 
        // Or maybe we want to know. For now, let's catch and log, user can request resend.
        return null;
    }
};

export const sendPasswordResetEmail = async (email, token) => {
    const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${token}`;

    const mailOptions = {
        from: process.env.SMTP_FROM || DEFAULT_EMAIL_FROM,
        to: email,
        subject: 'Password Reset Request',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the button below to set a new password.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Reset Password</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">This link will expire in 1 hour.</p>
        <p style="font-size: 12px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        if (process.env.NODE_ENV === 'development') {
            console.log('DEV MODE: Reset URL:', resetUrl);
        }
        return null;
    }
};

export const sendEmailChangeVerificationEmail = async (email, token) => {
    const verifyUrl = `${getFrontendBaseUrl()}/verify-email-change?token=${token}`;

    const mailOptions = {
        from: process.env.SMTP_FROM || DEFAULT_EMAIL_FROM,
        to: email,
        subject: 'Confirm your new email address',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Confirm Email Change</h2>
        <p>We received a request to change your account email address.</p>
        <p>Click the button below to confirm this new email address.</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #111827; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Confirm New Email</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">This link will expire in 24 hours.</p>
        <p style="font-size: 12px; color: #666;">If you did not request this change, you can ignore this email.</p>
      </div>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email change verification sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email change verification:', error);
        if (process.env.NODE_ENV === 'development') {
            console.log('DEV MODE: Email change verify URL:', verifyUrl);
        }
        return null;
    }
};

export const sendInvitationEmail = async (email, token, role) => {
    const registerUrl = `${getFrontendBaseUrl()}/register?invite=${token}`;
    const roleLabel = role === 'admin' ? 'Quản trị viên' : 'Giáo viên';

    const mailOptions = {
        from: process.env.SMTP_FROM || DEFAULT_EMAIL_FROM,
        to: email,
        subject: `Lời mời tham gia IELTS Hub với vai trò ${roleLabel}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bạn được mời tham gia IELTS Hub!</h2>
        <p>Bạn đã được mời với vai trò <strong>${roleLabel}</strong>.</p>
        <p>Nhấn nút bên dưới để tạo tài khoản của bạn:</p>
        <a href="${registerUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Tạo tài khoản</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">Lời mời này có hiệu lực trong 48 giờ.</p>
        <p style="font-size: 12px; color: #666;">Link không hoạt động? Sao chép và dán URL này vào trình duyệt:<br>${registerUrl}</p>
      </div>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Invitation email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending invitation email:', error);
        if (process.env.NODE_ENV === 'development') {
            console.log('DEV MODE: Invitation URL:', registerUrl);
        }
        return null;
    }
};
