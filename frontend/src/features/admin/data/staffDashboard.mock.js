export const TODAY = '2026-03-04';

export const students = [
  {
    id: 'stu-anna',
    name: 'Anna Nguyen',
    level: 'IELTS',
    joinedAt: '2 days',
    dailyProgress: [{ date: TODAY, missing: 0 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Pending' },
      { id: 'a2', status: 'Submitted', gradingStatus: 'Done' },
      { id: 'a3', status: 'Missing', gradingStatus: 'Pending' },
    ],
  },
  {
    id: 'stu-bao',
    name: 'Bao Tran',
    level: 'ACA',
    joinedAt: '1 day',
    dailyProgress: [{ date: TODAY, missing: 0 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Pending' },
      { id: 'a2', status: 'Submitted', gradingStatus: 'Pending' },
      { id: 'a3', status: 'Submitted', gradingStatus: 'Done' },
    ],
  },
  {
    id: 'stu-chi',
    name: 'Chi Le',
    level: 'IELTS',
    joinedAt: '5 days',
    dailyProgress: [{ date: TODAY, missing: 1 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Done' },
      { id: 'a2', status: 'Missing', gradingStatus: 'Pending' },
      { id: 'a3', status: 'Submitted', gradingStatus: 'Pending' },
    ],
  },
  {
    id: 'stu-duy',
    name: 'Duy Pham',
    level: 'IELTS',
    joinedAt: '8 days',
    dailyProgress: [{ date: TODAY, missing: 0 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Pending' },
      { id: 'a2', status: 'Submitted', gradingStatus: 'Done' },
      { id: 'a3', status: 'Submitted', gradingStatus: 'Done' },
    ],
  },
  {
    id: 'stu-hoa',
    name: 'Hoa Vu',
    level: 'ACA',
    joinedAt: '12 days',
    dailyProgress: [{ date: TODAY, missing: 0 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Done' },
      { id: 'a2', status: 'Missing', gradingStatus: 'Pending' },
      { id: 'a3', status: 'Submitted', gradingStatus: 'Pending' },
    ],
  },
  {
    id: 'stu-khanh',
    name: 'Khanh Do',
    level: 'IELTS',
    joinedAt: '3 days',
    dailyProgress: [{ date: TODAY, missing: 0 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Pending' },
      { id: 'a2', status: 'Submitted', gradingStatus: 'Pending' },
      { id: 'a3', status: 'Missing', gradingStatus: 'Pending' },
    ],
  },
  {
    id: 'stu-linh',
    name: 'Linh Hoang',
    level: 'ACA',
    joinedAt: '14 days',
    dailyProgress: [{ date: TODAY, missing: 1 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Done' },
      { id: 'a2', status: 'Submitted', gradingStatus: 'Done' },
      { id: 'a3', status: 'Submitted', gradingStatus: 'Done' },
    ],
  },
  {
    id: 'stu-minh',
    name: 'Minh Bui',
    level: 'IELTS',
    joinedAt: '6 days',
    dailyProgress: [{ date: TODAY, missing: 0 }],
    assignments: [
      { id: 'a1', status: 'Submitted', gradingStatus: 'Pending' },
      { id: 'a2', status: 'Submitted', gradingStatus: 'Done' },
      { id: 'a3', status: 'Submitted', gradingStatus: 'Pending' },
    ],
  },
];

export const submissionEvents = [
  {
    id: 'evt-1',
    studentName: 'Anna Nguyen',
    status: 'Submitted',
    assignmentName: 'Reading Homework - Week 3',
    timeAgo: '12m ago',
  },
  {
    id: 'evt-2',
    studentName: 'Bao Tran',
    status: 'Resubmitted',
    assignmentName: 'Listening Module 5',
    timeAgo: '24m ago',
  },
  {
    id: 'evt-3',
    studentName: 'Chi Le',
    status: 'Late',
    assignmentName: 'Writing Task 2 Practice',
    timeAgo: '39m ago',
  },
  {
    id: 'evt-4',
    studentName: 'Duy Pham',
    status: 'Submitted',
    assignmentName: 'Vocabulary Sprint',
    timeAgo: '1h ago',
  },
  {
    id: 'evt-5',
    studentName: 'Khanh Do',
    status: 'Submitted',
    assignmentName: 'Speaking Shadowing',
    timeAgo: '1h ago',
  },
];

export const dashboardSeriesByTab = {
  submissions: [
    { date: 'Feb 27', value: 3 },
    { date: 'Feb 28', value: 5 },
    { date: 'Mar 1', value: 4 },
    { date: 'Mar 2', value: 7 },
    { date: 'Mar 3', value: 6 },
    { date: 'Mar 4', value: 8 },
    { date: 'Mar 5', value: 2 },
  ],
  completion: [
    { date: 'Feb 27', value: 45 },
    { date: 'Feb 28', value: 52 },
    { date: 'Mar 1', value: 58 },
    { date: 'Mar 2', value: 62 },
    { date: 'Mar 3', value: 68 },
    { date: 'Mar 4', value: 74 },
    { date: 'Mar 5', value: 40 },
  ],
  missing: [
    { date: 'Feb 27', value: 5 },
    { date: 'Feb 28', value: 4 },
    { date: 'Mar 1', value: 3 },
    { date: 'Mar 2', value: 4 },
    { date: 'Mar 3', value: 2 },
    { date: 'Mar 4', value: 3 },
    { date: 'Mar 5', value: 6 },
  ],
  activity: [
    { date: 'Feb 27', value: 6 },
    { date: 'Feb 28', value: 7 },
    { date: 'Mar 1', value: 5 },
    { date: 'Mar 2', value: 8 },
    { date: 'Mar 3', value: 7 },
    { date: 'Mar 4', value: 8 },
    { date: 'Mar 5', value: 3 },
  ],
};

export const submissionStackedSeries = [
  { date: 'Feb 27', submitted: 3, notSubmitted: 5 },
  { date: 'Feb 28', submitted: 5, notSubmitted: 4 },
  { date: 'Mar 1', submitted: 4, notSubmitted: 6 },
  { date: 'Mar 2', submitted: 7, notSubmitted: 3 },
  { date: 'Mar 3', submitted: 6, notSubmitted: 4 },
  { date: 'Mar 4', submitted: 8, notSubmitted: 2 },
  { date: 'Mar 5', submitted: 2, notSubmitted: 7 },
];
