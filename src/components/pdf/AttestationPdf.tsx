import React from 'react';
import { Text, View, Image, StyleSheet, Document, Page } from '@react-pdf/renderer';
import { Convention } from '@/store/convention';
import { CertificatePage } from './CertificatePage';
import { pdfTheme, commonStyles } from '@/lib/pdf/theme';

// Duplicate styles from ConventionPdf to ensure exact match
const localStyles = StyleSheet.create({
    signatureBox: {
        width: '48%',
        height: 70,
        borderWidth: 0.5,
        borderColor: pdfTheme.colors.lightGray,
        padding: 5,
        marginBottom: 10,
        borderRadius: 2,
    },
    signatureLabel: {
        fontSize: pdfTheme.sizes.small,
        fontFamily: pdfTheme.fonts.bold,
        color: pdfTheme.colors.secondaryText,
        marginBottom: 15,
    },
    annexTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 20, // Match ConventionPdf
        textTransform: 'uppercase',
        fontFamily: pdfTheme.fonts.bold,
        color: pdfTheme.colors.primary,
    },
    checkbox: {
        width: 10,
        height: 10,
        borderWidth: 1,
        borderColor: '#000',
        marginRight: 5,
    },
});

const styles = {
    ...localStyles,
    page: { ...commonStyles.page, padding: 30, fontSize: 9 }, // Reduced body font size to 9pt
    header: { ...commonStyles.h1, fontSize: 12, marginBottom: 8 },
    sectionTitle: { ...commonStyles.h2, fontSize: 10, marginTop: 6, marginBottom: 3 },
    row: { ...commonStyles.row, marginBottom: 2 },
    label: { ...commonStyles.label, fontSize: 9 },
    value: { ...commonStyles.value, fontSize: 9 },
    text: { ...commonStyles.text, fontSize: 9 },
    bold: { fontFamily: pdfTheme.fonts.bold, fontWeight: 'bold' },
};

interface AttestationPdfProps {
    convention: Convention;
    totalAbsenceHours: number;
    qrCodeUrl?: string;
    hashCode?: string;
}

// QrCodeFooter Component (Same as ConventionPdf)
const QrCodeFooter = ({ url, code }: { url: string, code?: string }) => (
    <View style={{ position: 'absolute', bottom: 10, right: 10, alignItems: 'flex-end', opacity: 0.8 }} fixed>
        <Image src={url} style={{ width: 50, height: 50 }} />
        <Text style={{ fontSize: 6, color: '#666', marginTop: 2 }}>Authenticité vérifiable</Text>
        {code && (
            <Text style={{ fontSize: 5, color: '#999', marginTop: 1, fontFamily: 'Courier' }}>
                Code d'authentification de la signature numérique : {code}
            </Text>
        )}
    </View>
);

