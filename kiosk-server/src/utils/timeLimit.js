/**
 * Calculate remaining seconds for an app based on usage data.
 * This is the single source of truth for time limit calculations.
 *
 * @param {Object} usage - Usage data from /api/apps/:id/usage
 * @param {number} usage.today_seconds - Seconds used today
 * @param {number} usage.week_seconds - Seconds used this week
 * @param {number|null} usage.daily_limit_minutes - Daily limit (null = no limit)
 * @param {number|null} usage.weekly_limit_minutes - Weekly limit (null = no limit)
 * @param {number} usage.max_daily_minutes - Hard cap ignoring bonus (0 = no cap)
 * @param {number} usage.bonus_minutes_today - Bonus minutes earned today
 * @returns {number|null} Remaining seconds, or null if no limits apply
 */
export function calculateRemainingSeconds(usage) {
  const candidates = [];
  const bonusSeconds = (usage.bonus_minutes_today || 0) * 60;

  // Daily limit with bonus time
  if (usage.daily_limit_minutes != null) {
    candidates.push(usage.daily_limit_minutes * 60 + bonusSeconds - usage.today_seconds);
  }

  // Weekly limit (no bonus applied to weekly)
  if (usage.weekly_limit_minutes != null) {
    candidates.push(usage.weekly_limit_minutes * 60 - usage.week_seconds);
  }

  // Hard cap: max_daily_minutes ignores bonus time entirely
  if (usage.max_daily_minutes > 0) {
    candidates.push(usage.max_daily_minutes * 60 - usage.today_seconds);
  }

  if (candidates.length === 0) {
    return null; // No limits configured
  }

  return Math.max(0, Math.min(...candidates));
}
