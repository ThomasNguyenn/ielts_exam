import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  skillFind: vi.fn(),
  studentProgressAggregate: vi.fn(),
}));

vi.mock('../../models/SkillModule.model.js', () => ({
  default: {
    find: (...args) => mocks.skillFind(...args),
  },
}));

vi.mock('../../models/StudentProgress.model.js', () => ({
  default: {
    aggregate: (...args) => mocks.studentProgressAggregate(...args),
  },
}));

const createFindChain = (rows) => {
  const chain = {
    sort: vi.fn(() => chain),
    select: vi.fn(() => chain),
    lean: vi.fn(async () => rows),
  };
  return chain;
};

const createRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe('skills.controller catalog behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects invalid category query', async () => {
    const { getAllModules } = await import('../../controllers/skills.controller.js');
    const req = { query: { category: 'invalid-category' } };
    const res = createRes();

    await getAllModules(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.message).toContain('category must be one of');
    expect(mocks.skillFind).not.toHaveBeenCalled();
  });

  it('returns full categories summary and treats missing category as writing', async () => {
    mocks.skillFind.mockImplementation(() =>
      createFindChain([
        { category: 'listening', estimatedMinutes: 30 },
        { category: 'reading', estimatedMinutes: 25 },
        { category: '', estimatedMinutes: 15 },
        { estimatedMinutes: 40 },
      ]),
    );

    const { getCategories } = await import('../../controllers/skills.controller.js');
    const req = { query: {} };
    const res = createRes();

    await getCategories(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([
      { category: 'listening', moduleCount: 1, totalMinutes: 30 },
      { category: 'reading', moduleCount: 1, totalMinutes: 25 },
      { category: 'writing', moduleCount: 2, totalMinutes: 55 },
      { category: 'speaking', moduleCount: 0, totalMinutes: 0 },
    ]);
  });

  it('filters writing modules, strips unlockRequirement, and adds popularityCount', async () => {
    const modules = [
      {
        _id: 'module-1',
        title: 'Legacy writing module',
        category: '',
        difficulty: '',
        tag: '',
        path: '',
        unlockRequirement: { previousModule: 'old', minimumScore: 70 },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        _id: 'module-2',
        title: 'Writing module 2',
        category: 'writing',
        difficulty: 'advanced',
        tag: 'Strategy',
        path: 'Advanced Techniques',
        unlockRequirement: { previousModule: 'legacy' },
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ];

    mocks.skillFind.mockImplementation(() => createFindChain(modules));
    mocks.studentProgressAggregate.mockResolvedValue([
      { _id: 'module-1', count: 3 },
    ]);

    const { getAllModules } = await import('../../controllers/skills.controller.js');
    const req = { query: { category: 'writing' } };
    const res = createRes();

    await getAllModules(req, res);

    expect(mocks.skillFind).toHaveBeenCalledWith({
      isActive: true,
      $or: [
        { category: 'writing' },
        { category: { $exists: false } },
        { category: null },
        { category: '' },
      ],
    });

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(2);

    expect(payload.data[0].category).toBe('writing');
    expect(payload.data[0].difficulty).toBe('beginner');
    expect(payload.data[0].popularityCount).toBe(3);
    expect(payload.data[0]).not.toHaveProperty('unlockRequirement');

    expect(payload.data[1].category).toBe('writing');
    expect(payload.data[1].difficulty).toBe('advanced');
    expect(payload.data[1].popularityCount).toBe(0);
    expect(payload.data[1]).not.toHaveProperty('unlockRequirement');
  });
});