export function AttestationPdf({ convention, totalAbsenceHours, qrCodeUrl, hashCode }: AttestationPdfProps) {
    const plannedHours = convention.stage_duree_heures || 0;
    const effectiveHours = Math.max(0, plannedHours - totalAbsenceHours);
    const calculatedDays = convention.attestation_total_jours || 0;
    // We don't have holiday info passed to PDF component yet, ideally should pass it or re-calculate.
    // However, the Modal sets `attestation_total_jours` which is the net result.
    // For PDF, we might need to display "Dont X jours fériés" if we want parity.
    // But convention object doesn't store holidays list string. Only `attestation_total_jours`.
    // Let's stick to days present for now, as that's the legal requirement.
    // TODO: Pass absence count if needed.
    const absenceDays = convention.absences?.length || 0; // Approximate if not passed explicit


    // Filter or Synthesize Audit Logs for the Certificate
    const attestationLogs = convention.auditLogs?.filter(log => log.action === 'ATTESTATION_SIGNED') || [];

    // If no specific log found but it is signed (legacy), create a synthetic one
    if (attestationLogs.length === 0 && convention.attestationSigned && convention.attestationDate) {
        attestationLogs.push({
            date: convention.attestationDate,
            action: 'ATTESTATION_SIGNED', // Now valid
            actorEmail: convention.ent_rep_email || 'Inconnu',
            details: `Signature de l'attestation par ${convention.attestation_signer_name || 'Représentant'} (${convention.attestation_signer_function || 'Fonction inconnue'})`
        });
    }

    const certificateData = {
        ...convention,
        id: convention.id,
        auditLogs: attestationLogs
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.annexTitle}>ANNEXE 3 : ATTESTATION DE STAGE</Text>

                <Text style={styles.text}>
                    Conformément à l’article D. 124-9 du code de l’éducation, une attestation de stage est délivrée par l’organisme d’accueil à tout élève.
                    Ce document doit être complété et signé le dernier jour du stage par un responsable autorisé de l’entreprise d’accueil.
                    Elle est remise au lycéen stagiaire, et également remise à l’établissement scolaire.
                </Text>

                {/* ENTREPRISE */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>L’entreprise (ou l’organisme d’accueil)</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nom :</Text>
                        <Text style={styles.value}>{convention.ent_nom}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>N° Siret :</Text>
                        <Text style={styles.value}>{convention.ent_siret}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Adresse :</Text>
                        <Text style={styles.value}>{convention.ent_adresse}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Représenté(e) par :</Text>
                        <Text style={styles.value}>{convention.ent_rep_nom} ({convention.ent_rep_fonction})</Text>
                    </View>
                </View>

                {/* ELEVE */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Atteste que l’élève</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nom Prénom :</Text>
                        <Text style={styles.value}>{convention.eleve_nom} {convention.eleve_prenom}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Classe :</Text>
                        <Text style={styles.value}>{convention.eleve_classe}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Né(e) le :</Text>
                        <Text style={styles.value}>{new Date(convention.eleve_date_naissance).toLocaleDateString()}</Text>
                    </View>
                </View>

                {/* ECOLE */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Scolarisé dans l’établissement</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nom :</Text>
                        <Text style={styles.value}>{convention.ecole_nom}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Adresse :</Text>
                        <Text style={styles.value}>{convention.ecole_adresse}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Chef d'établissement :</Text>
                        <Text style={styles.value}>{convention.ecole_chef_nom}</Text>
                    </View>
                </View>

                {/* DETAILS STAGE */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Période de formation</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Dates :</Text>
                        <Text style={styles.value}>Du {new Date(convention.stage_date_debut).toLocaleDateString()} au {new Date(convention.stage_date_fin || '').toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Durée effective :</Text>
                        <Text style={styles.value}>{calculatedDays} jours de présence</Text>
                    </View>
                    {/* Add absence mention if significant? User said "contente toi du nombre de jours de présence et d'absences" */}
                    {totalAbsenceHours > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Absences :</Text>
                            <Text style={[styles.value, { color: '#666' }]}>{Math.round(totalAbsenceHours / 7 * 10) / 10} jours (ou {totalAbsenceHours}h)</Text>
                        </View>
                    )}
                </View>

                {/* ACTIVITES */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Activités et Compétences</Text>
                    <View style={{ marginBottom: 12 }}>
                        <Text style={[styles.label, { width: '100%', marginBottom: 4 }]}>Activités réalisées :</Text>
                        <Text style={[styles.value, { fontStyle: 'italic' }]}>{convention.activites}</Text>
                    </View>
                    <View style={{ marginTop: 5 }}>
                        <Text style={[styles.label, { width: '100%', marginBottom: 4 }]}>Compétences mobilisées :</Text>
                        <Text style={[styles.value, { fontStyle: 'italic' }]}>{convention.attestation_competences || "Non spécifié"}</Text>
                    </View>
                </View>

                {/* GRATIFICATION & LIEU */}
                <View style={{ marginTop: 15, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ width: '60%' }}>
                        {convention.gratification_montant ? (
                            <Text style={styles.text}>Gratification versée : {convention.attestation_gratification || '0'} €</Text>
                        ) : null}
                        <Text style={[styles.text, { marginTop: 5 }]}>Fait à : {convention.attestation_fait_a || convention.ent_ville || '..................'}</Text>
                        <Text style={styles.text}>Le : {convention.attestationDate ? new Date(convention.attestationDate).toLocaleDateString() : '..................'}</Text>
                    </View>
                </View>

                {/* SIGNATURE */}
                <View wrap={false}>
                    <Text style={{ marginTop: 15, fontWeight: 'bold', fontSize: 10 }}>Signature et cachet de l'entreprise</Text>
                    <View style={[styles.signatureBox, { width: '60%', alignSelf: 'flex-start', marginTop: 5 }]}>
                        {convention.attestationSigned ? (
                            convention.attestation_signature_img ? (
                                <>
                                    <Image src={convention.attestation_signature_img} style={{ width: 150, height: 60, objectFit: 'contain' }} />
                                    {convention.attestation_signature_code && (
                                        <View style={{ marginTop: 2, alignItems: 'center' }}>
                                            <Text style={{ fontSize: 6, color: 'gray' }}>Code: {convention.attestation_signature_code}</Text>
                                            {convention.attestation_signer_name && (
                                                <Text style={{ fontSize: 8 }}>
                                                    {convention.attestation_signer_name}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </>
                            ) : (
                                <Text style={{ color: 'green', fontSize: 10, textAlign: 'center', marginTop: 20 }}>SIGNE ELECTRONIQUEMENT</Text>
                            )
                        ) : (
                            <Text style={{ color: '#ccc', textAlign: 'center', marginTop: 25 }}>Signature en attente</Text>
                        )}
                    </View>
                </View>

                {convention.attestationSigned && qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
            </Page>

            {convention.attestationSigned && (
                <CertificatePage data={certificateData} hashCode={hashCode} qrCodeUrl={qrCodeUrl} />
            )}
        </Document>
    );
}

// Keep the export for compatibility if used elsewhere as named export
export const AttestationPdfDocument = AttestationPdf;

