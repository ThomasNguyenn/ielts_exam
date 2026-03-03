import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sectionFindByIdMock = vi.fn();
const sectionFindByIdAndUpdateMock = vi.fn();
const sectionFindByIdAndDeleteMock = vi.fn();

const buildSectionAudioObjectKeyMock = vi.fn();
const deleteSectionAudioObjectMock = vi.fn();
const isObjectStorageConfiguredMock = vi.fn();
const uploadSectionAudioObjectMock = vi.fn();

vi.mock("../../models/Section.model.js", () => ({
  default: {
    findById: (...args) => sectionFindByIdMock(...args),
    findByIdAndUpdate: (...args) => sectionFindByIdAndUpdateMock(...args),
    findByIdAndDelete: (...args) => sectionFindByIdAndDeleteMock(...args),
  },
}));

vi.mock("../../services/objectStorage.service.js", () => ({
  buildSectionAudioObjectKey: (...args) => buildSectionAudioObjectKeyMock(...args),
  deleteSectionAudioObject: (...args) => deleteSectionAudioObjectMock(...args),
  isObjectStorageConfigured: (...args) => isObjectStorageConfiguredMock(...args),
  uploadSectionAudioObject: (...args) => uploadSectionAudioObjectMock(...args),
}));

const createRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

let uploadSectionAudio;
let updateSection;
let deleteSection;

beforeAll(async () => {
  const module = await import("../../controllers/section.controller.js");
  uploadSectionAudio = module.uploadSectionAudio;
  updateSection = module.updateSection;
  deleteSection = module.deleteSection;
});

beforeEach(() => {
  vi.clearAllMocks();
  isObjectStorageConfiguredMock.mockReturnValue(true);
  buildSectionAudioObjectKeyMock.mockReturnValue("sections/audio/sec-1/123-file.mp3");
  uploadSectionAudioObjectMock.mockResolvedValue({
    key: "sections/audio/sec-1/123-file.mp3",
    url: "https://cdn.example.com/sections/audio/sec-1/123-file.mp3",
  });
  deleteSectionAudioObjectMock.mockResolvedValue({ deleted: true });
});

describe("section.controller object storage flows", () => {
  it("uploadSectionAudio returns 503 when storage config is missing", async () => {
    isObjectStorageConfiguredMock.mockReturnValue(false);
    const req = {
      file: {
        originalname: "sample.mp3",
        mimetype: "audio/mpeg",
        size: 1234,
        buffer: Buffer.from("a"),
      },
      body: { section_id: "sec-1" },
    };
    const res = createRes();

    await uploadSectionAudio(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(uploadSectionAudioObjectMock).not.toHaveBeenCalled();
  });

  it("uploadSectionAudio uploads and returns url/key payload", async () => {
    const req = {
      file: {
        originalname: "sample.mp3",
        mimetype: "audio/mpeg",
        size: 1234,
        buffer: Buffer.from("a"),
      },
      body: { section_id: "sec-1" },
    };
    const res = createRes();

    await uploadSectionAudio(req, res);

    expect(buildSectionAudioObjectKeyMock).toHaveBeenCalledWith({
      sectionId: "sec-1",
      originalFileName: "sample.mp3",
    });
    expect(uploadSectionAudioObjectMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.url).toContain("https://cdn.example.com/");
    expect(payload.data.key).toContain("sections/audio/");
  });

  it("updateSection deletes old key when a new key is provided", async () => {
    sectionFindByIdMock.mockResolvedValue({
      _id: "sec-1",
      audio_storage_key: "sections/audio/sec-1/old.mp3",
    });
    sectionFindByIdAndUpdateMock.mockResolvedValue({
      _id: "sec-1",
      audio_storage_key: "sections/audio/sec-1/new.mp3",
    });

    const req = {
      params: { id: "sec-1" },
      body: { audio_storage_key: "sections/audio/sec-1/new.mp3" },
    };
    const res = createRes();

    await updateSection(req, res);

    expect(deleteSectionAudioObjectMock).toHaveBeenCalledWith("sections/audio/sec-1/old.mp3");
    expect(sectionFindByIdAndUpdateMock).toHaveBeenCalledWith(
      "sec-1",
      expect.objectContaining({
        $set: expect.objectContaining({ audio_storage_key: "sections/audio/sec-1/new.mp3" }),
      }),
      expect.objectContaining({ new: true, runValidators: true }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updateSection does not delete storage key when audio_storage_key is not in payload", async () => {
    sectionFindByIdMock.mockResolvedValue({
      _id: "sec-1",
      audio_storage_key: "sections/audio/sec-1/old.mp3",
    });
    sectionFindByIdAndUpdateMock.mockResolvedValue({
      _id: "sec-1",
      title: "Updated title",
      audio_storage_key: "sections/audio/sec-1/old.mp3",
    });

    const req = {
      params: { id: "sec-1" },
      body: { title: "Updated title" },
    };
    const res = createRes();

    await updateSection(req, res);

    expect(deleteSectionAudioObjectMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("deleteSection continues even when object deletion fails", async () => {
    sectionFindByIdMock.mockResolvedValue({
      _id: "sec-1",
      audio_storage_key: "sections/audio/sec-1/old.mp3",
    });
    deleteSectionAudioObjectMock.mockRejectedValue(new Error("storage unavailable"));
    sectionFindByIdAndDeleteMock.mockResolvedValue({ _id: "sec-1" });

    const req = { params: { id: "sec-1" } };
    const res = createRes();

    await deleteSection(req, res);

    expect(deleteSectionAudioObjectMock).toHaveBeenCalledWith("sections/audio/sec-1/old.mp3");
    expect(sectionFindByIdAndDeleteMock).toHaveBeenCalledWith("sec-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
