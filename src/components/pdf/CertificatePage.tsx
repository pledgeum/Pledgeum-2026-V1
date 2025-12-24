import React from 'react';
import { Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Convention } from '@/store/convention';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.3,
        color: '#000',
    },
    table: {
        display: 'flex',
        flexDirection: 'column',
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: 10,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
    },
    tableCell: {
        padding: 4,
        borderRightWidth: 1,
        borderRightColor: '#000',
        fontSize: 9,
    },
    tableHeader: {
        backgroundColor: '#f0f0f0',
        fontWeight: 'bold',
    },
});

export function CertificatePage({ data, hashCode, qrCodeUrl }: { data: Partial<Convention>, hashCode?: string, qrCodeUrl?: string }) {
    return (
        <Page size="A4" style={styles.page}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 10, marginBottom: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: '#1d4ed8' }}>
                    CERTIFICAT DE SIGNATURE ÉLECTRONIQUE
                </Text>
                <Text style={{ fontSize: 10, textAlign: 'center', color: '#666', marginTop: 5 }}>
                    PREUVE D'INTÉGRITÉ
                </Text>
            </View>

            <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                    <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Référence du Document :</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Courier', marginTop: 2 }}>
                        {hashCode || data.id || 'N/A'}
                    </Text>
                </View>
                {qrCodeUrl && (
                    <View style={{ alignItems: 'center' }}>
                        <Image src={qrCodeUrl} style={{ width: 60, height: 60 }} />
                        <Text style={{ fontSize: 6, color: '#666', marginTop: 2 }}>Authenticité vérifiable</Text>
                    </View>
                )}
            </View>

            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10 }}>Journal des événements (Audit Log) :</Text>

            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <View style={[styles.tableCell, { width: '25%' }]}><Text>Date / Heure</Text></View>
                    <View style={[styles.tableCell, { width: '20%' }]}><Text>Action</Text></View>
                    <View style={[styles.tableCell, { width: '35%' }]}><Text>Acteur (Email)</Text></View>
                    <View style={[styles.tableCell, { width: '20%' }]}><Text>IP / Détails</Text></View>
                </View>
                {data.auditLogs?.map((log, i) => (
                    <View key={i} style={styles.tableRow}>
                        <View style={[styles.tableCell, { width: '25%' }]}>
                            <Text>{new Date(log.date).toLocaleString('fr-FR')}</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '20%' }]}>
                            <Text>{log.action}</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '35%' }]}>
                            <Text>{log.actorEmail}</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '20%' }]}>
                            <Text>{log.ip || '-'} {log.details ? `(${log.details})` : ''}</Text>
                        </View>
                    </View>
                ))}
                {!data.auditLogs?.length && (
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCell, { width: '100%' }]}><Text>Aucun événement enregistré.</Text></View>
                    </View>
                )}
            </View>

            <View style={{ marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 10 }}>
                <Text style={{ fontSize: 8, color: '#666', textAlign: 'center' }}>
                    Ce document est scellé cryptographiquement. Toute modification invalidera le sceau numérique.
                </Text>
                <Text style={{ fontSize: 8, color: '#666', textAlign: 'center' }}>
                    Généré électroniquement le {new Date().toLocaleString('fr-FR')}
                </Text>
            </View>
        </Page>
    );
}
