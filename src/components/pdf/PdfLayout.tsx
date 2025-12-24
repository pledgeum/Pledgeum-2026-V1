import React from 'react';
import { Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { pdfTheme, commonStyles } from '@/lib/pdf/theme';

interface PdfLayoutProps {
    children: React.ReactNode;
    title?: string;
    establishmentName?: string;
    establishmentAddress?: string;
    docId?: string; // Hash or Convention ID
    pageOrientation?: 'portrait' | 'landscape';
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: pdfTheme.colors.lightGray,
        paddingBottom: 10,
    },
    logoSection: {
        width: '30%',
    },
    logoText: {
        fontSize: 16,
        fontFamily: pdfTheme.fonts.bold,
        color: pdfTheme.colors.primary,
    },
    schoolInfo: {
        width: '70%',
        textAlign: 'right',
    },
    schoolName: {
        fontSize: 12,
        fontFamily: pdfTheme.fonts.bold,
        color: pdfTheme.colors.text,
    },
    schoolAddress: {
        fontSize: 9,
        color: pdfTheme.colors.secondaryText,
        marginTop: 2,
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 40,
        right: 40,
        borderTopWidth: 0.5,
        borderTopColor: pdfTheme.colors.lightGray,
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerText: {
        fontSize: pdfTheme.sizes.footer,
        color: pdfTheme.colors.secondaryText,
    },
    pageNumber: {
        fontSize: pdfTheme.sizes.footer,
        color: pdfTheme.colors.secondaryText,
    }
});

export const PdfLayout = ({
    children,
    title,
    establishmentName = "Lycée Polyvalent Exemple",
    establishmentAddress = "123 Rue de l'Éducation, 75000 Paris",
    docId,
    pageOrientation = 'portrait'
}: PdfLayoutProps) => {
    return (
        <Page size="A4" style={commonStyles.page} orientation={pageOrientation}>
            {/* Header */}
            <View style={styles.header} fixed>
                <View style={styles.logoSection}>
                    {/* Empty as requested */}
                </View>
                <View style={styles.schoolInfo}>
                    <Text style={styles.schoolName}>{establishmentName}</Text>
                    <Text style={styles.schoolAddress}>{establishmentAddress}</Text>
                </View>
            </View>

            {/* Content */}
            {children}

            {/* Footer */}
            <View style={styles.footer} fixed>
                <Text style={styles.footerText}>
                    {docId ? `ID: ${docId}` : 'Document généré électroniquement'}
                </Text>
                <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
                    `Page ${pageNumber} sur ${totalPages}`
                )} />
            </View>
        </Page>
    );
};
