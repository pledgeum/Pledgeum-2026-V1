export async function sendNotification(to: string, subject: string, text: string) {
    try {
        const apiUrl = (typeof window === 'undefined')
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-email`
            : '/api/send-email';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to, subject, text }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown' }));
            console.error('Failed to send notification. Server responded:', errorData);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error sending notification:', error);
        return false;
    }
}
