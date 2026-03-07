const crypto = require('crypto');

const secret = 'dev-secret-key-do-not-use-in-prod';

function signData(data, secret) {
    const jsonString = JSON.stringify(data);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonString);
    return hmac.digest('hex').substring(0, 12).toUpperCase();
}

const data = {
    "id": "conv_9cysp0s3y",
    "status": "VALIDATED_HEAD",
    "establishment_uai": "0330028Z",
    "student_uid": "dIit7q0H1qXz98i70C7NskY892w2",
    "type": "PFMP_STANDARD",
    "metadata": {
        "signedAt": "2026-02-25T10:00:27.105Z",
        "prof_nom": "DUMAS DELAGE",
        "ent_ville": "MERIGNAC",
        "eleve_nom": "AUREL",
        "ent_email": "lecafeel@gmail.com",
        "parent_id": "87HnNo823uQn71wV7NoT",
        "studentId": "fabrice.dumasdelage@gmail.com",
        "tuteur_nom": "AUREL",
        "ecole_ville": "BORDEAUX",
        "eleve_email": "fabrice.dumasdelage@gmail.com",
        "prof_prenom": "Fabrice",
        "signatures": {
            "head": {
                "code": "8R5S3",
                "hash": "D83FD1EC97EE",
                "signedAt": "2026-02-25T10:00:27.105Z"
            },
            "tutor": {
                "code": "J6V5K",
                "hash": "885368361765",
                "signedAt": "2026-02-25T08:50:33.239Z"
            },
            "parent": {
                "code": "4L2S9",
                "hash": "D08197793BBF",
                "signedAt": "2026-02-25T10:00:03.952Z"
            },
            "student": {
                "code": "7G2R5",
                "hash": "0A8F8DB68E2F",
                "signedAt": "2026-02-25T08:33:49.035Z"
            },
            "teacher": {
                "code": "3C9P1",
                "hash": "959E813BB6B4",
                "signedAt": "2026-02-25T08:41:43.804Z"
            },
            "company_head": {
                "code": "J6V5K",
                "hash": "885368361765",
                "signedAt": "2026-02-25T08:50:33.239Z"
            }
        },
        "ent_tel": "",
        "prof_email": "fabrice.dumasdelage@gmail.com",
        "prof_suivi": "DUMAS DELAGE Fabrice",
        "rep_legal": "AUREL",
        "tuteur_tel": "",
        "ecole_nom": "Lycée Professionnel de l'Estuaire",
        "ent_adresse": "58 av de la marne",
        "ent_rep_nom": "AUREL",
        "stage_jours": "Lundi, Mardi, Mercredi, Jeudi, Vendredi",
        "tuteur_email": "lecafeel@gmail.com",
        "ecole_adresse": "1 Rue de la Côte d'Argent",
        "eleve_adresse": "12 rue pelleport 33800 bordeaux",
        "eleve_prenom": "LUCAS",
        "ent_nom": "AUREL ET ASSOCIES",
        "prof_id": "fabrice.dumasdelage@gmail.com",
        "rep_legal_nom": "AUREL",
        "stage_activites": "Les activités proposées et les compétences sont celles du référentiels du diplôme.",
        "tuteur_fonction": "gérent",
        "diplome_intitule": "BAC PRO PLP",
        "ecole_chef_email": "pledgeum@gmail.com",
        "ent_rep_fonction": "gérent",
        "stage_date_debut": "2026-02-26",
        "frais_hebergement": false,
        "rep_legal_adresse": "12 Rue Pelleport 33800 Bordeaux",
        "frais_restauration": false,
        "stage_duree_heures": 35,
        "eleve_date_naissance": "2009-10-24",
        "tuteur_meme_personne": true,
        "gratification_montant": "",
        "stage_adresse_differente": false
    }
};

const type = 'convention';
const payload = {
    t: type === 'convention' ? 'c' : 'a',
    id: data.id,
    s: data.eleve_nom + ' ' + data.eleve_prenom,
    e: data.ent_nom,
    d: { s: data.stage_date_debut, f: data.stage_date_fin },
    sigs: [
        { n: data.eleve_nom + ' ' + data.eleve_prenom, r: 'Élève', d: data.signatures?.student?.signedAt || data.signatures?.studentAt },
        { n: data.rep_legal_nom ? data.rep_legal_nom + ' ' + data.rep_legal_prenom : 'Représentant Légal', r: 'Représentant Légal', d: data.signatures?.parent?.signedAt || data.signatures?.parentAt },
        { n: data.tuteur_nom, r: 'Tuteur', d: data.signatures?.tutor?.signedAt || data.signatures?.tutorAt },
        { n: data.prof_nom, r: 'Enseignant Référent', d: data.signatures?.teacher?.signedAt || data.signatures?.teacherAt },
        { n: data.ent_rep_nom, r: 'Représentant Entreprise', d: data.signatures?.company?.signedAt || data.signatures?.companyAt },
        { n: data.ecole_chef_nom, r: "Chef d'Établissement", d: data.signatures?.head?.signedAt || data.signatures?.headAt },
    ].filter(s => s.d)
};

console.log('--- REPRODUCING FROM DB DATA ---');
console.log('Payload derived from DB root fields (should fail):');
console.log(signData(payload, secret));

// Now try with data merged from metadata (like the Store does)
const mergedData = { ...data, ...data.metadata };
const mergedPayload = {
    t: type === 'convention' ? 'c' : 'a',
    id: mergedData.id,
    s: mergedData.eleve_nom + ' ' + mergedData.eleve_prenom,
    e: mergedData.ent_nom,
    d: { s: mergedData.stage_date_debut, f: mergedData.stage_date_fin },
    sigs: [
        { n: mergedData.eleve_nom + ' ' + mergedData.eleve_prenom, r: 'Élève', d: mergedData.signatures?.student?.signedAt || mergedData.signatures?.studentAt },
        { n: mergedData.rep_legal_nom ? mergedData.rep_legal_nom + ' ' + mergedData.rep_legal_prenom : 'Représentant Légal', r: 'Représentant Légal', d: mergedData.signatures?.parent?.signedAt || mergedData.signatures?.parentAt },
        { n: mergedData.tuteur_nom, r: 'Tuteur', d: mergedData.signatures?.tutor?.signedAt || mergedData.signatures?.tutorAt },
        { n: mergedData.prof_nom, r: 'Enseignant Référent', d: mergedData.signatures?.teacher?.signedAt || mergedData.signatures?.teacherAt },
        { n: mergedData.ent_rep_nom, r: 'Représentant Entreprise', d: mergedData.signatures?.company?.signedAt || mergedData.signatures?.companyAt },
        { n: mergedData.ecole_chef_nom, r: "Chef d'Établissement", d: mergedData.signatures?.head?.signedAt || mergedData.signatures?.headAt },
    ].filter(s => s.d)
};

console.log('Payload derived from MERGED data (Metadata + Root):');
console.log(signData(mergedPayload, secret));
