import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const monthlyAssignmentFindByIdMock = vi.fn();
const homeworkGroupFindMock = vi.fn();
const monthlySubmissionFindMock = vi.fn();
const rewardClaimFindMock = vi.fn();
const rewardClaimCreateMock = vi.fn();
const rewardClaimDeleteOneMock = vi.fn();
const addXPMock = vi.fn();

vi.mock("../../models/MonthlyAssignment.model.js", () => ({
  default: {
    findById: monthlyAssignmentFindByIdMock,
  },
  ASSIGNMENT_STATUSES: ["draft", "published", "archived"],
  TASK_RESOURCE_MODES: ["internal", "external_url", "uploaded"],
  CONTENT_BLOCK_TYPES: [
    "title",
    "instruction",
    "video",
    "internal",
    "passage",
    "quiz",
    "matching",
    "gapfill",
    "find_mistake",
    "dictation",
    "answer",
    "input",
  ],
}));

vi.mock("../../models/HomeworkGroup.model.js", () => ({
  default: {
    find: homeworkGroupFindMock,
  },
}));

vi.mock("../../models/MonthlyAssignmentSubmission.model.js", () => ({
  default: {
    find: monthlySubmissionFindMock,
  },
}));

vi.mock("../../models/HomeworkRewardClaim.model.js", () => ({
  default: {
    find: rewardClaimFindMock,
    create: rewardClaimCreateMock,
    deleteOne: rewardClaimDeleteOneMock,
  },
}));

vi.mock("../../services/gamification.service.js", () => ({
  addXP: addXPMock,
}));

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
  };
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const createFindByIdQuery = (value) => ({
  populate: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

const createSelectLeanQuery = (value) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value),
  }),
});

const createLeanQuery = (value) => ({
  lean: vi.fn().mockResolvedValue(value),
});

const TASK_IDS = [
  "507f191e810c19729de860f1",
  "507f191e810c19729de860f2",
  "507f191e810c19729de860f3",
];

const buildAssignment = () => ({
  _id: "507f191e810c19729de860ea",
  status: "published",
  target_group_ids: [{ _id: "group-1" }],
  sections: [
    {
      _id: "section-1",
      is_published: true,
      order: 0,
      lessons: [
        { _id: TASK_IDS[0], name: "Lesson 1", order: 0, is_published: true },
        { _id: TASK_IDS[1], name: "Lesson 2", order: 1, is_published: true },
        { _id: TASK_IDS[2], name: "Lesson 3", order: 2, is_published: true },
      ],
    },
  ],
});

let claimMyHomeworkChestReward;

beforeAll(async () => {
  const module = await import("../../controllers/homework.controller.js");
  claimMyHomeworkChestReward = module.claimMyHomeworkChestReward;
});

beforeEach(() => {
  vi.clearAllMocks();
  homeworkGroupFindMock.mockReturnValue(createSelectLeanQuery([{ _id: "group-1" }]));
  monthlyAssignmentFindByIdMock.mockReturnValue(createFindByIdQuery(buildAssignment()));
  rewardClaimDeleteOneMock.mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  addXPMock.mockResolvedValue({
    currentXP: 200,
    currentLevel: 1,
    levelUp: false,
    xpGained: 200,
  });
});

describe("claimMyHomeworkChestReward", () => {
  it("rejects locked chest when student has not completed enough lessons", async () => {
    monthlySubmissionFindMock.mockReturnValue(
      createLeanQuery([
        { task_id: TASK_IDS[0], status: "submitted" },
        { task_id: TASK_IDS[1], status: "submitted" },
      ]),
    );
    rewardClaimFindMock.mockReturnValue(createLeanQuery([]));

    const req = {
      params: {
        assignmentId: "507f191e810c19729de860ea",
        chestKey: "chest-3",
      },
      user: {
        userId: "student-1",
      },
    };
    const res = createResponse();

    await claimMyHomeworkChestReward(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body?.success).toBe(false);
    expect(rewardClaimCreateMock).not.toHaveBeenCalled();
    expect(addXPMock).not.toHaveBeenCalled();
  });

  it("creates claim and grants xp when chest is unlocked", async () => {
    monthlySubmissionFindMock.mockReturnValue(
      createLeanQuery([
        { task_id: TASK_IDS[0], status: "submitted" },
        { task_id: TASK_IDS[1], status: "submitted" },
        { task_id: TASK_IDS[2], status: "submitted" },
      ]),
    );
    rewardClaimFindMock.mockReturnValue(createLeanQuery([]));
    rewardClaimCreateMock.mockResolvedValue({
      _id: "claim-1",
      chest_key: "chest-3",
      claimed_at: new Date("2026-03-09T10:00:00.000Z"),
    });

    const req = {
      params: {
        assignmentId: "507f191e810c19729de860ea",
        chestKey: "chest-3",
      },
      user: {
        userId: "student-1",
      },
    };
    const res = createResponse();

    await claimMyHomeworkChestReward(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.chest_key).toBe("chest-3");
    expect(res.body?.data?.claimed).toBe(true);
    expect(res.body?.data?.xp_gained).toBe(200);
    expect(rewardClaimCreateMock).toHaveBeenCalledTimes(1);
    expect(addXPMock).toHaveBeenCalledWith("student-1", 200, "homework_chest");
  });

  it("returns idempotent success when chest already claimed", async () => {
    monthlySubmissionFindMock.mockReturnValue(
      createLeanQuery([
        { task_id: TASK_IDS[0], status: "submitted" },
        { task_id: TASK_IDS[1], status: "submitted" },
        { task_id: TASK_IDS[2], status: "submitted" },
      ]),
    );
    rewardClaimFindMock.mockReturnValue(
      createLeanQuery([
        {
          _id: "claim-1",
          chest_key: "chest-3",
          claimed_at: new Date("2026-03-09T10:00:00.000Z"),
        },
      ]),
    );

    const req = {
      params: {
        assignmentId: "507f191e810c19729de860ea",
        chestKey: "chest-3",
      },
      user: {
        userId: "student-1",
      },
    };
    const res = createResponse();

    await claimMyHomeworkChestReward(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.xp_gained).toBe(0);
    expect(rewardClaimCreateMock).not.toHaveBeenCalled();
    expect(addXPMock).not.toHaveBeenCalled();
  });
});
