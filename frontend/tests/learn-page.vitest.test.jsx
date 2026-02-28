import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LearnPage from '../src/features/learn/pages/LearnPage.jsx';

const { mockApi, mockShowNotification, mockNavigate } = vi.hoisted(() => ({
  mockApi: {
    getSkillCategories: vi.fn(),
    getMyProgress: vi.fn(),
    getSkillModules: vi.fn(),
  },
  mockShowNotification: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  api: mockApi,
}));

vi.mock('@/shared/context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <LearnPage />
    </MemoryRouter>,
  );

describe('LearnPage catalog', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getSkillCategories.mockResolvedValue({
      data: [
        { category: 'writing', moduleCount: 2, totalMinutes: 55 },
        { category: 'speaking', moduleCount: 1, totalMinutes: 20 },
      ],
    });

    mockApi.getMyProgress.mockResolvedValue({
      data: {
        completedModules: [{ moduleId: 'module-1' }],
      },
    });

    mockApi.getSkillModules.mockImplementation((category) => {
      if (category === 'speaking') {
        return Promise.resolve({
          data: [
            {
              _id: 'module-sp-1',
              title: 'Speaking Drill',
              description: 'Build confidence for part 2.',
              category: 'speaking',
              difficulty: 'intermediate',
              tag: 'Fluency',
              path: 'Speaking Path',
              estimatedMinutes: 20,
              popularityCount: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
              order: 1,
            },
          ],
        });
      }

      return Promise.resolve({
        data: [
          {
            _id: 'module-1',
            title: 'Task 2 Foundations',
            description: 'Understand essay structure and planning.',
            category: 'writing',
            difficulty: 'beginner',
            tag: 'Strategy',
            path: 'Foundation',
            estimatedMinutes: 25,
            popularityCount: 8,
            createdAt: '2026-02-10T00:00:00.000Z',
            order: 1,
          },
          {
            _id: 'module-2',
            title: 'Advanced Cohesion',
            description: 'Improve coherence and lexical linking devices.',
            category: 'writing',
            difficulty: 'advanced',
            tag: 'Vocabulary',
            path: 'Advanced Techniques',
            estimatedMinutes: 30,
            popularityCount: 5,
            createdAt: '2026-02-11T00:00:00.000Z',
            order: 2,
          },
        ],
      });
    });
  });

  it('renders writing catalog, grouped paths, and completed CTA', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Writing Skills' })).toBeInTheDocument();
    expect(await screen.findByText('Task 2 Foundations')).toBeInTheDocument();
    expect(screen.getByText('Advanced Cohesion')).toBeInTheDocument();
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Advanced Techniques')).toBeInTheDocument();
    expect(screen.getByText(/Completed/)).toBeInTheDocument();

    expect(mockApi.getSkillModules).toHaveBeenCalledWith('writing');
  });

  it('loads modules for selected category', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Writing Skills' });

    fireEvent.click(screen.getAllByRole('button', { name: /Speaking/i })[0]);

    await waitFor(() => {
      expect(mockApi.getSkillModules).toHaveBeenCalledWith('speaking');
    });

    expect(await screen.findByRole('heading', { name: 'Speaking Skills' })).toBeInTheDocument();
    expect(await screen.findByText('Speaking Drill')).toBeInTheDocument();
  });
});
