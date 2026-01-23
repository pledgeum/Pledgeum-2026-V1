require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

const targetEmail = 'fabrice.dumasdelage@yahoo.fr';

async function testEmail() {
    console.log('--- Testing Email Configuration ---');
    console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
    console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
    console.log('EMAIL_USER:', process.env.EMAIL_USER);

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST || !process.env.EMAIL_PORT) {
        console.error('❌ Missing environment variables for email.');
    } else {
        // TEST 1: Exact Logic from src/app/api/otp/send/route.ts
        console.log('\n--- TEST 1: Logic from src/app/api/otp/send/route.ts (Hardcoded secure: true) ---');
        try {
            const transporter1 = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: Number(process.env.EMAIL_PORT),
                secure: true, // HARDCODED IN ROUTE
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            console.log('Attempting to send mail with secure: true...');
            await transporter1.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: targetEmail,
                subject: 'Test Email - Config Check (Route Logic)',
                text: 'This is a test email checking the configuration found in src/app/api/otp/send/route.ts',
            });
            console.log('✅ TEST 1 SUCCESS: Email sent successfully with secure: true');
        } catch (error) {
            console.error('❌ TEST 1 FAILED:', error);
        }
    }

    console.log('\n--- Testing Firebase Admin Configuration ---');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.error('❌ Missing environment variables for Firebase Admin.');
        console.log('FIREBASE_PROJECT_ID:', projectId ? 'OK' : 'MISSING');
        console.log('FIREBASE_CLIENT_EMAIL:', clientEmail ? 'OK' : 'MISSING');
        console.log('FIREBASE_PRIVATE_KEY:', privateKey ? 'OK' : 'MISSING');
    } else {
        try {
            if (admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId,
                        clientEmail,
                        privateKey: privateKey.replace(/\\n/g, '\n'),
                    }),
                });
            }
            const db = admin.firestore();
            console.log('Attempting to write to Firestore (otps_test collection)...');
            await db.collection('otps_test').add({
                test: true,
                createdAt: new Date().toISOString()
            });
            console.log('✅ FIREBASE ADMIN SUCCESS: Written to Firestore.');

        } catch (error) {
            console.error('❌ FIREBASE ADMIN FAILED:', error);
        }
    }
}

testEmail();
