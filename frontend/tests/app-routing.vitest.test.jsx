import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Outlet } from "react-router-dom";
import App from "../src/app/App.jsx";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    bootstrapSession: vi.fn(),
    isAuthenticated: vi.fn(),
    getUser: vi.fn(),
  },
}));

vi.mock("@/shared/api/client", () => ({
  api: mockApi,
}));

vi.mock("@/shared/context/NotificationContext", () => ({
  NotificationProvider: ({ children }) => children,
}));

vi.mock("@/features/achievements/components/AchievementToast", () => ({
  default: () => <div data-testid="achievement-toast" />,
}));

vi.mock("@/shared/components/Layout", () => ({
  default: function MockLayout() {
    return (
      <div>
        <div>Layout</div>
        <Outlet />
      </div>
    );
  },
}));

vi.mock("@/features/home/pages/Home", () => ({
  default: () => <div>Home Page</div>,
}));

vi.mock("@/features/auth/pages/Login", () => ({
  default: () => <div>Login Page</div>,
}));

vi.mock("@/features/system/pages/WaitForConfirmation", () => ({
  default: () => <div>Wait For Confirmation</div>,
}));

const renderAppAt = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  );

describe("App route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.bootstrapSession.mockResolvedValue(true);
    mockApi.isAuthenticated.mockReturnValue(false);
    mockApi.getUser.mockReturnValue(null);
  });

  it("redirects unauthenticated users away from protected routes", async () => {
    renderAppAt("/profile");

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(mockApi.bootstrapSession).toHaveBeenCalledTimes(1);
  });

  it("rejects non-admin/non-teacher users from manage routes", async () => {
    mockApi.isAuthenticated.mockReturnValue(true);
    mockApi.getUser.mockReturnValue({ role: "student", isConfirmed: true });

    renderAppAt("/manage");

    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("redirects unconfirmed students from public auth routes to wait page", async () => {
    mockApi.isAuthenticated.mockReturnValue(true);
    mockApi.getUser.mockReturnValue({ role: "student", isConfirmed: false });

    renderAppAt("/login");

    expect(await screen.findByText("Wait For Confirmation")).toBeInTheDocument();
  });
});
