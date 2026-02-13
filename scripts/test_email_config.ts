
import { sendEmail } from '../src/lib/email';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function main() {
    console.log('🧪 Starting Email Isolation Test...');

    const targetEmail = 'fabricedumasdelage@gmail.com'; // Hardcoded as per prompt (or dummy) - using likely user email or fallback
    // Note: User can change this variable to test with a different email.

    console.log(`📧 Target Email: ${targetEmail}`);
    console.log('⚙️  Checking Environment Variables...');
    console.log('   - EMAIL_USER:', process.env.EMAIL_USER ? 'Set ✅' : 'Missing ❌');
    console.log('   - EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set ✅' : 'Missing ❌');
    console.log('   - EMAIL_HOST:', process.env.EMAIL_HOST ? 'Set ✅' : 'Missing ❌');
    console.log('   - EMAIL_PORT:', process.env.EMAIL_PORT ? 'Set ✅' : 'Missing ❌');

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST || !process.env.EMAIL_PORT) {
        console.error('❌ Missing credentials. Aborting.');
        return;
    }

    console.log('🚀 Attempting to send email...');

    try {
        const result = await sendEmail({
            to: targetEmail,
            subject: '🔍 Test Isolation: Debugging Signature Email',
            text: 'Ceci est un test isolé pour vérifier la configuration SMTP.\nSi vous recevez cet email, le service d\'envoi fonctionne correctement.\n\nTime: ' + new Date().toISOString()
        });

        if (result) {
            console.log('✅ Email sent successfully (according to transporter response).');
        } else {
            console.error('❌ Email failed to send (transporter returned false).');
        }

    } catch (error: any) {
        console.error('❌ CRITICAL ERROR:', error.message);
        console.error(error);
    }
}

main().catch(console.error);
