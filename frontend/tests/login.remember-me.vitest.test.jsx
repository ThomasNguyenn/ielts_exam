import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "@/features/auth/pages/Login";

const { mockApi, mockRoleRouting } = vi.hoisted(() => ({
  mockApi: {
    login: vi.fn(),
    setToken: vi.fn(),
    setUser: vi.fn(),
  },
  mockRoleRouting: {
    getDefaultRouteForUser: vi.fn(),
    requiresFirstLoginSetup: vi.fn(),
  },
}));

vi.mock("@/shared/api/client", () => ({
  api: mockApi,
}));

vi.mock("@/app/roleRouting", () => ({
  getDefaultRouteForUser: mockRoleRouting.getDefaultRouteForUser,
  requiresFirstLoginSetup: mockRoleRouting.requiresFirstLoginSetup,
}));

describe("Login rememberMe", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleRouting.requiresFirstLoginSetup.mockReturnValue(false);
    mockRoleRouting.getDefaultRouteForUser.mockReturnValue("/student-ielts/learn");
    mockApi.login.mockResolvedValue({
      data: {
        token: "token-1",
        user: { _id: "u1", role: "student_ielts", isConfirmed: true },
      },
    });
  });

  const submitLogin = async () => {
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(mockApi.login).toHaveBeenCalledTimes(1);
    });
  };

  it("submits rememberMe=true by default", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await submitLogin();

    expect(mockApi.login).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "Password1",
      rememberMe: true,
    });
  });

  it("submits rememberMe=false when checkbox is unchecked", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /remember me/i }));
    await submitLogin();

    expect(mockApi.login).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "Password1",
      rememberMe: false,
    });
  });
});
