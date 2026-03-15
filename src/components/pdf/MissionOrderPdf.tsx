import React from 'react';
import { Text, View, Image, StyleSheet, Document } from '@react-pdf/renderer';
import { MissionOrder } from '@/store/missionOrder';
import { Convention } from '@/store/convention';
import { PdfLayout } from './PdfLayout';
import { pdfTheme, commonStyles } from '@/lib/pdf/theme';

const styles = StyleSheet.create({
    signatureRow: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    signatureBox: {
        width: '48%',
        height: 70,
        borderWidth: 0.5,
        borderColor: pdfTheme.colors.lightGray,
        padding: 5,
        marginBottom: 10,
        borderRadius: 2,
        position: 'relative',
    },
    signatureBoxValid: {
        borderColor: '#22c55e',
        backgroundColor: '#f0fdf4',
    },
    validBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        fontSize: 6,
        color: '#15803d',
        fontWeight: 'bold',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 2,
    },
    hashText: {
        fontSize: 4,
        color: '#6b7280',
        marginTop: 2,
        fontFamily: 'Courier',
    },
    signatureLabel: {
        fontSize: pdfTheme.sizes.small,
        fontFamily: pdfTheme.fonts.bold,
        color: pdfTheme.colors.secondaryText,
        marginBottom: 15,
    },
    authCodeBox: {
        marginTop: 4,
        paddingVertical: 2,
        paddingHorizontal: 4,
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#0284c7',
        borderRadius: 2,
        alignSelf: 'flex-start',
    },
    authCodeText: {
        fontSize: 5,
        color: '#0369a1',
        fontFamily: pdfTheme.fonts.bold,
    },
    // Fix layout for long addresses
    sectionContainer: {
        flexDirection: 'column',
        marginBottom: 10,
    },
    rowContainer: {
        flexDirection: 'row',
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    colContainer: {
        flex: 1,
        flexDirection: 'column',
        paddingRight: 10,
    },
    label: {
        fontFamily: pdfTheme.fonts.bold,
        fontSize: pdfTheme.sizes.body,
        color: pdfTheme.colors.text,
        marginBottom: 2,
    },
    value: {
        fontSize: pdfTheme.sizes.body,
        color: pdfTheme.colors.text,
    },
    addressValue: {
        fontSize: pdfTheme.sizes.body,
        color: pdfTheme.colors.text,
        marginTop: 2,
        marginBottom: 5,
        width: '100%',
    }
});

interface MissionOrderPdfProps {
    missionOrder: MissionOrder;
    convention: Convention;
    qrCodeUrl?: string; // For audit
    hashCode?: string;
}

