// Existing imports...
import { db, auth } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

// Existing imports...
import { useDemoStore } from '@/store/demo';

export async function sendNotification(to: string, subject: string, text: string) {
    // 1. Check Demo Mode
    const { isDemoMode, openEmailModal } = useDemoStore.getState();
    if (isDemoMode) {
        console.log(`[DEMO] Intercepted email to ${to}`);
        openEmailModal({ to, subject, text });

        // Also create the in-app notification locally for realism
        try {
            // In demo mode, we might want to skip Firestore write for notifications too?
            // Or allow it if we are mocking Firestore? 
            // Ideally, skip real DB write to avoid pollution.
            console.log(`[DEMO] Skipped DB notification write for ${to}`);
        } catch (e) {
            console.error("Error invoking demo logic", e);
        }

        return true; // Simulate success
    }

    // Audit: Log the email attempt (optional, or rely on console)
    console.log(`[EMAIL] Sending to ${to}: ${subject}`);

    // 2. Create In-App Notification (Persistent)
    try {
        await createInAppNotification(to, subject, text);
    } catch (e) {
        console.error("Error creating in-app notification:", e);
    }

    // 3. Send Actual Email (Server Action / API)
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
