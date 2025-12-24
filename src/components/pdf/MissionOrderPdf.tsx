import React from 'react';
import { Text, View, Image, StyleSheet, Document } from '@react-pdf/renderer';
import { MissionOrder } from '@/store/missionOrder';
import { Convention } from '@/store/convention';
import { PdfLayout } from './PdfLayout';
import { pdfTheme, commonStyles } from '@/lib/pdf/theme';

const styles = StyleSheet.create({
    signatureRow: {
        marginTop: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    signatureBlock: {
        width: '45%',
        border: `1pt solid ${pdfTheme.colors.lightGray}`,
        padding: 10,
        height: 120,
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: pdfTheme.colors.background,
    },
    signatureExample: {
        width: 120,
        height: 60,
        objectFit: 'contain'
    }
});

interface MissionOrderPdfProps {
    missionOrder: MissionOrder;
    convention: Convention;
    qrCodeUrl?: string; // For audit
}

export function MissionOrderPdf({ missionOrder, convention, qrCodeUrl }: MissionOrderPdfProps) {
    return (
        <Document>
            <PdfLayout
                title="ORDRE DE MISSION PERMANENT"
                docId={missionOrder.id}
                establishmentName={convention.ecole_nom}
                establishmentAddress={convention.ecole_adresse}
            >
                <Text style={[commonStyles.text, { fontStyle: 'italic', marginBottom: 20 }]}>
                    Suivi Pédagogique de Période de Formation en Milieu Professionnel (PFMP)
                </Text>

                {/* BENEFICIAIRE */}
                <View style={commonStyles.section}>
                    <Text style={commonStyles.h2}>Bénéficiaire de l'Ordre de Mission</Text>

                    <View style={commonStyles.row}>
                        <View style={commonStyles.col}>
                            <Text style={commonStyles.label}>Nom / Prénom :</Text>
                            <Text style={commonStyles.value}>{missionOrder.teacherId} (Enseignant)</Text>
                        </View>
                        <View style={commonStyles.col}>
                            <Text style={commonStyles.label}>Fonction :</Text>
                            <Text style={commonStyles.value}>Enseignant Référent chargé du suivi</Text>
                        </View>
                    </View>

                    <View style={[commonStyles.row, { marginTop: 5 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={commonStyles.label}>Etablissement d'exercice :</Text>
                            <Text style={commonStyles.value}>{missionOrder.schoolAddress}</Text>
                        </View>
                    </View>
                </View>

                {/* DETAILS MISSION */}
                <View style={commonStyles.section}>
                    <Text style={commonStyles.h2}>Détails de la Mission</Text>

                    <View style={[commonStyles.row, { marginTop: 5 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={commonStyles.label}>Objet du déplacement :</Text>
                            <Text style={commonStyles.value}>Suivi pédagogique de l'élève {convention.eleve_prenom} {convention.eleve_nom}</Text>
                        </View>
                    </View>

                    <View style={[commonStyles.row, { marginTop: 5 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={commonStyles.label}>Lieu de la mission (Entreprise) :</Text>
                            <Text style={commonStyles.value}>{missionOrder.companyAddress}</Text>
                        </View>
                    </View>

                    <View style={[commonStyles.row, { marginTop: 5 }]}>
                        <View style={commonStyles.col}>
                            <Text style={commonStyles.label}>Période de validité :</Text>
                            <Text style={commonStyles.value}>Du {new Date(convention.stage_date_debut).toLocaleDateString()} au {new Date(convention.stage_date_fin || '').toLocaleDateString()}</Text>
                        </View>
                        <View style={commonStyles.col}>
                            <Text style={commonStyles.label}>Distance A/R estimée :</Text>
                            <Text style={commonStyles.value}>{missionOrder.distanceKm} km</Text>
                        </View>
                    </View>

                    <View style={[commonStyles.row, { marginTop: 5 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={commonStyles.label}>Moyen de transport autorisé :</Text>
                            <Text style={commonStyles.value}>Véhicule personnel (sous réserve d'assurance conforme)</Text>
                        </View>
                    </View>
                </View>

                {/* Signatures */}
                <View style={styles.signatureRow}>
                    <View style={styles.signatureBlock}>
                        <Text style={commonStyles.bold}>L'intéressé(e)</Text>
                        <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#999', marginTop: 20 }}>
                            (Pris connaissance le ..................)
                        </Text>
                    </View>

                    <View style={styles.signatureBlock}>
                        <Text style={commonStyles.bold}>Le Chef d'Établissement</Text>
                        {(missionOrder.signatureImg || convention.signatures?.headImg) ? (
                            <>
                                <Image
                                    src={missionOrder.signatureImg || convention.signatures?.headImg || ''}
                                    style={styles.signatureExample}
                                />
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 8, color: pdfTheme.colors.secondaryText }}>
                                        Signé le {new Date(missionOrder.signatureDate || convention.signatures?.headAt || new Date().toISOString()).toLocaleDateString()}
                                    </Text>
                                    {(missionOrder.signatureHash || convention.signatures?.headCode) && (
                                        <Text style={{ fontSize: 6, color: pdfTheme.colors.secondaryText }}>
                                            Réf: {missionOrder.signatureHash || convention.signatures?.headCode}
                                        </Text>
                                    )}
                                </View>
                            </>
                        ) : (
                            <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#999', marginTop: 20 }}>
                                En attente de signature
                            </Text>
                        )}
                    </View>
                </View>

                {/* FOOTER NOTE */}
                <Text style={{ position: 'absolute', bottom: 30, left: 0, right: 0, fontSize: 8, textAlign: 'center', color: '#94a3b8' }}>
                    Ce document est généré électroniquement via la plateforme Convention PFMP. Il vaut ordre de mission permanent pour la durée du stage indiqué.
                </Text>

                {/* QR CODE */}
                {qrCodeUrl && (
                    <View fixed style={{ position: 'absolute', bottom: 30, right: 0, alignItems: 'flex-end' }}>
                        <Image src={qrCodeUrl} style={{ width: 40, height: 40 }} />
                        <Text style={{ fontSize: 6, color: '#64748b' }}>Authenticité</Text>
                    </View>
                )}
            </PdfLayout>
        </Document>
    );
}