export function MissionOrderPdf({ missionOrder, convention, qrCodeUrl, hashCode }: MissionOrderPdfProps) {
    const SignatureContent = ({ img, hash, date, code, signatureId, method, signerName, defaultLabel }: { img?: string, hash?: string, date?: string, code?: string, signatureId?: string, method?: string, signerName?: string, defaultLabel: string }) => {
        if (!img && method !== 'OTP') return null;
        return (
            <View>
                {img ? (
                    <Image src={img} style={{ width: 100, height: 35, objectFit: 'contain' }} />
                ) : (
                    <View style={{ padding: 2, borderLeftWidth: 1, borderLeftColor: '#0284c7', marginLeft: 2 }}>
                        <Text style={{ fontSize: 6, fontFamily: pdfTheme.fonts.bold, color: '#0369a1' }}>Signé numériquement par OTP</Text>
                        <Text style={{ fontSize: 6, color: '#334155', marginTop: 1 }}>{signerName || defaultLabel}</Text>
                    </View>
                )}
                {hash && (
                    <View style={styles.validBadge}>
                        <Text>✅ SIGNÉ</Text>
                    </View>
                )}
                {date && <Text style={{ fontSize: 5, color: '#059669', marginTop: 1 }}>Le {new Date(date).toLocaleString('fr-FR')}</Text>}
                {(code || signatureId) && (
                    <View style={[styles.authCodeBox, { marginTop: 1, paddingVertical: 1 }]}>
                        <Text style={styles.authCodeText}>Certificat: {signatureId || code}</Text>
                    </View>
                )}
                {hash && <Text style={styles.hashText}>Hash: {hash.substring(0, 24)}...</Text>}
            </View>
        );
    };

    // Strictly use Mission Order signature data (remove fallbacks to convention)
    const headImg = missionOrder.signature_data?.head?.img;
    const headHash = missionOrder.signature_data?.head?.hash;
    const headDate = missionOrder.signature_data?.head?.date;
    const headCode = missionOrder.signature_data?.head?.hash;

    return (
        <Document>
            <PdfLayout
                title="ORDRE DE MISSION PERMANENT"
                docId={missionOrder.id}
                establishmentName={convention.ecole_nom}
                establishmentAddress={convention.ecole_adresse}
            >
                <Text style={[commonStyles.text, { fontStyle: 'italic', marginBottom: 20 }]}>
                    Suivi Pédagogique de Période de Formation en Milieu Professionnel (PFMP) ou de stage.
                </Text>

                {/* BENEFICIAIRE */}
                <View style={commonStyles.section}>
                    <Text style={commonStyles.h2}>Bénéficiaire de l'Ordre de Mission</Text>

                    <View style={styles.sectionContainer}>
                        <View style={styles.rowContainer}>
                            <View style={styles.colContainer}>
                                <Text style={styles.label}>Nom / Prénom :</Text>
                                <Text style={styles.value}>
                                    {convention.visit?.tracking_teacher_first_name && convention.visit?.tracking_teacher_last_name
                                        ? `${convention.visit.tracking_teacher_first_name} ${convention.visit.tracking_teacher_last_name} (${missionOrder.teacherId})`
                                        : missionOrder.teacherId}
                                    {" "}(Enseignant)
                                </Text>
                            </View>
                            <View style={styles.colContainer}>
                                <Text style={styles.label}>Fonction :</Text>
                                <Text style={styles.value}>Enseignant Référent chargé du suivi</Text>
                            </View>
                        </View>

                        <View style={{ marginTop: 5 }}>
                            <Text style={styles.label}>Etablissement d'exercice :</Text>
                            <Text style={styles.addressValue}>
                                {convention.school ? `${convention.school.address} ${convention.school.zipCode} ${convention.school.city}`.trim() : missionOrder.schoolAddress}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* DETAILS MISSION */}
                <View style={commonStyles.section}>
                    <Text style={commonStyles.h2}>Détails de la Mission</Text>

                    <View style={styles.sectionContainer}>
                        {/* Object de la mission */}
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.label}>Objet du déplacement :</Text>
                            <Text style={styles.value}>Suivi pédagogique de l'élève {convention.eleve_prenom} {convention.eleve_nom}</Text>
                        </View>

                        {/* Lieu de la mission */}
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.label}>Lieu de la mission (Entreprise) :</Text>
                            <Text style={styles.addressValue}>{missionOrder.companyAddress}</Text>
                        </View>

                        {/* Période et Distance */}
                        <View style={styles.rowContainer}>
                            <View style={styles.colContainer}>
                                <Text style={styles.label}>Période de validité :</Text>
                                <Text style={styles.value}>Du {new Date(convention.stage_date_debut).toLocaleDateString()} au {new Date(convention.stage_date_fin || '').toLocaleDateString()}</Text>
                                
                                {/* Periods Detail */}
                                {convention.selected_periods_labels && convention.selected_periods_labels.length > 0 && (
                                    <View style={{ marginTop: 4, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }}>
                                        {convention.selected_periods_labels.map((label, idx) => (
                                            <Text key={idx} style={{ fontSize: 6, color: '#64748b' }}>• {label}</Text>
                                        ))}
                                    </View>
                                )}

                                {/* Out of Period Alert */}
                                {convention.is_out_of_period && (
                                    <View style={{ marginTop: 5, padding: 3, backgroundColor: '#fff7ed', borderWidth: 0.5, borderColor: '#fbbf24', borderRadius: 2 }}>
                                        <Text style={{ fontSize: 6, color: '#92400e', fontFamily: pdfTheme.fonts.bold }}>
                                            ⚠️ Dates dérogatoires / Rattrapage
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.colContainer}>
                                <Text style={styles.label}>Distance A/R estimée :</Text>
                                <Text style={styles.value}>{missionOrder.distanceKm} km</Text>
                            </View>
                        </View>

                        {/* Moyen de transport */}
                        <View style={{ marginTop: 5 }}>
                            <Text style={styles.label}>Moyen de transport autorisé :</Text>
                            <Text style={styles.value}>Véhicule personnel (sous réserve d'assurance conforme)</Text>
                        </View>
                    </View>
                </View>

                {/* SIGNATURES */}
                <View wrap={false}>
                    <Text style={{ marginTop: 20, fontWeight: 'bold', fontSize: 11, borderTopWidth: 1, paddingTop: 10 }}>Signatures et cachets</Text>
                    <View style={styles.signatureRow}>
                        <View style={[styles.signatureBox, missionOrder.signature_data?.teacher?.hash ? styles.signatureBoxValid : {}]}>
                            <Text style={styles.signatureLabel}>L'intéressé(e) (Enseignant)</Text>
                            <SignatureContent
                                img={missionOrder.signature_data?.teacher?.img}
                                hash={missionOrder.signature_data?.teacher?.hash}
                                date={missionOrder.signature_data?.teacher?.date}
                                code={missionOrder.signature_data?.teacher?.hash}
                                method={missionOrder.signature_data?.teacher?.method}
                                signerName={missionOrder.signature_data?.teacher?.name}
                                defaultLabel="L'Enseignant Référent"
                            />
                        </View>

                        {/* Chef d'Établissement (Head) */}
                        <View style={[styles.signatureBox, headHash ? styles.signatureBoxValid : {}]}>
                            <Text style={styles.signatureLabel}>Le Chef d'Établissement</Text>
                            <SignatureContent
                                img={headImg}
                                hash={headHash}
                                date={headDate}
                                code={headCode}
                                signatureId={convention.signatures?.head?.signatureId}
                                method={missionOrder.signature_data?.head?.method}
                                signerName={missionOrder.signature_data?.head?.name}
                                defaultLabel="Le Chef d'Établissement"
                            />
                        </View>
                    </View>
                </View>

                {/* FOOTER NOTE */}
                <Text style={{ position: 'absolute', bottom: 10, left: 30, right: 100, fontSize: 7, textAlign: 'left', color: '#94a3b8' }}>
                    Ce document est généré électroniquement via la plateforme Convention PFMP. Il vaut ordre de mission permanent pour la durée du stage indiqué.
                </Text>

                {/* QR CODE & AUTHENTICATION */}
                {qrCodeUrl && (
                    <View fixed style={{ position: 'absolute', bottom: 10, right: 10, alignItems: 'flex-end', opacity: 0.8 }}>
                        <Image src={qrCodeUrl} style={{ width: 50, height: 50 }} />
                        <Text style={{ fontSize: 6, color: '#666', marginTop: 2 }}>Authenticité vérifiable</Text>
                        {hashCode && (
                            <Text style={{ fontSize: 5, color: '#4b5563', marginTop: 1, fontFamily: 'Courier', fontWeight: 'bold' }}>
                                Certificat d'Authenticité Numérique : {hashCode.startsWith('ODM-') ? hashCode : `ODM-${hashCode}`}
                            </Text>
                        )}
                    </View>
                )}
            </PdfLayout>
        </Document>
    );
}
