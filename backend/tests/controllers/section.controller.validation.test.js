import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sectionSaveMock = vi.fn();
const sectionFindByIdMock = vi.fn();
const sectionFindByIdAndUpdateMock = vi.fn();

const SectionMock = vi.fn().mockImplementation(function Section(payload) {
  this.payload = payload;
  this.save = sectionSaveMock;
});
SectionMock.findById = (...args) => sectionFindByIdMock(...args);
SectionMock.findByIdAndUpdate = (...args) => sectionFindByIdAndUpdateMock(...args);

vi.mock("../../models/Section.model.js", () => ({
  default: SectionMock,
}));

vi.mock("../../services/objectStorage.service.js", () => ({
  buildSectionAudioObjectKey: vi.fn(),
  deleteSectionAudioObject: vi.fn(),
  isObjectStorageConfigured: vi.fn(() => true),
  uploadSectionAudioObject: vi.fn(),
}));

const createRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

let createSection;
let updateSection;

beforeAll(async () => {
  const module = await import("../../controllers/section.controller.js");
  createSection = module.createSection;
  updateSection = module.updateSection;
});

beforeEach(() => {
  vi.clearAllMocks();
  sectionSaveMock.mockResolvedValue(undefined);
  sectionFindByIdMock.mockResolvedValue({ _id: "s-1", audio_storage_key: null });
  sectionFindByIdAndUpdateMock.mockResolvedValue({ _id: "s-1" });
});

describe("section.controller objective answer validation", () => {
  it("createSection rejects unresolved option token with 400", async () => {
    const req = {
      body: {
        _id: "s-1",
        title: "Section title",
        content: "Section content",
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

    await createSection(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sectionSaveMock).not.toHaveBeenCalled();
  });

  it("updateSection rejects unresolved option token with 400", async () => {
    const req = {
      params: { id: "s-1" },
      body: {
        question_groups: [
          {
            type: "summary_completion",
            options: [
              { id: "A", text: "Green field" },
              { id: "B", text: "Blue lake" },
            ],
            questions: [
              { q_number: 2, correct_answers: ["C"] },
            ],
          },
        ],
      },
    };
    const res = createRes();

    await updateSection(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sectionFindByIdMock).not.toHaveBeenCalled();
    expect(sectionFindByIdAndUpdateMock).not.toHaveBeenCalled();
  });
});
