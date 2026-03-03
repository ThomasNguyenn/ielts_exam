import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const passageSaveMock = vi.fn();
const passageFindByIdAndUpdateMock = vi.fn();

const PassageMock = vi.fn().mockImplementation(function Passage(payload) {
  this.payload = payload;
  this.save = passageSaveMock;
});
PassageMock.findByIdAndUpdate = (...args) => passageFindByIdAndUpdateMock(...args);

vi.mock("../../models/Passage.model.js", () => ({
  default: PassageMock,
}));

const createRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

let createPassage;
let updatePassage;

beforeAll(async () => {
  const module = await import("../../controllers/passage.controller.js");
  createPassage = module.createPassage;
  updatePassage = module.updatePassage;
});

beforeEach(() => {
  vi.clearAllMocks();
  passageSaveMock.mockResolvedValue(undefined);
  passageFindByIdAndUpdateMock.mockResolvedValue({ _id: "p-1" });
});

describe("passage.controller objective answer validation", () => {
  it("createPassage rejects unresolved option token with 400", async () => {
    const req = {
      body: {
        _id: "p-1",
        title: "Passage title",
        content: "Passage content",
        question_groups: [
          {
            type: "matching_information",
            headings: [
              { id: "A", text: "Option A" },
              { id: "B", text: "Option B" },
            ],
            questions: [
              { q_number: 1, correct_answers: ["Z"] },
            ],
          },
        ],
      },
    };
    const res = createRes();

    await createPassage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(passageSaveMock).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload?.error?.code).toBe("INVALID_OBJECTIVE_ANSWER_MAPPING");
    expect(payload?.error?.details?.[0]).toMatchObject({
      groupIndex: 0,
      questionNumber: 1,
      invalidToken: "Z",
    });
  });

  it("updatePassage rejects unresolved option token with 400", async () => {
    const req = {
      params: { id: "p-1" },
      body: {
        question_groups: [
          {
            type: "mult_choice",
            questions: [
              {
                q_number: 2,
                option: [
                  { label: "A", text: "Alpha" },
                  { label: "B", text: "Beta" },
                ],
                correct_answers: ["C"],
              },
            ],
          },
        ],
      },
    };
    const res = createRes();

    await updatePassage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(passageFindByIdAndUpdateMock).not.toHaveBeenCalled();
  });
});
