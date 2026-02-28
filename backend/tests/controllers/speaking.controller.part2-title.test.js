import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructorPayloads: [],
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn(),
}));

vi.mock("../../models/Speaking.model.js", () => {
  class MockSpeaking {
    constructor(payload) {
      this.payload = payload;
      Object.assign(this, payload);
      mocks.constructorPayloads.push(payload);
    }

    save = vi.fn(async () => ({ ...this.payload }));

    static findById(...args) {
      return mocks.findById(...args);
    }

    static findByIdAndUpdate(...args) {
      return mocks.findByIdAndUpdate(...args);
    }

    static find(...args) {
      return mocks.find(...args);
    }

    static countDocuments(...args) {
      return mocks.countDocuments(...args);
    }
  }

  return { default: MockSpeaking };
});

vi.mock("../../models/SpeakingSession.js", () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../../utils/cloudinary.js", () => ({
  default: {
    uploader: {
      upload_stream: vi.fn(),
    },
  },
}));

vi.mock("../../config/queue.config.js", () => ({
  isAiAsyncModeEnabled: vi.fn(() => false),
}));

vi.mock("../../queues/ai.queue.js", () => ({
  enqueueSpeakingAiScoreJob: vi.fn(),
  isAiQueueReady: vi.fn(() => false),
}));

vi.mock("../../services/speakingGrading.service.js", () => ({
  scoreSpeakingSessionById: vi.fn(),
  generateMockExaminerFollowUp: vi.fn(),
}));

vi.mock("../../services/speakingFastScore.service.js", () => ({
  evaluateSpeakingProvisionalScore: vi.fn(),
}));

vi.mock("../../services/speakingReadAloud.service.js", () => ({
  ensurePart3ConversationScript: vi.fn(),
  generatePromptReadAloudPreview: vi.fn(),
}));

const buildRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("speaking.controller Part 2 question title", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.constructorPayloads.length = 0;
  });

  it("creates Part 2 topic with prompt mirrored from part2_question_title", async () => {
    const { createSpeaking } = await import("../../controllers/speaking.controller.js");
    const req = {
      body: {
        _id: "sp-p2-1",
        title: "Education",
        part: 2,
        part2_question_title: "Describe a teacher who influenced you",
      },
    };
    const res = buildRes();

    await createSpeaking(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mocks.constructorPayloads).toHaveLength(1);
    expect(mocks.constructorPayloads[0]).toMatchObject({
      _id: "sp-p2-1",
      title: "Education",
      part: 2,
      part2_question_title: "Describe a teacher who influenced you",
      prompt: "Describe a teacher who influenced you",
    });
  });

  it("updates Part 2 question title and keeps prompt mirrored", async () => {
    mocks.findById.mockResolvedValue({
      _id: "sp-p2-2",
      part: 2,
      title: "Education",
      prompt: "Old prompt",
      part2_question_title: "Old prompt",
    });
    mocks.findByIdAndUpdate.mockResolvedValue({ _id: "sp-p2-2" });

    const { updateSpeaking } = await import("../../controllers/speaking.controller.js");
    const req = {
      params: { id: "sp-p2-2" },
      body: {
        part2_question_title: "Describe a teacher you admire",
      },
    };
    const res = buildRes();

    await updateSpeaking(req, res);

    expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(
      "sp-p2-2",
      expect.objectContaining({
        part2_question_title: "Describe a teacher you admire",
        prompt: "Describe a teacher you admire",
      }),
      { new: true },
    );
  });

  it("clears part2_question_title when switching topic to non-Part-2", async () => {
    mocks.findById.mockResolvedValue({
      _id: "sp-p2-3",
      part: 2,
      title: "Education",
      prompt: "Describe a teacher",
      part2_question_title: "Describe a teacher",
    });
    mocks.findByIdAndUpdate.mockResolvedValue({ _id: "sp-p2-3" });

    const { updateSpeaking } = await import("../../controllers/speaking.controller.js");
    const req = {
      params: { id: "sp-p2-3" },
      body: {
        part: 1,
        title: "Hometown",
        prompt: "Do you like your hometown?",
      },
    };
    const res = buildRes();

    await updateSpeaking(req, res);

    expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(
      "sp-p2-3",
      expect.objectContaining({
        part: 1,
        part2_question_title: "",
        prompt: "Do you like your hometown?",
      }),
      { new: true },
    );
  });

  it("search query includes part2_question_title in catalog filter", async () => {
    mocks.find.mockImplementation(() => ({
      sort: vi.fn().mockResolvedValue([]),
    }));

    const { getSpeakings } = await import("../../controllers/speaking.controller.js");
    const req = {
      query: {
        q: "teacher",
      },
    };
    const res = buildRes();

    await getSpeakings(req, res);

    expect(mocks.find).toHaveBeenCalledTimes(1);
    const filter = mocks.find.mock.calls[0][0];
    expect(Array.isArray(filter.$or)).toBe(true);
    expect(filter.$or.some((entry) => Object.prototype.hasOwnProperty.call(entry, "part2_question_title"))).toBe(true);
  });
});

