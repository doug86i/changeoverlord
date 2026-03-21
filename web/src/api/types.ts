export type EventRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
};

export type StageRow = {
  id: string;
  eventId: string;
  name: string;
  sortOrder: number;
};

export type StageDayRow = {
  id: string;
  stageId: string;
  dayDate: string;
  sortOrder: number;
};

export type PerformanceRow = {
  id: string;
  stageDayId: string;
  sortOrder: number;
  bandName: string;
  notes: string;
  startTime: string;
  endTime: string | null;
};
