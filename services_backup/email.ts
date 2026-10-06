import nodemailer from "nodemailer";

interface SendVerificationEmailParams {
  to: string;
  code: string;
  name: string;
}

/**
 * Sends a verification email.
 * If SMTP environment variables are not configured, this will attempt to use
 * Ethereal Email (a mock SMTP service provided by Nodemailer) for development.
 */
export async function sendVerificationEmail({ to, code, name }: SendVerificationEmailParams) {
  let transporter: nodemailer.Transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development mock
    console.log("No SMTP credentials found. Falling back to Ethereal Email for development.");
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const info = await transporter.sendMail({
    from: `"AI Study Companion" <${process.env.SMTP_FROM ?? "noreply@example.com"}>`,
    to,
    subject: "Verify your email address",
    text: `Hi ${name},\n\nYour verification code is:\n\n${code}\n\nThis code expires in 2 minutes.\n\nEnter this code in the dashboard to verify your email.\n\nThanks,\nThe Team`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your email address</h2>
        <p>Hi ${name},</p>
        <p>Your verification code is:</p>
        <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 16px 0;">
          <strong>${code}</strong>
        </div>
        <p style="color: #71717a; font-size: 14px;">This code expires in 2 minutes.</p>
        <p>Enter this code in the dashboard to verify your email.</p>
        <p>Thanks,<br>The Team</p>
      </div>
    `,
  });

  console.log("Message sent: %s", info.messageId);

  // If using ethereal, log the preview URL
  if (!process.env.SMTP_HOST) {
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  }
}

interface SendWelcomeEmailParams {
  to: string;
  name: string;
}

/**
 * Sends a welcome email to newly registered users.
 */
export async function sendWelcomeEmail({ to, name }: SendWelcomeEmailParams) {
  let transporter: nodemailer.Transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development mock
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const info = await transporter.sendMail({
    from: `"AI Study Companion" <${process.env.SMTP_FROM ?? "noreply@example.com"}>`,
    to,
    subject: "Welcome to AI Study Companion! 🎓 Join Our Community",
    text: `Hi ${name},\n\nYour account has been successfully created — welcome aboard! 🎉\n\nAI Study Companion is built to help you study smarter. Upload your materials, generate AI-powered study notes and flashcards, and chat with your course content — all in one place.\n\nJoin Our Discord Community\nConnect with other students, share study tips, ask questions, and learn together:\nhttps://discord.gg/invite-link-here\n\nHappy studying,\nThe AI Study Companion Team`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to AI Study Companion! 🎓</h2>
        <p>Hi ${name},</p>
        <p>Your account has been successfully created — welcome aboard! 🎉</p>
        <p>AI Study Companion is built to help you study smarter. Upload your materials, generate AI-powered study notes and flashcards, and chat with your course content — all in one place.</p>
        
        <div style="background-color: #f4f4f5; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center;">
          <h3 style="margin-top: 0;">Join Our Discord Community</h3>
          <p>Connect with other students, share study tips, ask questions, and learn together.</p>
          <a href="https://discord.gg/invite-link-here" style="display: inline-block; background-color: #5865F2; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join the Discord →</a>
        </div>
        
        <p>Happy studying,<br>The AI Study Companion Team</p>
      </div>
    `,
  });

  console.log("Welcome message sent: %s", info.messageId);

  if (!process.env.SMTP_HOST) {
    console.log("Preview URL (Welcome): %s", nodemailer.getTestMessageUrl(info));
  }
}

interface SendPasswordResetEmailParams {
  to: string;
  code: string;
  name: string;
}

/**
 * Sends a password reset email containing the reset code.
 */
export async function sendPasswordResetEmail({ to, code, name }: SendPasswordResetEmailParams) {
  let transporter: nodemailer.Transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development mock
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const info = await transporter.sendMail({
    from: `"AI Study Companion" <${process.env.SMTP_FROM ?? "noreply@example.com"}>`,
    to,
    subject: "Reset your password",
    text: `Hi ${name},\n\nWe received a request to reset your password.\n\nYour password reset code is:\n\n${code}\n\nEnter this code on the sign in page to choose a new password. The code expires in 15 minutes.\n\nIf you did not request this, you can safely ignore this email.\n\nThanks,\nThe Team`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Your password reset code is:</p>
        <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 16px 0;">
          <strong>${code}</strong>
        </div>
        <p>Enter this code on the sign in page to choose a new password. The code expires in 15 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <p>Thanks,<br>The Team</p>
      </div>
    `,
  });

  console.log("Message sent: %s", info.messageId);

  if (!process.env.SMTP_HOST) {
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  }
}
