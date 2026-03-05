import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const userCountDocumentsMock = vi.fn();
const userFindMock = vi.fn();

vi.mock("../../models/User.model.js", () => ({
  default: {
    countDocuments: userCountDocumentsMock,
    find: userFindMock,
  },
}));

const buildFindChain = (rows) => ({
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(rows),
});

const createMockRes = () => {
  const res = {
    set: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.set.mockReturnValue(res);
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

let getUsers;
let getOnlineStudents;

beforeAll(async () => {
  const adminController = await import("../../controllers/admin.controller.js");
  getUsers = adminController.getUsers;
  getOnlineStudents = adminController.getOnlineStudents;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin online student controllers", () => {
  it("getUsers adds is_online flag without breaking existing payload", async () => {
    const now = Date.now();
    const rows = [
      { _id: "s1", role: "student", name: "Online Student", email: "s1@test.com", lastSeenAt: new Date(now - 60_000) },
      { _id: "s2", role: "student", name: "Offline Student", email: "s2@test.com", lastSeenAt: new Date(now - 20 * 60_000) },
      { _id: "t1", role: "teacher", name: "Teacher", email: "t1@test.com", lastSeenAt: new Date(now - 30_000) },
    ];
    userCountDocumentsMock.mockResolvedValue(rows.length);
    userFindMock.mockReturnValue(buildFindChain(rows));

    const req = { query: { page: "1", limit: "20" } };
    const res = createMockRes();

    await getUsers(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data[0].is_online).toBe(true);
    expect(payload.data[1].is_online).toBe(false);
    expect(payload.data[2].is_online).toBe(false);
  });

  it("getOnlineStudents returns admin online list metadata and applies q filter", async () => {
    const rows = [
      { _id: "s1", role: "student", name: "Anna", email: "anna@test.com", lastSeenAt: new Date() },
    ];
    userCountDocumentsMock.mockResolvedValue(1);
    userFindMock.mockReturnValue(buildFindChain(rows));

    const req = { query: { page: "1", limit: "10", q: "ann" } };
    const res = createMockRes();

    await getOnlineStudents(req, res);

    expect(userCountDocumentsMock).toHaveBeenCalledTimes(1);
    const filter = userCountDocumentsMock.mock.calls[0][0];
    expect(filter.role).toEqual({ $in: ["student", "studentIELTS", "studentACA"] });
    expect(filter.lastSeenAt?.$gte).toBeInstanceOf(Date);
    expect(Array.isArray(filter.$or)).toBe(true);
    expect(filter.$or).toHaveLength(2);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.online_window_minutes).toBe(5);
    expect(typeof payload.as_of).toBe("string");
    expect(payload.data[0].is_online).toBe(true);
  });
});
