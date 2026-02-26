import { useEffect, useRef } from 'react';
import { getTodaySessions } from '../api';

export function useSessionNotifications(user) {
    // Keep track of which notifications have already been shown this session.
    // We append the type (e.g., "-30m" or "-10m") to the session ID to track them separately.
    const notifiedRef = useRef(new Set());

    useEffect(() => {
        // Only run if the user is authenticated
        if (!user) return;

        // Ask for notification permission if not already granted or denied
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const checkUpcomingSessions = async () => {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;

            try {
                const sessions = await getTodaySessions();

                const now = new Date();
                // Convert current time to total minutes from midnight for easy math
                const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

                sessions.forEach(session => {
                    // Ignore completed or flexible (no rigid start time) sessions
                    if (session.status === 'completed' || session.startTime === 'flexible') return;

                    const [h, m] = session.startTime.split(':').map(Number);
                    const startTotalMinutes = h * 60 + m;

                    // Minutes until the session starts
                    const diff = startTotalMinutes - currentTotalMinutes;

                    // Trigger 30-minute warning
                    if (diff > 29 && diff <= 30) {
                        const notifKey = `${session.id}-30m`;
                        if (!notifiedRef.current.has(notifKey)) {
                            new Notification('Upcoming Session', {
                                body: `${session.name} starts in 30 minutes. Get ready!`,
                                // Fallback icon in case we don't have a PWA icon set up yet
                                icon: '/favicon.ico'
                            });
                            notifiedRef.current.add(notifKey);
                        }
                    }

                    // Trigger 10-minute warning
                    if (diff > 9 && diff <= 10) {
                        const notifKey = `${session.id}-10m`;
                        if (!notifiedRef.current.has(notifKey)) {
                            new Notification('Starting Now!', {
                                body: `${session.name} begins in 10 minutes. Lock in.`,
                                icon: '/favicon.ico'
                            });
                            notifiedRef.current.add(notifKey);
                        }
                    }
                });
            } catch (err) {
                console.error("Failed to check sessions for notifications", err);
            }
        };

        // Check right away when the hook mounts
        checkUpcomingSessions();

        // Check every 1 minute
        const intervalId = setInterval(checkUpcomingSessions, 60000);

        return () => clearInterval(intervalId);
    }, [user]);
}
