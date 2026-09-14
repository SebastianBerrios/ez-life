export function calculateMonthlyCycle(currentDate: Date): [Date, Date] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return [startDate, endDate];
}
