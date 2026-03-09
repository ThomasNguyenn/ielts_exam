import { beforeEach, describe, expect, it, vi } from "vitest";

const buildQuery = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

const { homeworkGroupModel, monthlyAssignmentModel, monthlyAssignmentSubmissionModel } = vi.hoisted(() => ({
  homeworkGroupModel: {
    find: vi.fn(),
  },
  monthlyAssignmentModel: {
    findById: vi.fn(),
    find: vi.fn(),
  },
  monthlyAssignmentSubmissionModel: {
    find: vi.fn(),
  },
}));

vi.mock("../../models/HomeworkGroup.model.js", () => ({
  default: homeworkGroupModel,
}));

vi.mock("../../models/MonthlyAssignment.model.js", () => ({
  default: monthlyAssignmentModel,
}));

vi.mock("../../models/MonthlyAssignmentSubmission.model.js", () => ({
  default: monthlyAssignmentSubmissionModel,
}));

import {
  issueHomeworkContextToken,
  resolveHomeworkTaskMapping,
} from "../../services/homeworkTrackingBridge.service.js";

const STUDENT_ID = "507f1f77bcf86cd799439011";
const ASSIGNMENT_ID = "507f1f77bcf86cd799439012";
const TASK_ID = "507f1f77bcf86cd799439013";
const GROUP_ID = "507f1f77bcf86cd799439014";

const buildAssignmentWithSharedRefs = () => ({
  _id: ASSIGNMENT_ID,
  status: "published",
  target_group_ids: [GROUP_ID],
  sections: [],
  tasks: [
    {
      _id: TASK_ID,
      resource_mode: "internal",
      content_blocks: [
        {
          type: "internal",
          data: {
            block_id: "block-a",
            resource_slot_key: "slot:a",
            resource_ref_type: "test",
            resource_ref_id: "shared-test-id",
          },
        },
        {
          type: "internal",
          data: {
            block_id: "block-b",
            resource_slot_key: "slot:b",
            resource_ref_type: "test",
            resource_ref_id: "shared-test-id",
          },
        },
      ],
    },
  ],
});

describe("homeworkTrackingBridge.service slot mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homeworkGroupModel.find.mockReturnValue(buildQuery([{ _id: GROUP_ID }]));
    monthlyAssignmentModel.findById.mockReturnValue(buildQuery(buildAssignmentWithSharedRefs()));
    monthlyAssignmentModel.find.mockReturnValue(buildQuery([]));
    monthlyAssignmentSubmissionModel.find.mockReturnValue(buildQuery([]));
  });

  it("rejects ambiguous multi-slot hwctx mapping when slot identity is missing", async () => {
    const hwctx = issueHomeworkContextToken({
      studentId: STUDENT_ID,
      assignmentId: ASSIGNMENT_ID,
      taskId: TASK_ID,
      resourceRefType: "test",
      resourceRefId: "shared-test-id",
      // no resource_slot_key and no resource_block_id
    });

    const mapping = await resolveHomeworkTaskMapping({
      studentId: STUDENT_ID,
      resourceRefType: "test",
      resourceRefId: "shared-test-id",
      hwctx,
    });

    expect(mapping).toBeNull();
  });

  it("resolves multi-slot mapping when hwctx includes explicit resource_slot_key", async () => {
    const hwctx = issueHomeworkContextToken({
      studentId: STUDENT_ID,
      assignmentId: ASSIGNMENT_ID,
      taskId: TASK_ID,
      resourceRefType: "test",
      resourceRefId: "shared-test-id",
      resourceSlotKey: "slot:b",
      resourceBlockId: "block-b",
    });

    const mapping = await resolveHomeworkTaskMapping({
      studentId: STUDENT_ID,
      resourceRefType: "test",
      resourceRefId: "shared-test-id",
      hwctx,
    });

    expect(mapping).toBeTruthy();
    expect(mapping?.resource_slot_key).toBe("slot:b");
    expect(mapping?.resource_block_id).toBe("block-b");
    expect(mapping?.resource_ref_id).toBe("shared-test-id");
  });
});

