import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LearnModuleDetail from '../src/features/learn/pages/LearnModuleDetail.jsx';

const { mockApi, mockShowNotification } = vi.hoisted(() => ({
  mockApi: {
    getSkillModule: vi.fn(),
    getMyProgress: vi.fn(),
    submitSkillQuiz: vi.fn(),
    markModuleComplete: vi.fn(),
  },
  mockShowNotification: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  api: mockApi,
}));

vi.mock('@/shared/context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

const renderAtModule = () =>
  render(
    <MemoryRouter initialEntries={['/learn/module-1']}>
      <Routes>
        <Route path="/learn" element={<div>Learn Catalog Page</div>} />
        <Route path="/learn/:moduleId" element={<LearnModuleDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe('LearnModuleDetail flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getSkillModule.mockResolvedValue({
      data: {
        _id: 'module-1',
        title: 'Writing Foundations',
        estimatedMinutes: 20,
        content: {
          lesson: 'Lesson content',
          examples: [],
          keyPoints: [],
          resources: [],
          checkpointQuiz: [
            {
              question: 'What is thesis statement?',
              options: ['Main idea', 'Grammar rule'],
              correctAnswer: 0,
              explanation: 'A thesis statement presents your main argument.',
            },
          ],
        },
      },
    });

    mockApi.getMyProgress.mockResolvedValue({
      data: { completedModules: [] },
    });

    mockApi.submitSkillQuiz.mockResolvedValue({
      success: true,
      score: 100,
      passed: true,
      totalQuestions: 1,
      correctCount: 1,
      results: [{ isCorrect: true, correctAnswer: 0, explanation: '' }],
    });

    mockApi.markModuleComplete.mockResolvedValue({ success: true });
  });

  it('loads module, completes quiz, and navigates back to /learn', async () => {
    renderAtModule();

    expect(await screen.findByText('Writing Foundations')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Take Quiz' }));

    expect(await screen.findByText('What is thesis statement?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /AMain idea/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Quiz' }));

    fireEvent.click(await screen.findByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(mockApi.markModuleComplete).toHaveBeenCalledWith('module-1', 100);
    });

    expect(await screen.findByText('Learn Catalog Page')).toBeInTheDocument();
  });
});
