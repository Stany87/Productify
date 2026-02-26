import { Router } from 'express';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const router = Router();

const SCHEDULE_PROMPT = `You are a session-based schedule generator for a productivity app.

The user will describe their life, routine, and goals. You must generate a FULL 7-day weekly schedule as SESSION TIME BLOCKS.

RULES:
- Generate SESSIONS, not individual tasks. Each session is a time block (e.g. "College" from 08:00-18:00, "Deep Work" from 19:00-21:00)
- Include ALL aspects: college/work, gym, meals, commute, sleep wind-down, LeetCode sessions, skill blocks, breaks, chill time
- For LeetCode/skill sessions, include specific items array with targetCount
- LeetCode items MUST include difficulty in the title: (Easy), (Medium), or (Hard)
- Distribute difficulties smartly: beginners get more Easy, advanced get more Hard
- Vary the mix across days (e.g. Mon: 2 Easy + 2 Medium + 1 Hard, Tue: 1 Easy + 3 Medium + 1 Hard, etc.)
- Each session MUST have: name, startTime (HH:MM), endTime (HH:MM), type (fixed|productive|habit|break), category (college|gym|meal|leetcode|project|dsa|study|skill|break|other), icon (emoji), color (hex)
- Items array: each item has title, category, targetCount
- Make weekdays vs weekends different where appropriate
- Be realistic with time allocation — no overlapping sessions

RESPOND WITH ONLY valid JSON (no markdown, no code fences):
{
  "sessions": {
    "Monday": [
      {
        "name": "College",
        "startTime": "08:00",
        "endTime": "18:00",
        "type": "fixed",
        "category": "college",
        "icon": "🎓",
        "color": "#3b82f6",
        "items": []
      },
      {
        "name": "Deep Work — LeetCode",
        "startTime": "19:00",
        "endTime": "21:00",
        "type": "productive",
        "category": "leetcode",
        "icon": "🧩",
        "color": "#f59e0b",
        "items": [
          { "title": "LC Easy #1", "category": "leetcode", "targetCount": 1 },
          { "title": "LC Easy #2", "category": "leetcode", "targetCount": 1 },
          { "title": "LC Medium #1", "category": "leetcode", "targetCount": 1 },
          { "title": "LC Medium #2", "category": "leetcode", "targetCount": 1 },
          { "title": "LC Hard #1", "category": "leetcode", "targetCount": 1 }
        ]
      }
    ],
    "Tuesday": [...],
    ...
  },
  "summary": "Brief description"
}`;

const PIVOT_PROMPT = `You are a daily schedule restructurer. The user's routine has changed FOR TODAY ONLY.

Current schedule for today:
{currentSchedule}

The user says: "{reason}"

RULES:
- Restructure TODAY's sessions to accommodate the change
- Maximize freed time for productivity
- Keep essential sessions (meals, gym if not cancelled)
- If college is cancelled, fill that time with skill/LeetCode sessions
- Output the SAME JSON format as the original sessions array
- This is a ONE-DAY override, do not change the permanent schedule

RESPOND WITH ONLY valid JSON (no markdown, no code fences):
{
  "sessions": [...],
  "summary": "What changed and why"
}`;

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return new Groq({ apiKey });
}

async function callGroq(systemPrompt, userPrompt) {
    const groq = getGroqClient();
    if (!groq) throw new Error('No GROQ_API_KEY');

    const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
    });

    const text = result.choices[0]?.message?.content || '';
    // Strip code fences if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    return JSON.parse(jsonMatch[1].trim());
}

// POST /api/ai/generate-schedule
router.post('/generate-schedule', async (req, res) => {
    const { lifeDescription, leetcodeTarget, skillFocuses } = req.body;
    if (!lifeDescription) return res.status(400).json({ error: 'lifeDescription required' });

    const prompt = `${lifeDescription}\n\nTargets: ${leetcodeTarget || 5} LeetCode problems per day.\nSkill focuses: ${(skillFocuses || []).join(', ') || 'General coding skills'}`;

    if (!process.env.GROQ_API_KEY) {
        const fallback = getDefaultSchedule(lifeDescription, leetcodeTarget || 5, skillFocuses);
        saveBaseline(req.userId, fallback.sessions);
        return res.json(fallback);
    }

    try {
        const parsed = await callGroq(SCHEDULE_PROMPT, `User's life: ${prompt}`);

        saveBaseline(req.userId, parsed.sessions);

        db.prepare(`
      UPDATE user_profile SET lifeDescription = ?, leetcodeTarget = ?,
        skillFocuses = ?, updatedAt = datetime('now') WHERE userId = ?
    `).run(lifeDescription, leetcodeTarget || 5, JSON.stringify(skillFocuses || []), req.userId);

        res.json(parsed);
    } catch (error) {
        console.error('Groq error:', error.message);
        const fallback = getDefaultSchedule(lifeDescription, leetcodeTarget || 5, skillFocuses);
        saveBaseline(req.userId, fallback.sessions);
        res.json(fallback);
    }
});

