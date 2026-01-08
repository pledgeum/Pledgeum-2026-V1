// Existing imports...
import { db, auth } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function sendNotification(to: string, subject: string, text: string) {
    // Audit: Log the email attempt (optional, or rely on console)
    console.log(`[EMAIL] Sending to ${to}: ${subject}`);

    // 1. Create In-App Notification (Persistent)
    try {
        await createInAppNotification(to, subject, text);
    } catch (e) {
        console.error("Error creating in-app notification:", e);
    }

    // 2. Send Actual Email (Server Action / API)
    try {
        const apiUrl = (typeof window === 'undefined')
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-email`
            : '/api/send-email';

        const token = await auth.currentUser?.getIdToken();

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token || ''}`
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

// New Helper for In-App Persistence
export async function createInAppNotification(recipientEmail: string, title: string, message: string) {
    try {
        await addDoc(collection(db, "notifications"), {
            recipientEmail, // Index this
            title,
            message,
            date: new Date().toISOString(),
            read: false,
            // Optional: Type, Action Link, etc. logic can be refined here
        });
        console.log(`[DB] Notification created for ${recipientEmail}`);
    } catch (error) {
        console.error("Error writing notification to DB:", error);
    }
}
