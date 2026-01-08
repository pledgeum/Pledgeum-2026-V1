import React from 'react';
import { Text, View, Image, StyleSheet, Document, Page } from '@react-pdf/renderer';
import { Teacher } from '@/store/school';
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
        height: 180, // Approx 4-5 rows per page
        border: '1pt solid #e2e8f0',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        backgroundColor: '#f8fafc'
    },
    header: {
        flexDirection: 'row',
        marginBottom: 10,
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
        marginBottom: 10
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

interface TeacherCredentialsPdfProps {
    teachers: Teacher[];
    schoolName: string;
    className?: string; // Optional context
}

export function TeacherCredentialsPdf({ teachers, schoolName, className }: TeacherCredentialsPdfProps) {
    const validTeachers = teachers.filter(t => t.tempId && t.tempCode);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {validTeachers.map((teacher, index) => (
                    <View key={teacher.id} style={styles.card}>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.schoolName}>{schoolName}</Text>
                                <Text style={{ fontSize: 8, color: '#64748b' }}>
                                    {className ? `Équipe Pédagogique - ${className}` : 'Équipe Pédagogique'}
                                </Text>
                            </View>
                            <Text style={styles.logoText}>PFMP</Text>
                        </View>

                        <View style={styles.body}>
                            <Text style={styles.label}>Enseignant</Text>
                            <Text style={styles.studentName}>{teacher.firstName} {teacher.lastName.toUpperCase()}</Text>

                            <View style={styles.credentialsBox}>
                                <View style={styles.credentialItem}>
                                    <Text style={styles.label}>Identifiant</Text>
                                    <Text style={styles.value}>{teacher.tempId || 'N/A'}</Text>
                                </View>
                                <View style={[styles.credentialItem, { borderLeft: '1pt solid #e2e8f0', paddingLeft: 10 }]}>
                                    <Text style={styles.label}>Code Provisoire</Text>
                                    <Text style={styles.value}>{teacher.tempCode || '******'}</Text>
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