// POST /api/ai/pivot
router.post('/pivot', async (req, res) => {
    const { reason, date } = req.body;
    if (!reason || !date) return res.status(400).json({ error: 'reason and date required' });

    const currentSessions = db.prepare(
        'SELECT * FROM daily_sessions WHERE userId = ? AND date = ? ORDER BY startTime ASC'
    ).all(req.userId, date);

    const currentScheduleStr = currentSessions.map(
        s => `${s.startTime}-${s.endTime}: ${s.name} (${s.category})`
    ).join('\n');

    if (!process.env.GROQ_API_KEY) {
        return res.json({ sessions: [], summary: 'GROQ_API_KEY required for AI pivot' });
    }

    try {
        const pivotPrompt = PIVOT_PROMPT
            .replace('{currentSchedule}', currentScheduleStr)
            .replace('{reason}', reason);

        const parsed = await callGroq(pivotPrompt, `Restructure today's schedule.`);

        let sessionsArr = parsed.sessions;
        if (sessionsArr && !Array.isArray(sessionsArr)) {
            const dateObj = new Date(date + 'T00:00:00');
            const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayName = DAYS[dateObj.getDay()];
            sessionsArr = sessionsArr[todayName] || Object.values(sessionsArr)[0] || [];
        }
        if (!Array.isArray(sessionsArr)) sessionsArr = [];

        db.prepare(`
      INSERT INTO daily_overrides (userId, date, reason) VALUES (?, ?, ?)
      ON CONFLICT(userId, date) DO UPDATE SET reason = ?, createdAt = datetime('now')
    `).run(req.userId, date, reason, reason);

        res.json({ sessions: sessionsArr, summary: parsed.summary || 'Schedule restructured' });
    } catch (error) {
        console.error('Pivot error:', error.message);
        res.status(500).json({ error: 'Failed to restructure schedule' });
    }
});

