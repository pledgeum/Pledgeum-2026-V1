import React from 'react';
import { Text, View, Image, StyleSheet, Document } from '@react-pdf/renderer';
import { Convention } from '@/store/convention';
import { CertificatePage } from './CertificatePage';
import { PdfLayout } from './PdfLayout';
import { pdfTheme, commonStyles } from '@/lib/pdf/theme';

const styles = StyleSheet.create({
    signatureBox: {
        border: `1pt solid ${pdfTheme.colors.lightGray}`,
        height: 80,
        width: 150,
        marginTop: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: pdfTheme.colors.background,
    },
    benefitSection: {
        marginTop: 10,
        padding: 10,
        backgroundColor: '#F9FAFB', // Light gray background for emphasis
        borderRadius: 4,
    }
});

interface AttestationPdfProps {
    convention: Convention;
    totalAbsenceHours: number;
    qrCodeUrl?: string;
    hashCode?: string;
}

export function AttestationPdf({ convention, totalAbsenceHours, qrCodeUrl, hashCode }: AttestationPdfProps) {
    const plannedHours = convention.stage_duree_heures || 0;
    const effectiveHours = Math.max(0, plannedHours - totalAbsenceHours);
    // Assuming 7 hours per day standard for day calculation if not saved
    const calculatedDays = convention.attestation_total_jours || Math.round((effectiveHours / 7) * 10) / 10;

    return (
        <PdfLayout
            title="ATTESTATION DE STAGE"
            docId={hashCode}
            establishmentName={convention.ecole_nom}
            establishmentAddress={convention.ecole_adresse}
        >
            <Text style={commonStyles.h1}>ANNEXE 3 : ATTESTATION DE STAGE TYPE</Text>

            <Text style={commonStyles.text}>
                Conformément à l’article D. 124-9 du code de l’éducation, une attestation de stage est délivrée par l’organisme d’accueil à tout élève.
                Ce document doit être complété et signé le dernier jour du stage par un responsable autorisé de l’entreprise d’accueil.
                Elle est remise au lycéen stagiaire, et également remise à l’établissement scolaire.
            </Text>

            {/* L'entreprise */}
            <View style={commonStyles.section}>
                <Text style={commonStyles.h2}>L’entreprise (ou l’organisme d’accueil)</Text>

                <View style={commonStyles.row}>
                    <View style={commonStyles.col}>
                        <Text style={commonStyles.label}>Nom :</Text>
                        <Text style={commonStyles.value}>{convention.ent_nom}</Text>
                    </View>
                    <View style={commonStyles.col}>
                        <Text style={commonStyles.label}>N° Siret :</Text>
                        <Text style={commonStyles.value}>{convention.ent_siret}</Text>
                    </View>
                </View>

                <View style={[commonStyles.row, { marginTop: 5 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={commonStyles.label}>Adresse :</Text>
                        <Text style={commonStyles.value}>{convention.ent_adresse}</Text>
                    </View>
                </View>

                <View style={[commonStyles.row, { marginTop: 5 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={commonStyles.label}>Représenté(e) par :</Text>
                        <Text style={commonStyles.value}>{convention.ent_rep_nom}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={commonStyles.label}>Fonction :</Text>
                        <Text style={commonStyles.value}>{convention.ent_rep_fonction}</Text>
                    </View>
                </View>
            </View>

            {/* L'élève */}
            <View style={commonStyles.section}>
                <Text style={commonStyles.h2}>Atteste que l’élève désigné ci-dessous</Text>
                <View style={commonStyles.row}>
                    <View style={commonStyles.col}>
                        <Text style={commonStyles.label}>Prénom :</Text>
                        <Text style={commonStyles.value}>{convention.eleve_prenom}</Text>
                    </View>
                    <View style={commonStyles.col}>
                        <Text style={commonStyles.label}>Nom :</Text>
                        <Text style={commonStyles.value}>{convention.eleve_nom}</Text>
                    </View>
                </View>
                <View style={[commonStyles.row, { marginTop: 5 }]}>
                    <View style={commonStyles.col}>
                        <Text style={commonStyles.label}>Classe :</Text>
                        <Text style={commonStyles.value}>{convention.eleve_classe}</Text>
                    </View>
                    <View style={commonStyles.col}>
                        <Text style={commonStyles.label}>Né(e) le :</Text>
                        <Text style={commonStyles.value}>{new Date(convention.eleve_date_naissance).toLocaleDateString()}</Text>
                    </View>
                </View>
            </View>

            {/* Établissement scolaire */}
            <View style={commonStyles.section}>
                <Text style={commonStyles.h2}>Scolarisé dans l’établissement ci-après</Text>
                <View style={commonStyles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={commonStyles.label}>Nom :</Text>
                        <Text style={commonStyles.value}>{convention.ecole_nom}</Text>
                    </View>
                </View>
                <View style={[commonStyles.row, { marginTop: 5 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={commonStyles.label}>Adresse :</Text>
                        <Text style={commonStyles.value}>{convention.ecole_adresse}</Text>
                    </View>
                </View>
                <View style={[commonStyles.row, { marginTop: 5 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={commonStyles.label}>Chef d'établissement scolaire :</Text>
                        <Text style={commonStyles.value}>{convention.ecole_chef_nom}</Text>
                    </View>
                </View>
            </View>

            {/* Détails du stage */}
            <View style={commonStyles.section}>
                <Text style={commonStyles.text}>
                    A effectué un stage dans notre entreprise ou organisme du <Text style={commonStyles.bold}>{new Date(convention.stage_date_debut).toLocaleDateString()}</Text> au <Text style={commonStyles.bold}>{new Date(convention.stage_date_fin || '').toLocaleDateString()}</Text>.
                </Text>
                <Text style={[commonStyles.text, { marginTop: 10 }]}>
                    Soit une durée effective totale de : <Text style={commonStyles.bold}>{calculatedDays}</Text> jours
                </Text>
                <Text style={{ fontSize: 9, color: pdfTheme.colors.secondaryText, marginTop: 2 }}>
                    ({effectiveHours} heures effectives sur {plannedHours} heures prévues)
                </Text>
            </View>

            {/* Activités et Compétences */}
            <View style={{ marginTop: 10 }}>
                <Text style={commonStyles.label}>Activités réalisées :</Text>
                <Text style={[commonStyles.value, { borderBottomWidth: 0, marginTop: 2 }]}>{convention.activites}</Text>
            </View>

            <View style={{ marginTop: 10 }}>
                <Text style={commonStyles.label}>Compétences mobilisées :</Text>
                <Text style={[commonStyles.value, { borderBottomWidth: 0, marginTop: 2 }]}>{convention.attestation_competences || "Non spécifié"}</Text>
            </View>

            {/* Footer Signature */}
            <View style={{ marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: '60%' }}>
                    <Text style={commonStyles.text}>Gratification versée : {convention.attestation_gratification || '0'} €</Text>
                    <Text style={[commonStyles.text, { marginTop: 10 }]}>Fait à : {convention.attestation_fait_a || convention.ent_ville || '..................'}</Text>
                    <Text style={commonStyles.text}>Le : {convention.attestationDate ? new Date(convention.attestationDate).toLocaleDateString() : '..................'}</Text>
                </View>
                <View style={{ width: '40%', alignItems: 'center' }}>
                    <Text style={commonStyles.bold}>Signature et cachet</Text>
                    <View style={styles.signatureBox}>
                        {convention.attestationSigned ? (
                            convention.attestation_signature_img ? (
                                <>
                                    <Image src={convention.attestation_signature_img} style={{ width: 100, height: 40 }} />
                                    {convention.attestation_signature_code && (
                                        <View style={{ marginTop: 2 }}>
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
                                <Text style={{ color: 'green', fontSize: 10 }}>SIGNE ELECTRONIQUEMENT</Text>
                            )
                        ) : (
                            <Text style={{ color: '#ccc' }}>Signature</Text>
                        )}
                    </View>
                </View>
            </View>

            {/* QR Code */}
            {qrCodeUrl && (
                <View fixed style={{ position: 'absolute', bottom: 30, right: 10, alignItems: 'flex-end', opacity: 0.8 }}>
                    <Image src={qrCodeUrl} style={{ width: 50, height: 50 }} />
                    <Text style={{ fontSize: 6, color: '#666', marginTop: 2 }}>Authenticité vérifiable</Text>
                    {hashCode && (
                        <Text style={{ fontSize: 5, color: '#999', marginTop: 1, fontFamily: 'Courier' }}>
                            ID: {hashCode}
                        </Text>
                    )}
                </View>
            )}

            {/* Certificat Page usually goes here, we keep it as separate child for now or include relevant part if needed. 
                Original code had it outside Page but inside Document. 
                PdfLayout returns a Page. 
                This means we can't put CertificatePage INSIDE PdfLayout easily if CertificatePage is indeed a Page itself. 
                Let's check CertificatePage import.
            */}
        </PdfLayout>
    );
}

// Wrapper to include CertificatePage which is likely a separate Page
export function AttestationPdfDocument(props: AttestationPdfProps) {
    return (
        <Document>
            <AttestationPdf {...props} />
            <CertificatePage data={props.convention} hashCode={props.hashCode} qrCodeUrl={props.qrCodeUrl} />
        </Document>
    );
}

