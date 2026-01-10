import React from 'react';
import { Text, View, Image, StyleSheet, Document, Page } from '@react-pdf/renderer';
import { Student, ClassDefinition } from '@/store/school';
import { pdfTheme } from '@/lib/pdf/theme';

const styles = StyleSheet.create({
    page: {
        padding: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignContent: 'flex-start',
        backgroundColor: '#FFFFFF'
    },
    card: {
        width: '48%', // Two cards per row with gap
        height: 200, // Increased from 180 to fit birth date
        border: '1pt solid #e2e8f0',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        backgroundColor: '#f8fafc'
    },
    header: {
        flexDirection: 'row',
        marginBottom: 8, // Reduced from 10
        borderBottom: '1pt solid #cbd5e1',
        paddingBottom: 5,
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    schoolName: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1e293b'
    },
    logoText: {
        fontSize: 14,
        fontWeight: 'extrabold',
        color: '#2563eb'
    },
    body: {
        marginTop: 5
    },
    label: {
        fontSize: 8,
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 2
    },
    studentName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4 // Reduced from 10 to keep date close
    },
    credentialsBox: {
        backgroundColor: '#ffffff',
        border: '1pt dashed #cbd5e1',
        borderRadius: 4,
        padding: 8,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    credentialItem: {
        flex: 1
    },
    value: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#2563eb',
        fontFamily: 'Courier'
    },
    footer: {
        marginTop: 10,
        fontSize: 8,
        color: '#475569',
        textAlign: 'center'
    },
    url: {
        color: '#2563eb',
        textDecoration: 'underline'
    }
});

interface StudentCredentialsPdfProps {
    students: Student[];
    classInfo: ClassDefinition;
    schoolName: string;
}

// Helper to format date consistent with UI
const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        // If already DD/MM/YYYY
        if (dateString.includes('/')) return dateString;
        // If YYYY-MM-DD
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('fr-FR').format(date);
    } catch (e) {
        return dateString;
    }
};

export function StudentCredentialsPdf({ students, classInfo, schoolName }: StudentCredentialsPdfProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {students.map((student, index) => (
                    <View key={student.id} style={styles.card}>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.schoolName}>{schoolName}</Text>
                                <Text style={{ fontSize: 8, color: '#64748b' }}>Classe : {classInfo.name}</Text>
                            </View>
                            <Text style={styles.logoText}>PFMP</Text>
                        </View>

                        <View style={styles.body}>
                            <Text style={styles.label}>Élève Assigné</Text>
                            <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
                            {student.birthDate && (
                                <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 8 }}>
                                    Né(e) le : {formatDate(student.birthDate)}
                                </Text>
                            )}

                            <View style={styles.credentialsBox}>
                                <View style={styles.credentialItem}>
                                    <Text style={styles.label}>Identifiant</Text>
                                    <Text style={styles.value}>{student.tempId || 'N/A'}</Text>
                                </View>
                                <View style={[styles.credentialItem, { borderLeft: '1pt solid #e2e8f0', paddingLeft: 10 }]}>
                                    <Text style={styles.label}>Code Provisoire</Text>
                                    <Text style={styles.value}>{student.tempCode || '******'}</Text>
                                </View>
                            </View>
                        </View>

                        <Text style={styles.footer}>
                            Connectez-vous sur : <Text style={styles.url}>https://www.pledgeum.fr/</Text>
                            {'\n'}puis modifiez votre mot de passe.
                        </Text>
                    </View>
                ))}
            </Page>
        </Document>
    );
}
