import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadHomeroomHomeworkProgress, TODAY } from "../src/features/admin/data/homeworkProgress.data";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getUser: vi.fn(),
    getUsers: vi.fn(),
    homeworkGetAssignments: vi.fn(),
    homeworkGetAssignmentDashboard: vi.fn(),
  },
}));

vi.mock("@/shared/api/client", () => ({
  api: mockApi,
}));

const toIsoDateString = (day) => `${day}T00:00:00.000Z`;

describe("homeworkProgress.data grouped task mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const selectedMonth = String(TODAY).slice(0, 7);
    const yesterday = new Date(`${TODAY}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayDay = yesterday.toISOString().slice(0, 10);
    const tomorrow = new Date(`${TODAY}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDay = tomorrow.toISOString().slice(0, 10);

    mockApi.getUser.mockReturnValue({
      _id: "teacher-1",
      role: "teacher",
    });

    mockApi.getUsers.mockResolvedValue({
      data: [
        {
          _id: "student-1",
          name: "Alice",
          role: "student",
          homeroom_teacher_id: "teacher-1",
        },
      ],
      pagination: { hasNextPage: false },
    });

    mockApi.homeworkGetAssignments.mockResolvedValue({
      data: [
        {
          _id: "assignment-1",
          title: "Grouped Homework",
          status: "published",
          month: selectedMonth,
          due_date: toIsoDateString(TODAY),
        },
      ],
      pagination: { totalPages: 1 },
    });

    mockApi.homeworkGetAssignmentDashboard.mockResolvedValue({
      data: {
        assignment: {
          _id: "assignment-1",
          title: "Grouped Homework",
          month: selectedMonth,
          due_date: toIsoDateString(TODAY),
          tasks: [
            { _id: "task-a", title: "Task A", due_date: toIsoDateString(tomorrowDay) },
            { _id: "task-b", title: "Task B", due_date: toIsoDateString(yesterdayDay) },
          ],
        },
        students: [
          {
            _id: "student-1",
            tasks: [
              {
                task_id: "task-a",
                task_title: "Task A",
                task_due_date: tomorrowDay,
                status: "in_progress",
                done_count: 1,
                total_count: 2,
                group_id: "submission:sub-1",
                submission_id: "sub-1",
                homework_submission_id: "sub-1",
                submitted_at: `${TODAY}T08:00:00.000Z`,
                graded_at: null,
                score: null,
                internal_items: [
                  {
                    slot_key: "slot:a",
                    status: "completed",
                    completed_at: "2025-12-01T02:00:00.000Z",
                  },
                  {
                    slot_key: "slot:b",
                    status: "not_started",
                    completed_at: null,
                  },
                ],
              },
              {
                task_id: "task-b",
                task_title: "Task B",
                task_due_date: yesterdayDay,
                status: "not_started",
                done_count: 0,
                total_count: 1,
                group_id: `virtual:assignment-1:student-1:task-b`,
                submission_id: null,
                homework_submission_id: null,
                submitted_at: null,
                graded_at: null,
                score: null,
                internal_items: [],
              },
            ],
          },
        ],
      },
    });
  });

  it("keeps one grouped task row and does not split by internal slot completed_at day", async () => {
    const result = await loadHomeroomHomeworkProgress({ selectedDate: TODAY });

    expect(result.students).toHaveLength(1);
    const student = result.students[0];
    expect(student.missing).toBe(1);

    expect(student.assignments).toHaveLength(1);
    const assignment = student.assignments[0];
    expect(assignment.status).toBe("in_progress");
    expect(assignment.doneCount).toBe(1);
    expect(assignment.totalCount).toBe(3);
    expect(assignment.taskSubmissions).toHaveLength(2);
    expect(assignment.taskSubmissions[0].internal_items).toHaveLength(2);

    expect(result.dateOptions).toContain(TODAY);
    expect(result.dateOptions).not.toContain("2025-12-01");
  });
});
