import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecordingPhase from '../src/features/practice/pages/RecordingPhase.jsx';

const { showNotificationMock } = vi.hoisted(() => ({
  showNotificationMock: vi.fn(),
}));

vi.mock('@/shared/context/NotificationContext', () => ({
  useNotification: () => ({
    showNotification: showNotificationMock,
  }),
}));

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  constructor(stream, options = {}) {
    this.stream = stream;
    this.options = options;
    this.mimeType = options.mimeType || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }

  start() {
    this.state = 'recording';
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    const chunk = new Blob(['audio-chunk'], { type: this.mimeType });
    this.ondataavailable?.({ data: chunk });
    this.onstop?.();
  }
}

class FakeAudioContext {
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 64,
      getByteFrequencyData(data) {
        data.fill(120);
      },
    };
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
    };
  }

  close() {
    return Promise.resolve();
  }
}

const buildPart2Topic = () => ({
  _id: 'sp-p2',
  part: 2,
  title: 'Education',
  part2_question_title: 'Describe a journey you went on that was longer than you expected.',
  prompt: 'Legacy prompt text',
  cue_card: 'Where it happened\nWho you went with\nWhy the journey took longer than expected',
  sub_questions: [],
});

const buildPart1Topic = () => ({
  _id: 'sp-p1',
  part: 'part1',
  title: 'Hometown',
  prompt: 'Do you like your hometown?',
  sub_questions: ['What do you like most about it?', 'Would you like to live there in the future?'],
});

const buildPart3Topic = () => ({
  _id: 'sp-p3',
  part: 3,
  title: 'Environment',
  prompt: 'Let us discuss environmental awareness.',
  sub_questions: [],
  conversation_script: {
    questions: [
      { type: 'q1', text: 'Why should cities invest in greener transport?', audio_url: null },
      { type: 'q2', text: 'How can schools improve environmental education?', audio_url: null },
      { type: 'q3', text: 'What are the biggest barriers to behavior change?', audio_url: null },
    ],
  },
});

describe('RecordingPhase UI merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const fakeStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream),
      },
    });

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });

    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn(() => 1),
    });

    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    });

    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: vi.fn(() => 'blob:preview-url'),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-url');
    }

    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders Part 2 cue-card layout with mapped topic data', () => {
    render(<RecordingPhase topic={buildPart2Topic()} onComplete={vi.fn()} />);

    expect(screen.getByText('Cue Card Task')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Describe a journey/i })).toBeInTheDocument();
    expect(screen.getByText('Topic: Education')).toBeInTheDocument();
    expect(screen.getByText('You should say:')).toBeInTheDocument();
    expect(screen.getByText('Where it happened')).toBeInTheDocument();
    expect(document.querySelector('.material-symbols-outlined')).toBeNull();
  });

  it('renders Part 1 without cue-card label', () => {
    render(<RecordingPhase topic={buildPart1Topic()} onComplete={vi.fn()} />);

    expect(screen.getByText('Introduction Task')).toBeInTheDocument();
    expect(screen.queryByText('Cue Card Task')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Do you like your hometown/i })).toBeInTheDocument();
    expect(screen.queryByText('Common questions:')).not.toBeInTheDocument();
    expect(screen.queryByText('What do you like most about it?')).not.toBeInTheDocument();
  });

  it('renders Part 3 conversational label and question counter', () => {
    render(<RecordingPhase topic={buildPart3Topic()} onComplete={vi.fn()} />);

    expect(screen.getByText('Conversation Task')).toBeInTheDocument();
    expect(screen.getByText('Question 1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Why should cities invest/i })).toBeInTheDocument();
  });

  it('starts and stops recording, then submits audio blob', async () => {
    const onComplete = vi.fn();
    render(<RecordingPhase topic={buildPart2Topic()} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /Start recording/i }));
    expect(await screen.findByRole('button', { name: /Stop recording/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Stop recording/i }));
    const submitButton = await screen.findByRole('button', { name: /Submit for AI Grading/i });
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('advances to next Part 3 question when pause-next is clicked', async () => {
    render(<RecordingPhase topic={buildPart3Topic()} onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Start recording/i }));
    const nextButton = await screen.findByRole('button', { name: /Pause and go to next question/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Question 2 / 3')).toBeInTheDocument();
    });
  });

  it('keeps submit disabled when Part 3 is not at last question', async () => {
    render(<RecordingPhase topic={buildPart3Topic()} onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Start recording/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Stop recording/i }));

    const submitButton = await screen.findByRole('button', { name: /Submit for AI Grading/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/You have not reached the last question yet/i)).toBeInTheDocument();
  });
});
