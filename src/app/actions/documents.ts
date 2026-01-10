'use server';

import { adminStorage, adminDb } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';

export async function uploadClassDocument(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        const classIds = JSON.parse(formData.get('classIds') as string) as string[];
        const uploadedBy = formData.get('uploadedBy') as string;
        const type = formData.get('type') as string || 'OTHER';

        if (!file) throw new Error("No file provided");

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        // Debug: List all buckets
        try {
            const [buckets] = await adminStorage.getBuckets();
            console.log("available buckets:", buckets.map((b: any) => b.name));
            if (buckets.length === 0) console.log("No buckets found.");
        } catch (err: any) {
            console.error("Error listing buckets:", err.message);
        }

        // DIRECT FIX: Hardcoding the known working bucket from the debug script
        const bucketName = 'pledgeum-2025-antigravity.firebasestorage.app';
        // const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', '');

        if (!bucketName) throw new Error("Bucket name not configured in env");

        console.log(`[Upload] Initializing bucket: ${bucketName}`);
        const bucket = adminStorage.bucket(bucketName);
        console.log(`[Upload] Bucket object created: ${bucket.name}`);

        const fileRef = bucket.file(`class_documents/${filename}`);

        // Verify existence before save
        const [exists] = await bucket.exists();
        console.log(`[Upload] Bucket '${bucketName}' exists? ${exists}`);
        if (!exists) {
            throw new Error(`The bucket '${bucketName}' reportedly does not exist. Check credentials/permissions.`);
        }

        await fileRef.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });

        await fileRef.makePublic();
        const publicUrl = fileRef.publicUrl();

        // Save metadata to Firestore
        const docData = {
            name: file.name,
            url: publicUrl,
            classIds,
            uploadedBy,
            uploadedByEmail: "system", // Optional, if needed
            createdAt: new Date().toISOString(),
            type,
            ...(formData.get('sharingData') ? JSON.parse(formData.get('sharingData') as string) : {})
        };

        const docRef = await adminDb.collection('class_documents').add(docData);

        return { success: true, doc: { id: docRef.id, ...docData } };

    } catch (error: any) {
        console.error("Server Action Upload Error:", error);
        // Use the variable 'bucketName' if available, otherwise default
        const bName = 'pledgeum-2025-antigravity.firebasestorage.app';
        return { success: false, error: `Bucket '${bName}' error: ${error.message}` };
    }
}
