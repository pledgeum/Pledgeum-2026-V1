import { StyleSheet, Font } from '@react-pdf/renderer';

// Register standard font if needed (though Helvetica is standard built-in)
// Font.register({ family: 'OpenSans', src: '...' });

export const pdfTheme = {
    colors: {
        primary: '#1E40AF', // Blue Administration Moderne
        text: '#1F2937',    // Dark Gray (Body)
        lightGray: '#E5E7EB', // Borders
        background: '#FFFFFF',
        white: '#FFFFFF',
        secondaryText: '#4B5563', // Lighter text for labels
    },
    fonts: {
        main: 'Helvetica',
        bold: 'Helvetica-Bold',
        italic: 'Helvetica-Oblique',
    },
    sizes: {
        h1: 18,
        h2: 14,
        h3: 11,
        body: 10,
        small: 9,
        footer: 8,
    },
    spacing: {
        margin: 20,     // mm roughly ~ 56pt
        padding: 10,
        block: 10,      // standard block spacing
    }
};

export const commonStyles = StyleSheet.create({
    page: {
        padding: 40, // ~14mm
        backgroundColor: pdfTheme.colors.background,
        fontFamily: pdfTheme.fonts.main,
        fontSize: pdfTheme.sizes.body,
        color: pdfTheme.colors.text,
        lineHeight: 1.4,
    },
    h1: {
        fontSize: pdfTheme.sizes.h1,
        fontFamily: pdfTheme.fonts.bold,
        color: pdfTheme.colors.primary,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 20,
        textAlign: 'center',
    },
    h2: {
        fontSize: pdfTheme.sizes.h2,
        fontFamily: pdfTheme.fonts.bold,
        color: pdfTheme.colors.primary,
        fontWeight: 'bold',
        marginBottom: 8,
        marginTop: 15,
        borderBottomWidth: 1,
        borderBottomColor: pdfTheme.colors.primary,
        paddingBottom: 2,
        textTransform: 'uppercase',
    },
    section: {
        marginBottom: 10,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    label: {
        fontFamily: pdfTheme.fonts.bold,
        fontSize: pdfTheme.sizes.body,
        width: '35%',
        color: pdfTheme.colors.text,
    },
    value: {
        flex: 1,
        fontSize: pdfTheme.sizes.body,
        color: pdfTheme.colors.text,
    },
    text: {
        fontSize: pdfTheme.sizes.body,
        color: pdfTheme.colors.text,
        marginBottom: 4,
        textAlign: 'justify',
    },
    col: {
        flex: 1,
        paddingRight: 10,
    },
    bold: {
        fontFamily: pdfTheme.fonts.bold,
        fontWeight: 'bold',
    }
});
