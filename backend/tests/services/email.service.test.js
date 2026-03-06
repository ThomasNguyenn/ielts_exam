import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  dotenvConfig: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (...args) => mocks.createTransport(...args),
  },
}));

vi.mock("dotenv", () => ({
  default: {
    config: (...args) => mocks.dotenvConfig(...args),
  },
}));

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  FRONTEND_ORIGINS: process.env.FRONTEND_ORIGINS,
  SMTP_FROM: process.env.SMTP_FROM,
};

const restoreEnvValue = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

const importEmailService = async () => import("../../services/email.service.js");

describe("email.service domain and branding defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    restoreEnvValue("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
    restoreEnvValue("FRONTEND_ORIGINS", ORIGINAL_ENV.FRONTEND_ORIGINS);
    restoreEnvValue("SMTP_FROM", ORIGINAL_ENV.SMTP_FROM);

    mocks.createTransport.mockReturnValue({
      sendMail: (...args) => mocks.sendMail(...args),
    });
    mocks.sendMail.mockResolvedValue({ messageId: "mail-1" });
  });

  it("uses the first FRONTEND_ORIGINS origin for verification link and IELTS Hub default sender", async () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_ORIGINS = "https://ieltshub.online,https://fallback.example.com";
    delete process.env.SMTP_FROM;

    const { sendVerificationEmail } = await importEmailService();
    await sendVerificationEmail("student@example.com", "token-verify");

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    const options = mocks.sendMail.mock.calls[0][0];
    expect(options.from).toBe("\"IELTS Hub\" <no-reply@ieltshub.online>");
    expect(options.html).toContain("https://ieltshub.online/verify-email?token=token-verify");
    expect(options.html).toContain("Welcome to IELTS Hub!");
  });

  it("uses production fallback domain when FRONTEND_ORIGINS is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.FRONTEND_ORIGINS;
    delete process.env.SMTP_FROM;

    const { sendPasswordResetEmail } = await importEmailService();
    await sendPasswordResetEmail("student@example.com", "token-reset");

    const options = mocks.sendMail.mock.calls[0][0];
    expect(options.html).toContain("https://ieltshub.online/reset-password?token=token-reset");
    expect(options.from).toBe("\"IELTS Hub\" <no-reply@ieltshub.online>");
  });

  it("uses development fallback domain when FRONTEND_ORIGINS is missing", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.FRONTEND_ORIGINS;

    const { sendEmailChangeVerificationEmail } = await importEmailService();
    await sendEmailChangeVerificationEmail("student@example.com", "token-change");

    const options = mocks.sendMail.mock.calls[0][0];
    expect(options.html).toContain("http://localhost:5173/verify-email-change?token=token-change");
  });

  it("keeps SMTP_FROM override when provided", async () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_ORIGINS = "https://ieltshub.online";
    process.env.SMTP_FROM = "\"Custom Sender\" <team@ieltshub.online>";

    const { sendVerificationEmail } = await importEmailService();
    await sendVerificationEmail("student@example.com", "token-custom-from");

    const options = mocks.sendMail.mock.calls[0][0];
    expect(options.from).toBe("\"Custom Sender\" <team@ieltshub.online>");
  });

  it("uses IELTS Hub branding in invitation subject and body", async () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_ORIGINS = "https://ieltshub.online";
    delete process.env.SMTP_FROM;

    const { sendInvitationEmail } = await importEmailService();
    await sendInvitationEmail("teacher@example.com", "invite-token", "teacher");

    const options = mocks.sendMail.mock.calls[0][0];
    expect(options.subject).toContain("IELTS Hub");
    expect(options.subject).not.toContain("IELTS Master");
    expect(options.html).toContain("IELTS Hub");
    expect(options.html).toContain("https://ieltshub.online/register?invite=invite-token");
  });
});
