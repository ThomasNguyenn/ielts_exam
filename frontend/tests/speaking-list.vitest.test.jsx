import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpeakingList from '../src/features/practice/pages/SpeakingList.jsx';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getSpeakings: vi.fn(),
  },
}));

vi.mock('@/shared/api/client', () => ({
  api: mockApi,
}));

const buildRows = () => ([
  {
    _id: 's-1',
    title: 'Education',
    part: 2,
    part2_question_title: 'Describe a teacher who influenced you',
    prompt: 'Legacy Part 2 prompt',
    sub_questions: ['You should say how this teacher helped you.'],
    image_url: 'https://cdn.example.com/speaking/teacher.jpg',
  },
  {
    _id: 's-2',
    title: 'Technology',
    part: 1,
    prompt: 'How often do you use the internet?',
    sub_questions: ['Mention your most common online activity.'],
  },
]);

const buildPagedResponse = (page = 1, rows = buildRows()) => ({
  data: rows,
  pagination: {
    page,
    limit: 12,
    totalPages: 3,
    totalItems: 30,
    hasPrevPage: page > 1,
    hasNextPage: page < 3,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SpeakingList />
    </MemoryRouter>,
  );

describe('SpeakingList page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getSpeakings.mockImplementation(async (params = {}) => {
      if (params.topicsOnly) {
        return { topics: ['Education', 'Technology', 'Environment'] };
      }

      return buildPagedResponse(Number(params.page || 1));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('loads topics and first page from backend', async () => {
    renderPage();

    expect(await screen.findByText('Speaking Excellence')).toBeInTheDocument();
    expect(await screen.findByText('Describe a teacher who influenced you')).toBeInTheDocument();
    expect(screen.queryByText('Legacy Part 2 prompt')).not.toBeInTheDocument();

    expect(mockApi.getSpeakings).toHaveBeenCalledWith(expect.objectContaining({ topicsOnly: true }));
    expect(mockApi.getSpeakings).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      limit: 12,
      q: undefined,
      part: undefined,
      topic: undefined,
    }));
  });

  it('debounces search and sends q param', async () => {
    renderPage();

    await screen.findByText('Speaking Excellence');

    const input = screen.getByPlaceholderText("Find a topic (e.g. 'Business', 'Travel')");
    fireEvent.change(input, { target: { value: 'climate' } });

    await waitFor(() => {
      expect(mockApi.getSpeakings).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        q: 'climate',
      }));
    }, { timeout: 1800 });
  });

  it('applies section filter with backend part param', async () => {
    renderPage();
    await screen.findByText('Speaking Excellence');

    fireEvent.click(screen.getByRole('button', { name: 'Part 2: Cue Card' }));

    await waitFor(() => {
      expect(mockApi.getSpeakings).toHaveBeenCalledWith(expect.objectContaining({
        part: '2',
      }));
    });
  });

  it('applies category filter with backend topic param', async () => {
    renderPage();
    await screen.findByText('Speaking Excellence');

    fireEvent.click(screen.getByRole('button', { name: 'Education' }));

    await waitFor(() => {
      expect(mockApi.getSpeakings).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'Education',
      }));
    });
  });

  it('changes page using numeric pagination', async () => {
    renderPage();
    await screen.findByText('Speaking Excellence');

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(mockApi.getSpeakings).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
      }));
    });
  });

  it('keeps practice CTA linked to speaking flow route', async () => {
    renderPage();

    const cta = (await screen.findAllByRole('link', { name: /Practice with AI/i }))[0];
    expect(cta).toHaveAttribute('href', '/practice/speaking/s-1');
  });

  it('renders card cover from backend image_url instead of hardcoded image list', async () => {
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'Describe a teacher who influenced you' });
    const card = heading.closest('.sp2-card');
    const cover = card?.querySelector('.sp2-card-cover');

    expect(cover).not.toBeNull();
    expect(cover).toHaveStyle({
      backgroundImage: 'url("https://cdn.example.com/speaking/teacher.jpg")',
    });
  });

  it('removes sample/target-band/ai-score blocks and material-symbol spans', async () => {
    renderPage();
    await screen.findByText('Speaking Excellence');

    expect(screen.queryByText(/View Sample Answer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Target Band/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI Score/i)).not.toBeInTheDocument();
    expect(document.querySelector('.material-symbols-outlined')).toBeNull();
  });
});
