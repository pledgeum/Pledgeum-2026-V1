const { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables manually if helpful, or rely on process.env
// We look for .env.local to find keys
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const REGION = 'fr-par'; // Default Scaleway Region
const BUCKET_NAME = 'pledgeum-backups-2026';

const accessKeyId = process.env.SCW_ACCESS_KEY;
const secretAccessKey = process.env.SCW_SECRET_KEY;

if (!accessKeyId || !secretAccessKey) {
    console.error("❌ Erreur: Clés Scaleway manquantes (SCW_ACCESS_KEY, SCW_SECRET_KEY).");
    console.error("Veuillez les ajouter dans .env.local");
    process.exit(1);
}

const s3Client = new S3Client({
    region: REGION,
    endpoint: `https://s3.${REGION}.scw.cloud`,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    },
    forcePathStyle: true // Needed for some S3 compatible storages, usually good for SCW
});

async function main() {
    console.log(`🚀 Connexion à Scaleway Object Storage (${REGION})...`);

    // 1. Ensure Bucket Exists
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`✅ Bucket '${BUCKET_NAME}' existe déjà.`);
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            console.log(`⚠️ Bucket '${BUCKET_NAME}' introuvable. Création en cours...`);
            try {
                await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
                console.log(`✅ Bucket '${BUCKET_NAME}' créé avec succès.`);
            } catch (createError) {
                console.error("❌ Echec création bucket:", createError.message);
                process.exit(1);
            }
        } else {
            console.error("❌ Erreur accès bucket:", error.message);
            // Permissions issue likely
            process.exit(1);
        }
    }

    // 2. Upload Files from _BACKUP_SECRETS
    const filesToUpload = [
        'backup_pledgeum_data.json',
        'backup_auth_users.json'
    ];

    const backupDir = path.resolve(__dirname, '../_BACKUP_SECRETS');

    for (const filename of filesToUpload) {
        const filePath = path.join(backupDir, filename);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Fichier introuvable, ignoré: ${filePath}`);
            continue;
        }

        console.log(`📤 Upload en cours: ${filename}...`);
        const fileContent = fs.readFileSync(filePath);

        // Ensure content type based on extension (simple)
        const contentType = filename.endsWith('.json') ? 'application/json' : 'application/octet-stream';

        try {
            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: filename,
                Body: fileContent,
                ContentType: contentType
            }));
            console.log(`✅ Upload terminé: ${filename}`);
        } catch (uploadError) {
            console.error(`❌ Erreur upload ${filename}:`, uploadError.message);
        }
    }

    console.log("🏁 Opérations terminées.");
}

main();
