import { parseTimeSlot, getTodayKey } from './dateHelpers';

let swRegistration = null;
const scheduledTimers = new Set();

export function getNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', swRegistration.scope);
    } catch (err) {
        console.warn('SW registration failed:', err);
    }
}

function showNotification(title, body, tag) {
    if (Notification.permission !== 'granted') return;

    if (swRegistration?.active) {
        swRegistration.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body,
            tag,
        });
    } else {
        // Fallback to direct notification
        new Notification(title, { body, tag, icon: '/icon-192.svg' });
    }
}

/**
 * Smart Reminder System
 * Schedules multiple notification stages for each task:
 * 
 * 1. APPROACHING (15 min before) — "⏰ Task title starts in 15 minutes"
 * 2. START TIME (at scheduled time) — "🚀 Time to start: Task title"
 * 3. PENDING (30 min after start, if not completed) — "⚠️ Task title is still pending"
 * 4. OVERDUE (end of day check) — tasks not completed get auto-moved to backlog
 */
export function scheduleTaskReminders(tasks) {
    // Clear all previous timers
    scheduledTimers.forEach(id => clearTimeout(id));
    scheduledTimers.clear();

    if (Notification.permission !== 'granted') return;

    const now = Date.now();
    const todayKey = getTodayKey();

    for (const task of tasks) {
        // Only schedule for today's uncompleted tasks with a time slot
        if (task.completed || task.date !== todayKey || !task.timeSlot) continue;

        const parsed = parseTimeSlot(task.timeSlot);
        if (!parsed) continue;

        const taskDate = new Date();
        taskDate.setHours(parsed.hours, parsed.mins, 0, 0);
        const taskTime = taskDate.getTime();

        // ── Stage 1: APPROACHING (15 min before) ──
        const approachTime = taskTime - 15 * 60 * 1000;
        if (approachTime > now) {
            const id = setTimeout(() => {
                showNotification(
                    '⏰ Coming Up Soon',
                    `"${task.title}" starts in 15 minutes`,
                    `approach-${task.id}`
                );
            }, approachTime - now);
            scheduledTimers.add(id);
        }

        // ── Stage 2: START TIME (exact start) ──
        if (taskTime > now) {
            const id = setTimeout(() => {
                showNotification(
                    '🚀 Time to Start!',
                    `"${task.title}" — Let's go!`,
                    `start-${task.id}`
                );
            }, taskTime - now);
            scheduledTimers.add(id);
        }

        // ── Stage 3: PENDING (30 min after start, if not completed) ──
        const pendingTime = taskTime + 30 * 60 * 1000;
        if (pendingTime > now) {
            const id = setTimeout(async () => {
                // Re-check if the task is still not completed
                try {
                    const res = await fetch(`/api/tasks?date=${todayKey}`);
                    const currentTasks = await res.json();
                    const current = currentTasks.find(t => t.id === task.id);
                    if (current && !current.completed) {
                        showNotification(
                            '⚠️ Task Still Pending',
                            `"${task.title}" hasn't been completed yet`,
                            `pending-${task.id}`
                        );
                    }
                } catch { /* silent */ }
            }, pendingTime - now);
            scheduledTimers.add(id);
        }
    }

    // ── Stage 4: END OF DAY CHECK (11:30 PM) ──
    const endOfDay = new Date();
    endOfDay.setHours(23, 30, 0, 0);
    const endOfDayTime = endOfDay.getTime();

    if (endOfDayTime > now && tasks.some(t => !t.completed && t.date === todayKey)) {
        const id = setTimeout(async () => {
            try {
                const res = await fetch(`/api/tasks?date=${todayKey}`);
                const currentTasks = await res.json();
                const incomplete = currentTasks.filter(t => !t.completed);
                if (incomplete.length > 0) {
                    showNotification(
                        '🔔 Day Ending — Incomplete Tasks',
                        `${incomplete.length} task${incomplete.length > 1 ? 's' : ''} will move to backlog tomorrow`,
                        `endofday`
                    );
                }
            } catch { /* silent */ }
        }, endOfDayTime - now);
        scheduledTimers.add(id);
    }
}

// Legacy export for backward compat
export const scheduleTaskNotifications = scheduleTaskReminders;
