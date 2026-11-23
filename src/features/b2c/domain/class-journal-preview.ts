export type JournalClass = {
  id: string;
  code: string;
  name: string;
  program_slug: string;
  status: string;
  weekdays_text: string | null;
  time_text: string | null;
};

export type JournalMeeting = {
  id: string;
  starts_at: string;
  ends_at: string;
  teacher_name: string;
  status: "planned" | "completed" | "cancelled";
};

export type JournalMeetingPage = {
  rows: JournalMeeting[];
  total: number;
};

export type PreviewReport = {
  content: string;
  homework: string;
  files: File[];
  status: "draft" | "sent";
};
