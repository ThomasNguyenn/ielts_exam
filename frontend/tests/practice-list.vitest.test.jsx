import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PracticeList from '../src/features/practice/pages/PracticeList.jsx';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getWritings: vi.fn(),
  },
}));

vi.mock('@/shared/api/client', () => ({
  api: mockApi,
}));

const buildRows = (count = 14) => {
  const rows = [
    {
      _id: 'w-1',
      title: 'Education Reform',
      prompt: 'Some people think school curricula should focus on practical skills.',
      task_type: 'task2',
      writing_task_type: 'agree_disagree',
      image_url: 'https://cdn.example.com/writing/education.jpg',
    },
    {
      _id: 'w-2',
      title: 'City Transport Chart',
      prompt: 'Summarize the bar chart showing public transport usage over ten years.',
      task_type: 'task1',
      writing_task_type: 'bar_chart',
    },
    {
      _id: 'w-3',
      title: 'Technology in Schools',
      prompt: 'Discuss both views on using tablets in classrooms.',
      task_type: 'task2',
      writing_task_type: 'discuss_both_views',
    },
  ];

  for (let i = 4; i <= count; i += 1) {
    rows.push({
      _id: `w-${i}`,
      title: `Prompt ${i}`,
      prompt: `Practice prompt ${i}`,
      task_type: i % 2 === 0 ? 'task1' : 'task2',
      writing_task_type: i % 2 === 0 ? 'line_chart' : 'solutions',
    });
  }

  return rows;
};

const renderPage = () => render(
  <MemoryRouter>
    <PracticeList />
  </MemoryRouter>,
);

describe('PracticeList page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getWritings.mockResolvedValue({ success: true, data: buildRows() });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads writings and renders Writing Excellence hero', async () => {
    renderPage();

    expect(await screen.findByText('Writing Excellence')).toBeInTheDocument();
    expect(await screen.findByText('Education Reform')).toBeInTheDocument();
    expect(mockApi.getWritings).toHaveBeenCalledTimes(1);
  });

  it('debounces search and filters by title and prompt', async () => {
    renderPage();
    await screen.findByText('Writing Excellence');

    const input = screen.getByPlaceholderText("Find a writing prompt (e.g. 'Education', 'Technology')");
    fireEvent.change(input, { target: { value: 'transport' } });

    await waitFor(() => {
      expect(screen.getByText('City Transport Chart')).toBeInTheDocument();
      expect(screen.queryByText('Education Reform')).not.toBeInTheDocument();
    }, { timeout: 1800 });
  });

  it('filters by Task 1 and Task 2 buttons', async () => {
    renderPage();
    await screen.findByText('Writing Excellence');

    fireEvent.click(screen.getByRole('button', { name: /Task 1: Visual Report/i }));

    await waitFor(() => {
      expect(screen.getByText('City Transport Chart')).toBeInTheDocument();
      expect(screen.queryByText('Education Reform')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Task 2: Essay/i }));

    await waitFor(() => {
      expect(screen.getByText('Education Reform')).toBeInTheDocument();
      expect(screen.queryByText('City Transport Chart')).not.toBeInTheDocument();
    });
  });

  it('renders writing-task-type pills and applies category filter', async () => {
    renderPage();
    await screen.findByText('Writing Excellence');

    fireEvent.click(screen.getByRole('button', { name: 'Agree or Disagree' }));

    await waitFor(() => {
      expect(screen.getByText('Education Reform')).toBeInTheDocument();
      expect(screen.queryByText('Technology in Schools')).not.toBeInTheDocument();
    });
  });

  it('changes cards when selecting page 2 in pagination', async () => {
    renderPage();
    await screen.findByText('Writing Excellence');

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(screen.getByText('Prompt 13')).toBeInTheDocument();
      expect(screen.queryByText('Education Reform')).not.toBeInTheDocument();
    });
  });

  it('keeps practice CTA linked to writing flow route', async () => {
    renderPage();

    const cta = (await screen.findAllByRole('link', { name: /Practice with AI/i }))[0];
    expect(cta).toHaveAttribute('href', '/practice/w-1');
  });

  it('renders card cover from backend image_url', async () => {
    renderPage();

    const heading = await screen.findByRole('heading', { name: 'Education Reform' });
    const card = heading.closest('.sp2-card');
    const cover = card?.querySelector('.sp2-card-cover');

    expect(cover).not.toBeNull();
    expect(cover).toHaveStyle({
      backgroundImage: 'url("https://cdn.example.com/writing/education.jpg")',
    });
  });
});
