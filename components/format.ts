const berlin = { timeZone: "Europe/Berlin" } as const;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  ...berlin,
  day: "numeric",
  month: "short",
});

const weekdayFormat = new Intl.DateTimeFormat("en-GB", {
  ...berlin,
  weekday: "short",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  ...berlin,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatSlot(iso: string): { day: string; time: string } {
  const date = new Date(iso);

  return {
    day: `${weekdayFormat.format(date)} ${dateFormat.format(date)}`,
    time: timeFormat.format(date),
  };
}

export function formatDateTime(iso: string): string {
  const { day, time } = formatSlot(iso);
  return `${day}, ${time}`;
}
