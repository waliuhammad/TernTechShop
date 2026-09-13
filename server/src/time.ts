/**
 * JazzCash expects timestamps as yyyyMMddHHmmss in Pakistan time, whatever
 * timezone the server happens to run in.
 */
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function karachiStamp(date: Date): string {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.formatToParts(date).find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
}
