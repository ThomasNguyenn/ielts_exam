import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadHomeroomHomeworkProgress, loadStaffDashboardData, TODAY } from "../src/features/admin/data/homeworkProgress.data";

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
    expect(student.pending).toBe(0);

    expect(student.assignments).toHaveLength(1);
    const assignment = student.assignments[0];
    expect(assignment.status).toBe("missing");
    expect(assignment.doneCount).toBe(1);
    expect(assignment.totalCount).toBe(3);
    expect(assignment.taskSubmissions).toHaveLength(2);
    expect(assignment.taskSubmissions[0].internal_items).toHaveLength(2);
    expect(assignment.taskSubmissions[0].submission_timing).toBe("on_time");
    expect(assignment.taskSubmissions[1].submission_timing).toBe("missing");

    expect(result.dateOptions).toContain(TODAY);
    expect(result.dateOptions).not.toContain("2025-12-01");
  });

  it("treats shifted ISO due date as the intended calendar day when checking missing", async () => {
    const selectedMonth = String(TODAY).slice(0, 7);
    const shiftedDueAt = `${TODAY}T23:59:59.999Z`;

    mockApi.homeworkGetAssignments.mockResolvedValue({
      data: [
        {
          _id: "assignment-shifted",
          title: "Shifted Due",
          status: "published",
          month: selectedMonth,
          due_date: shiftedDueAt,
        },
      ],
      pagination: { totalPages: 1 },
    });

    mockApi.homeworkGetAssignmentDashboard.mockResolvedValue({
      data: {
        assignment: {
          _id: "assignment-shifted",
          title: "Shifted Due",
          month: selectedMonth,
          due_date: shiftedDueAt,
          tasks: [
            {
              _id: "task-shifted",
              title: "Task Shifted",
              due_date: shiftedDueAt,
            },
          ],
        },
        students: [
          {
            _id: "student-1",
            tasks: [
              {
                task_id: "task-shifted",
                task_title: "Task Shifted",
                task_due_date: shiftedDueAt,
                status: "not_started",
                done_count: 0,
                total_count: 1,
                group_id: "virtual:assignment-shifted:student-1:task-shifted",
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

    const result = await loadHomeroomHomeworkProgress({ selectedDate: TODAY });
    const student = result.students[0];
    const assignment = student?.assignments?.[0];
    const task = assignment?.taskSubmissions?.[0];

    expect(student?.missing).toBe(1);
    expect(student?.pending).toBe(0);
    expect(assignment?.status).toBe("missing");
    expect(task?.task_due_date).toBe(TODAY);
    expect(task?.submission_timing).toBe("missing");
  });

  it("marks not submitted but not overdue tasks as pending/not_submitted", async () => {
    const selectedMonth = String(TODAY).slice(0, 7);
    const tomorrow = new Date(`${TODAY}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDay = tomorrow.toISOString().slice(0, 10);

    mockApi.homeworkGetAssignments.mockResolvedValue({
      data: [
        {
          _id: "assignment-pending",
          title: "Pending Due",
          status: "published",
          month: selectedMonth,
          due_date: toIsoDateString(tomorrowDay),
        },
      ],
      pagination: { totalPages: 1 },
    });

    mockApi.homeworkGetAssignmentDashboard.mockResolvedValue({
      data: {
        assignment: {
          _id: "assignment-pending",
          title: "Pending Due",
          month: selectedMonth,
          due_date: toIsoDateString(tomorrowDay),
          tasks: [
            {
              _id: "task-pending",
              title: "Task Pending",
              due_date: toIsoDateString(tomorrowDay),
            },
          ],
        },
        students: [
          {
            _id: "student-1",
            tasks: [
              {
                task_id: "task-pending",
                task_title: "Task Pending",
                task_due_date: tomorrowDay,
                status: "not_started",
                done_count: 0,
                total_count: 1,
                group_id: "virtual:assignment-pending:student-1:task-pending",
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

    const result = await loadHomeroomHomeworkProgress({ selectedDate: TODAY });
    const student = result.students[0];
    const assignment = student?.assignments?.[0];
    const task = assignment?.taskSubmissions?.[0];
    const daily = student?.dailyProgress?.[0];

    expect(student?.missing).toBe(0);
    expect(student?.pending).toBe(1);
    expect(daily?.missing).toBe(0);
    expect(daily?.pending).toBe(1);
    expect(task?.submission_timing).toBe("not_submitted");
  });

  it("staff chart counts notSubmitted as total students minus students who submitted that day", async () => {
    const selectedMonth = String(TODAY).slice(0, 7);
    const assignmentId = "assignment-staff";

    mockApi.getUsers.mockResolvedValue({
      data: [
        {
          _id: "student-1",
          name: "Alice",
          role: "student",
          homeroom_teacher_id: "teacher-1",
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
        {
          _id: "student-2",
          name: "Bob",
          role: "student",
          homeroom_teacher_id: "teacher-1",
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
      ],
      pagination: { hasNextPage: false },
    });

    mockApi.homeworkGetAssignments.mockResolvedValue({
      data: [
        {
          _id: assignmentId,
          title: "Staff Chart Homework",
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
          _id: assignmentId,
          title: "Staff Chart Homework",
          month: selectedMonth,
          due_date: toIsoDateString(TODAY),
          tasks: [{ _id: "task-1", title: "Task 1", due_date: toIsoDateString(TODAY) }],
        },
        students: [
          {
            _id: "student-1",
            tasks: [
              {
                task_id: "task-1",
                task_title: "Task 1",
                task_due_date: TODAY,
                status: "completed",
                done_count: 1,
                total_count: 1,
                group_id: "submission:sub-1",
                submission_id: "sub-1",
                homework_submission_id: "sub-1",
                submitted_at: `${TODAY}T08:00:00.000Z`,
                graded_at: null,
                score: null,
                internal_items: [],
              },
            ],
          },
          {
            _id: "student-2",
            tasks: [
              {
                task_id: "task-1",
                task_title: "Task 1",
                task_due_date: TODAY,
                status: "not_started",
                done_count: 0,
                total_count: 1,
                group_id: `virtual:${assignmentId}:student-2:task-1`,
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

    const result = await loadStaffDashboardData({ rangeDays: 7, scope: "homeroom" });
    const todayEntry = (result?.submissionStackedSeries || []).find((entry) => entry?.date === TODAY);

    expect(result?.stats?.totalStudents).toBe(2);
    expect(todayEntry?.submitted).toBe(1);
    expect(todayEntry?.notSubmitted).toBe(1);
  });
});
