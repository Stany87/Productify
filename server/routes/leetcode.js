import { Router } from 'express';

const router = Router();

// GET /api/leetcode/:username
router.get('/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              username
              submitStatsGlobal {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
              submissionCalendar
              profile {
                ranking
                reputation
              }
            }
          }
        `,
        variables: { username },
      }),
    });

    const data = await response.json();
    const user = data?.data?.matchedUser;
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Parse submission calendar (Unix timestamps -> counts)
    let calendar = {};
    try { calendar = JSON.parse(user.submissionCalendar || '{}'); } catch { }

    // Get today's submissions
    // LeetCode uses midnight timestamps in the user's local timezone
    // We check multiple possible timestamps to handle timezone mismatches
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(todayStart.getTime() / 1000);
    const todayStr = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;

    // Check the exact timestamp and nearby ones (timezone drift)
    let todayCount = calendar[todayTimestamp.toString()] || 0;
    if (!todayCount) {
      // Check timestamps within ±18 hours of local midnight to catch timezone differences
      for (const [ts, count] of Object.entries(calendar)) {
        const tsNum = parseInt(ts);
        const tsDate = new Date(tsNum * 1000);
        const tsStr = `${tsDate.getFullYear()}-${String(tsDate.getMonth() + 1).padStart(2, '0')}-${String(tsDate.getDate()).padStart(2, '0')}`;
        if (tsStr === todayStr) {
          todayCount = count;
          break;
        }
      }
    }

    // Get this week's submissions
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekTimestamp = Math.floor(weekStart.getTime() / 1000);

    let weekCount = 0;
    for (const [ts, count] of Object.entries(calendar)) {
      if (parseInt(ts) >= weekTimestamp) weekCount += count;
    }

    // Total solved by difficulty
    const stats = user.submitStatsGlobal?.acSubmissionNum || [];
    const totalSolved = stats.find(s => s.difficulty === 'All')?.count || 0;
    const easySolved = stats.find(s => s.difficulty === 'Easy')?.count || 0;
    const mediumSolved = stats.find(s => s.difficulty === 'Medium')?.count || 0;
    const hardSolved = stats.find(s => s.difficulty === 'Hard')?.count || 0;

    // Recent activity (last 30 days)
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const recentActivity = [];
    for (const [ts, count] of Object.entries(calendar)) {
      if (parseInt(ts) >= thirtyDaysAgo) {
        const d = new Date(parseInt(ts) * 1000);
        recentActivity.push({
          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          count,
        });
      }
    }
    recentActivity.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      username: user.username,
      ranking: user.profile?.ranking,
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      todayCount,
      weekCount,
      recentActivity,
    });
  } catch (error) {
    console.error('LeetCode API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch LeetCode data' });
  }
});

export default router;
