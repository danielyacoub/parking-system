const HONG_KONG_TIME_ZONE = "Asia/Hong_Kong";

const dateTimeFormatter = new Intl.DateTimeFormat("en-HK", {
  timeZone: HONG_KONG_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("en-HK", {
  timeZone: HONG_KONG_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(value: string | Date): string {
  return `${dateTimeFormatter.format(new Date(value))} HKT`;
}

export function formatTime(value: string | Date): string {
  return `${timeFormatter.format(new Date(value))} HKT`;
}

export function formatDuration(minutes?: number): string {
  if (typeof minutes !== "number") {
    return "—";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

export function formatSlotNumber(slotNumber: number): string {
  return String(slotNumber).padStart(2, "0");
}
