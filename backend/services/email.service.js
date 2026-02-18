import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';

const getFrontendBaseUrl = () => {
    const origins = String(process.env.FRONTEND_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    const primaryOrigin = origins[0] || DEFAULT_FRONTEND_ORIGIN;
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
        from: process.env.SMTP_FROM || '"Ecosystem App" <no-reply@ecosystem.com>',
        to: email,
        subject: 'Verify your email address',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Ecosystem!</h2>
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
        from: process.env.SMTP_FROM || '"Ecosystem App" <no-reply@ecosystem.com>',
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