function saveBaseline(userId, sessions) {
    db.prepare('DELETE FROM baseline_sessions WHERE userId = ?').run(userId);

    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const insert = db.prepare(`
    INSERT INTO baseline_sessions (userId, name, dayOfWeek, startTime, endTime, type, category, icon, color, items)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    for (const [dayName, daySessions] of Object.entries(sessions)) {
        const dow = DAYS.indexOf(dayName);
        if (dow === -1) continue;

        for (const s of daySessions) {
            insert.run(
                userId, s.name, dow, s.startTime, s.endTime,
                s.type || 'fixed', s.category || 'other',
                s.icon || '📚', s.color || '#10b981',
                JSON.stringify(s.items || [])
            );
        }
    }
}

function getDefaultSchedule(description, lcTarget, skillFocuses = []) {
    const lower = description.toLowerCase();

    // ─── Parse user's life from their description ───
    const hasCollege = /college|university|class|campus|lectures?|semester/.test(lower);
    const hasWork = /work|job|office|9.to.5|intern|company/.test(lower);
    const hasGym = /gym|workout|exercise|lift|run|jog|fitness|crossfit/.test(lower);
    const hasCommute = /commute|travel|drive|bus|metro|train/.test(lower);
    const hasCooking = /cook|meal\s*prep|breakfast|lunch|dinner/.test(lower);

    // Extract time patterns
    const collegeMatch = lower.match(/college\s*(?:from\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/);
    const workMatch = lower.match(/work\s*(?:from\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/);
    const gymMatch = lower.match(/gym\s*(?:at|around|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/);
    const sleepMatch = lower.match(/sleep\s*(?:at|by|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/i);
    const wakeMatch = lower.match(/(?:wake|up|morning)\s*(?:at|by|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/i);

    // Determine key time anchors (24h format)
    let fixedStart = '08:00', fixedEnd = '16:00', fixedName = 'College';
    if (collegeMatch) {
        let sh = parseInt(collegeMatch[1]), eh = parseInt(collegeMatch[3]);
        if (sh < 6) sh += 12; if (eh <= sh) eh += 12;
        fixedStart = `${String(sh).padStart(2, '0')}:${collegeMatch[2] || '00'}`;
        fixedEnd = `${String(eh).padStart(2, '0')}:${collegeMatch[4] || '00'}`;
    } else if (hasWork) {
        fixedName = 'Work';
        if (workMatch) {
            let sh = parseInt(workMatch[1]), eh = parseInt(workMatch[3]);
            if (sh < 6) sh += 12; if (eh <= sh) eh += 12;
            fixedStart = `${String(sh).padStart(2, '0')}:${workMatch[2] || '00'}`;
            fixedEnd = `${String(eh).padStart(2, '0')}:${workMatch[4] || '00'}`;
        } else {
            fixedStart = '09:00'; fixedEnd = '17:00';
        }
    }

    const sleepHour = sleepMatch ? parseInt(sleepMatch[1]) + (parseInt(sleepMatch[1]) < 6 ? 24 : 0) : 23;
    const slotAfterFixed = parseInt(fixedEnd.split(':')[0]);
    const gymTime = gymMatch ? parseInt(gymMatch[1]) + (parseInt(gymMatch[1]) < 6 ? 12 : 0) : (slotAfterFixed + 0.5);

    // Skill names
    const skills = skillFocuses.length > 0 ? skillFocuses : ['Coding Skills'];

    // ═══ Build weekday schedule ═══
    const buildWeekday = (dayIndex) => {
        const s = [];
        const hasFix = hasCollege || hasWork;

        // Morning routine
        if (wakeMatch || true) {
            const wakeH = wakeMatch ? parseInt(wakeMatch[1]) : (hasFix ? 7 : 8);
            s.push({
                name: 'Morning Routine', startTime: `${String(wakeH).padStart(2, '0')}:00`,
                endTime: `${String(wakeH).padStart(2, '0')}:30`,
                type: 'habit', category: 'other', icon: '🌅', color: '#f59e0b', items: []
            });
        }

        // Main fixed block (college/work)
        if (hasFix) {
            s.push({
                name: fixedName, startTime: fixedStart, endTime: fixedEnd,
                type: 'fixed', category: hasCollege ? 'college' : 'other',
                icon: hasCollege ? '🎓' : '💼',
                color: hasCollege ? '#3b82f6' : '#6366f1', items: []
            });
        }

        // Gym (if mentioned)
        if (hasGym) {
            const gymH = Math.floor(gymTime);
            const gymStart = `${String(gymH).padStart(2, '0')}:00`;
            const gymEndH = gymH + 1;
            s.push({
                name: 'Gym Session', startTime: gymStart,
                endTime: `${String(gymEndH).padStart(2, '0')}:00`,
                type: 'habit', category: 'gym', icon: '💪', color: '#ef4444', items: []
            });
        }

        // LeetCode session with difficulty distribution
        const lcSlot = hasFix ? (hasGym ? Math.floor(gymTime) + 1 : slotAfterFixed + 1) : 9;
        const lcDuration = Math.min(Math.ceil(lcTarget / 2), 3);
        // Distribute: ~40% Easy, ~40% Medium, ~20% Hard — vary by day
        const diffMixes = [
            // Mon, Tue, Wed, Thu, Fri patterns
            { easy: 0.4, med: 0.4, hard: 0.2 },
            { easy: 0.3, med: 0.5, hard: 0.2 },
            { easy: 0.2, med: 0.4, hard: 0.4 },
            { easy: 0.4, med: 0.3, hard: 0.3 },
            { easy: 0.3, med: 0.4, hard: 0.3 },
        ];
        const mix = diffMixes[dayIndex % 5];
        const nEasy = Math.max(1, Math.round(lcTarget * mix.easy));
        const nHard = Math.max(0, Math.round(lcTarget * mix.hard));
        const nMed = Math.max(0, lcTarget - nEasy - nHard);
        const lcItems = [];
        for (let i = 0; i < nEasy; i++) lcItems.push({ title: `LC Easy #${i + 1}`, category: 'leetcode', targetCount: 1 });
        for (let i = 0; i < nMed; i++) lcItems.push({ title: `LC Medium #${i + 1}`, category: 'leetcode', targetCount: 1 });
        for (let i = 0; i < nHard; i++) lcItems.push({ title: `LC Hard #${i + 1}`, category: 'leetcode', targetCount: 1 });
        s.push({
            name: 'Deep Work — LeetCode', startTime: `${String(lcSlot).padStart(2, '0')}:00`,
            endTime: `${String(lcSlot + lcDuration).padStart(2, '0')}:00`,
            type: 'productive', category: 'leetcode', icon: '🧩', color: '#f59e0b', items: lcItems
        });

        // Skill session
        const skillSlot = lcSlot + lcDuration + (hasCooking ? 1 : 0); // gap for meal
        const skillName = skills[dayIndex % skills.length];
        s.push({
            name: `Skill — ${skillName}`, startTime: `${String(skillSlot).padStart(2, '0')}:00`,
            endTime: `${String(Math.min(skillSlot + 2, 22)).padStart(2, '0')}:00`,
            type: 'productive', category: 'skill', icon: '💻', color: '#8b5cf6',
            items: [{ title: `Practice ${skillName}`, category: 'skill', targetCount: 1 }]
        });

        // Dinner
        s.push({
            name: 'Dinner & Chill', startTime: `${String(Math.min(skillSlot + 2, 21)).padStart(2, '0')}:00`,
            endTime: `${String(Math.min(sleepHour, 23)).padStart(2, '0')}:00`,
            type: 'break', category: 'break', icon: '🍽️', color: '#64748b', items: []
        });

        // Sort by startTime and remove overlaps
        s.sort((a, b) => a.startTime.localeCompare(b.startTime));
        return deOverlap(s);
    };

    // ═══ Build weekend schedule ═══
    const buildWeekend = (dayIndex) => {
        const s = [];

        s.push({
            name: 'Morning Routine', startTime: '08:30', endTime: '09:00',
            type: 'habit', category: 'other', icon: '🌅', color: '#f59e0b', items: []
        });

        const lcDuration = Math.min(Math.ceil(lcTarget / 2), 3);
        // Weekends: heavier on Medium/Hard for challenge
        const nEasy = Math.max(1, Math.round(lcTarget * 0.2));
        const nHard = Math.max(1, Math.round(lcTarget * 0.3));
        const nMed = Math.max(0, lcTarget - nEasy - nHard);
        const weekendLcItems = [];
        for (let i = 0; i < nEasy; i++) weekendLcItems.push({ title: `LC Easy #${i + 1}`, category: 'leetcode', targetCount: 1 });
        for (let i = 0; i < nMed; i++) weekendLcItems.push({ title: `LC Medium #${i + 1}`, category: 'leetcode', targetCount: 1 });
        for (let i = 0; i < nHard; i++) weekendLcItems.push({ title: `LC Hard #${i + 1}`, category: 'leetcode', targetCount: 1 });
        s.push({
            name: 'Deep Work — LeetCode', startTime: '09:00',
            endTime: `${String(9 + lcDuration).padStart(2, '0')}:00`,
            type: 'productive', category: 'leetcode', icon: '🧩', color: '#f59e0b',
            items: weekendLcItems
        });

        s.push({
            name: 'Lunch Break', startTime: '12:00', endTime: '13:00',
            type: 'break', category: 'meal', icon: '🍕', color: '#64748b', items: []
        });

        // Project work (longer on weekends)
        s.push({
            name: 'Project Work', startTime: '13:00', endTime: '16:00',
            type: 'productive', category: 'project', icon: '🚀', color: '#10b981',
            items: [{ title: 'Build / Code project', category: 'project', targetCount: 1 }]
        });

        if (hasGym) {
            s.push({
                name: 'Gym Session', startTime: '16:30', endTime: '17:30',
                type: 'habit', category: 'gym', icon: '💪', color: '#ef4444', items: []
            });
        }

        const skillName = skills[(dayIndex + 1) % skills.length];
        s.push({
            name: `Skill — ${skillName}`, startTime: hasGym ? '18:00' : '16:30',
            endTime: hasGym ? '19:30' : '18:30',
            type: 'productive', category: 'skill', icon: '💻', color: '#8b5cf6',
            items: [{ title: `Deep dive: ${skillName}`, category: 'skill', targetCount: 1 }]
        });

        s.push({
            name: 'Dinner & Chill', startTime: '20:00', endTime: '22:00',
            type: 'break', category: 'break', icon: '🍽️', color: '#64748b', items: []
        });

        s.sort((a, b) => a.startTime.localeCompare(b.startTime));
        return deOverlap(s);
    };

    // Helper to remove overlapping sessions
    function deOverlap(sessions) {
        const result = [sessions[0]];
        for (let i = 1; i < sessions.length; i++) {
            const prev = result[result.length - 1];
            if (sessions[i].startTime < prev.endTime) {
                sessions[i].startTime = prev.endTime;
            }
            if (sessions[i].startTime < sessions[i].endTime) {
                result.push(sessions[i]);
            }
        }
        return result;
    }

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sessions = {};
    DAYS.forEach((day, i) => {
        sessions[day] = (day === 'Saturday' || day === 'Sunday')
            ? buildWeekend(i)
            : buildWeekday(i);
    });

    const detections = [
        hasCollege && `${fixedName} ${fixedStart}-${fixedEnd}`,
        hasGym && 'Gym included',
        hasCommute && 'Commute accounted for',
    ].filter(Boolean).join('. ');

    return {
        sessions,
        summary: `Personalized schedule generated. ${detections}. ${lcTarget} LeetCode/day. Skills: ${skills.join(', ')}.`,
    };
}

export default router;
