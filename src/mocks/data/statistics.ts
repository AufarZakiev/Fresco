import type { ProjectStatistics, DailyStats } from "../../types/boinc";
import { NOW, DAY, ROSETTA_URL, EINSTEIN_URL, CLIMATE_URL } from "./_shared";

function generateStats(
  days: number,
  baseCredit: number,
  dailyGain: number,
): DailyStats[] {
  const stats: DailyStats[] = [];
  for (let i = days; i >= 0; i--) {
    const dayTimestamp = NOW - i * DAY;
    const accumulated = baseCredit + (days - i) * dailyGain;
    const expavg = dailyGain * 0.9 + Math.random() * dailyGain * 0.2;
    stats.push({
      day: dayTimestamp,
      user_total_credit: accumulated * 2.5,
      user_expavg_credit: expavg * 2.5,
      host_total_credit: accumulated,
      host_expavg_credit: expavg,
    });
  }
  return stats;
}

export const mockStatistics: ProjectStatistics[] = [
  {
    master_url: ROSETTA_URL,
    daily_statistics: generateStats(30, 40000, 280),
  },
  {
    master_url: EINSTEIN_URL,
    daily_statistics: generateStats(30, 25000, 200),
  },
  {
    master_url: CLIMATE_URL,
    daily_statistics: generateStats(30, 12000, 0), // suspended — no gain
  },
];
