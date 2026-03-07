import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function openBase64PDF(base64String: string, fileName: string) {
    try {
        // Handle data URI if present
        const pureBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;

        const byteCharacters = atob(pureBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // Try opening in new tab
        const win = window.open(url, '_blank');
        if (!win) {
            // If blocked, trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error('Error opening PDF:', error);
        // Fallback: try to navigate directly if possible, though this is what caused issues
        window.open(base64String, '_blank');
    }
}
