import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { ConventionData } from '@/types/schema';
import { Convention, AuditLog } from '@/store/convention';
import { CertificatePage } from './CertificatePage';
import { pdfTheme, commonStyles } from '@/lib/pdf/theme';
import { PdfLayout } from './PdfLayout';

// Additional specific styles if needed
const localStyles = StyleSheet.create({
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
        position: 'relative', // For absolute positioning of badge if needed
    },
    signatureBoxValid: {
        borderColor: '#22c55e', // Green border
        backgroundColor: '#f0fdf4', // Light green bg
    },
    validBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        fontSize: 6,
        color: '#15803d', // Dark green
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
    // Annexes
    annexTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 20,
        textTransform: 'uppercase',
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
        fontSize: 8,
    },
    tableHeader: {
        backgroundColor: '#f0f0f0',
        fontWeight: 'bold',
    },
    checkbox: {
        width: 10,
        height: 10,
        borderWidth: 1,
        borderColor: '#000',
        marginRight: 5,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    // Styled "Stamp" for auth code
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
    rejectionBox: {
        borderColor: '#ef4444',
        backgroundColor: '#fef2f2',
    },
    rejectionText: {
        fontSize: 14,
        color: '#b91c1c',
        fontFamily: pdfTheme.fonts.bold,
        textAlign: 'center',
        marginTop: 5,
        textTransform: 'uppercase',
    },
    rejectionReasonBox: {
        marginTop: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: '#fca5a5',
        backgroundColor: '#fff1f1',
        borderRadius: 4,
    },
    rejectionReasonTitle: {
        fontSize: 9,
        color: '#b91c1c',
        fontFamily: pdfTheme.fonts.bold,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    rejectionReasonText: {
        fontSize: 10,
        color: '#7f1d1d',
        fontFamily: pdfTheme.fonts.italic,
        lineHeight: 1.4,
    }
});

// Map legacy styles to theme and local styles
// Map legacy styles to theme and local styles
const styles = {
    ...localStyles,
    page: { ...commonStyles.page, padding: 30, fontSize: 9 }, // Reduced body font size
    header: { ...commonStyles.h1, fontSize: 12, marginBottom: 8 },
    subHeader: { fontSize: 10, textAlign: 'center' as const, marginBottom: 8, fontFamily: pdfTheme.fonts.bold, color: pdfTheme.colors.primary, textTransform: 'uppercase' as const },
    sectionTitle: { ...commonStyles.h2, fontSize: 10, marginTop: 6, marginBottom: 3 },
    row: { ...commonStyles.row, marginBottom: 2 },
    label: { ...commonStyles.label, fontSize: 9 },
    value: { ...commonStyles.value, fontSize: 9 },
    text: { ...commonStyles.text, fontSize: 9 },
    articleTitle: { fontSize: 10, fontFamily: pdfTheme.fonts.bold, marginTop: 8, marginBottom: 4, fontWeight: 'bold' as const },
};

interface PdfProps {
    data: Partial<Convention>;
    qrCodeUrl?: string;
    hashCode?: string;
}



// --- QR CODE ELEMENT ---
const QrCodeFooter = ({ url, code }: { url: string, code?: string }) => (
    <View style={{ position: 'absolute', bottom: 10, right: 10, alignItems: 'flex-end', opacity: 0.8 }}>
        <Image src={url} style={{ width: 50, height: 50 }} />
        <Text style={{ fontSize: 6, color: '#666', marginTop: 2 }}>Authenticité vérifiable</Text>
        {code && (
            <Text style={{ fontSize: 5, color: '#4b5563', marginTop: 1, fontFamily: 'Courier', fontWeight: 'bold' }}>
                Certificat d'Authenticité Numérique : {code}
            </Text>
        )}
    </View>
);

// --- STANDARD PDF TEMPLATE (Existing CERFA-like) ---
function StandardConventionPdf({ data, qrCodeUrl, hashCode }: PdfProps) {
    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '...';
    // Helper to render signature content
    const SignatureContent = ({ img, hash, date, code, signatureId }: { img?: string, hash?: string, date?: string, code?: string, signatureId?: string }) => {
        if (!img) return null;
        return (
            <View>
                <Image src={img} style={{ width: 100, height: 35, objectFit: 'contain' }} />
                {hash && (
                    <View style={localStyles.validBadge}>
                        <Text>✅ SIGNÉ</Text>
                    </View>
                )}
                {date && <Text style={{ fontSize: 5, color: '#059669', marginTop: 1 }}>Le {new Date(date).toLocaleString('fr-FR')}</Text>}
                {(code || signatureId) && (
                    <View style={[localStyles.authCodeBox, { marginTop: 1, paddingVertical: 1 }]}>
                        <Text style={localStyles.authCodeText}>Certificat: {signatureId || code}</Text>
                    </View>
                )}
                {hash && <Text style={localStyles.hashText}>Hash: {hash.substring(0, 24)}...</Text>}
            </View>
        );
    };

    return (
        <Document>
            {/* --- MAIN CONVENTION --- */}
            <Page size="A4" style={styles.page}>
                <View style={{ marginBottom: 10 }}>
                    <Text style={styles.header}>
                        CONVENTION RELATIVE À LA FORMATION EN MILIEU PROFESSIONNEL DES ÉLÈVES DE LYCÉE PROFESSIONNEL
                    </Text>

                    <Text style={styles.subHeader}>
                        {data.ecole_nom || 'ÉTABLISSEMENT NON DÉFINI'} - {data.ecole_adresse || 'Adresse non définie'}
                    </Text>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Intitulé du diplôme préparé :</Text>
                    <Text style={styles.value}>{data.diplome_intitule || 'Bac Pro ...'}</Text>
                </View>

                {/* ENTREPRISE */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Entre l’entreprise (ou l’organisme d’accueil) ci-dessous désigné(e)</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nom :</Text>
                        <Text style={styles.value}>{data.ent_nom}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Adresse :</Text>
                        <Text style={styles.value}>{data.ent_adresse}</Text>
                    </View>
                    {/* Pays ONLY if not France */}
                    {data.ent_pays && data.ent_pays !== 'France' && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Pays :</Text>
                            <Text style={styles.value}>{data.ent_pays}</Text>
                        </View>
                    )}
                    <View style={styles.row}>
                        <Text style={styles.label}>N° Siret :</Text>
                        <Text style={styles.value}>{data.ent_siret || 'N/A (Étranger)'}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Représenté(e) par :</Text>
                        <Text style={styles.value}>{data.ent_rep_nom} ({data.ent_rep_fonction})</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Tuteur de stage :</Text>
                        <Text style={styles.value}>{data.tuteur_nom} ({data.tuteur_fonction})</Text>
                    </View>
                </View>

                {/* ECOLE */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>L’établissement d’enseignement professionnel</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nom :</Text>
                        <Text style={styles.value}>{data.ecole_nom}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Adresse :</Text>
                        <Text style={styles.value}>{data.ecole_adresse}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Représenté par :</Text>
                        <Text style={styles.value}>
                            {(data as any).metadata?.signatories?.principal?.name
                                ? `${(data as any).metadata.signatories.principal.name}` // Dynamic
                                : data.ecole_chef_nom // Fallback
                            }
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Enseignant-référent/Professeur Principal :</Text>
                        <Text style={styles.value}>{data.prof_nom}</Text>
                    </View>
                </View>

                {/* ELEVE */}
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>L’élève</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nom Prénom :</Text>
                        <Text style={styles.value}>{data.eleve_nom} {data.eleve_prenom}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Date de naissance :</Text>
                        <Text style={styles.value}>{formatDate(data.eleve_date_naissance)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Adresse :</Text>
                        <Text style={styles.value}>{data.eleve_adresse}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Classe :</Text>
                        <Text style={styles.value}>{data.eleve_classe}</Text>
                    </View>
                </View>

                <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Pour une durée</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Du :</Text>
                        <Text style={styles.value}>{formatDate(data.stage_date_debut)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Au :</Text>
                        <Text style={styles.value}>{formatDate(data.stage_date_fin)}</Text>
                    </View>

                    {/* Periods Detail */}
                    {data.selected_periods_labels && data.selected_periods_labels.length > 0 && (
                        <View style={{ marginTop: 4, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }}>
                            <Text style={{ fontSize: 7, color: '#4b5563', fontFamily: pdfTheme.fonts.bold, marginBottom: 2 }}>
                                Périodes officielles suivies :
                            </Text>
                            {data.selected_periods_labels.map((label, idx) => (
                                <Text key={idx} style={{ fontSize: 7, color: '#6b7280' }}>• {label}</Text>
                            ))}
                        </View>
                    )}

                    {/* Out of Period Alert */}
                    {data.is_out_of_period && (
                        <View style={{ marginTop: 5, padding: 4, backgroundColor: '#fff7ed', borderWidth: 0.5, borderColor: '#fbbf24', borderRadius: 2 }}>
                            <Text style={{ fontSize: 7, color: '#92400e', fontFamily: pdfTheme.fonts.bold }}>
                                ⚠️ Stage de Rattrapage / Dates dérogatoires
                            </Text>
                            <Text style={{ fontSize: 6, color: '#b45309', marginTop: 1 }}>
                                Ce stage se déroule en dehors du calendrier collectif de la classe.
                            </Text>
                        </View>
                    )}
                </View>

                {/* HORAIRES */}
                <View style={{ marginTop: 10 }}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Horaires journaliers de l'élève (Hebdomadaire) :</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <Text style={[styles.tableCell, { width: '25%' }]}>Jour</Text>
                            <Text style={[styles.tableCell, { width: '37%' }]}>Matin</Text>
                            <Text style={[styles.tableCell, { width: '37%', borderRightWidth: 0 }]}>Après-midi</Text>
                        </View>
                        {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day) => {
                            const slots = data.stage_horaires?.[day];
                            if (!slots) return null;
                            return (
                                <View key={day} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { width: '25%' }]}>{day}</Text>
                                    <Text style={[styles.tableCell, { width: '37%' }]}>
                                        {slots.matin_debut && slots.matin_fin ? `${slots.matin_debut} - ${slots.matin_fin}` : '-'}
                                    </Text>
                                    <Text style={[styles.tableCell, { width: '37%', borderRightWidth: 0 }]}>
                                        {slots.apres_midi_debut && slots.apres_midi_fin ? `${slots.apres_midi_debut} - ${slots.apres_midi_fin}` : '-'}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                    <Text style={{ fontSize: 9, fontStyle: 'italic' }}>Soit une durée totale hebdomadaire : {data.stage_duree_heures} heures.</Text>
                </View>

                {/* LEGAL PREAMBLE (Moved from Page 2) */}
                <Text style={[styles.text, { fontSize: 8, color: '#666', marginTop: 10, textAlign: 'justify' }]}>
                    Vu le code du travail, notamment ses articles L.4121-1 et suivants, L.4153-1 à L.4153-9, L.4154-2 à L.4154-3, R.4153-38 à R.4153-52, D.4153-2 à D. 4153-4 et D.4153-15 à D. 4153-37,{'\n'}
                    Vu le code de l’éducation, notamment ses articles L.124-1 à 20, R.124-10 à R.124-13 et D. 124-1 à D. 124-9,{'\n'}
                    Vu la délibération du conseil d’administration du lycée approuvant la convention-type et autorisant le chef d’établissement à conclure au nom de l’établissement toute convention relative aux périodes de formation en milieu professionnel conforme à la convention-type.
                </Text>

                {data.status === 'VALIDATED_HEAD' && qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
            </Page>

            {/* --- LEGAL ARTICLES (Page 2+) --- */}
            <Page size="A4" style={styles.page}>


                <Text style={styles.articleTitle}>Article 1 - Objet de la convention</Text>
                <Text style={styles.text}>
                    La présente convention a pour objet la mise en œuvre, au bénéfice de l’élève de l’établissement désigné, de périodes de formation en milieu professionnel réalisées dans le cadre de l’enseignement professionnel.
                </Text>

                <Text style={styles.articleTitle}>Article 2 - Finalité de la formation en milieu professionnel</Text>
                <Text style={styles.text}>
                    Les périodes de formation en milieu professionnel correspondent à des périodes temporaires de mise en situation en milieu professionnel au cours desquelles l’élève acquiert des compétences professionnelles et met en œuvre les acquis de sa formation en vue d’obtenir un diplôme ou une certification et de favoriser son insertion professionnelle. Le stagiaire se voit confier une ou des missions conformes au projet pédagogique défini par son établissement d’enseignement et approuvées par l’organisme d’accueil (article L.124-1 du code de l’éducation). En aucun cas, sa participation à ces activités ne doit porter préjudice à la situation de l’emploi dans l’entreprise.
                </Text>

                <Text style={styles.articleTitle}>Article 3 - Dispositions de la convention</Text>
                <Text style={styles.text}>
                    La convention comprend des dispositions générales et des dispositions particulières constituées par les annexes pédagogique et financière. L’annexe pédagogique définit les objectifs et les modalités pédagogiques de la période de formation en milieu professionnel. L’annexe financière définit les modalités de prise en charge des frais afférents à la période, ainsi que les modalités d’assurance.
                </Text>

                <Text style={styles.articleTitle}>Article 4 - Obligations de la structure d’accueil</Text>
                <Text style={styles.text}>
                    La structure d’accueil doit désigner un tuteur de stage qui dispose des connaissances et de l’expérience nécessaires à l’encadrement d’un stagiaire et s’assurer de sa disponibilité pour assurer cette fonction pendant toute la durée du stage. La structure d’accueil veille à ce que le stagiaire bénéficie d’un accueil lors de son arrivée, au cours duquel il est informé des règles applicables dans l’établissement et notamment de celles relatives à la santé et à la sécurité.
                </Text>

                <Text style={styles.articleTitle}>Article 5 - Statut et obligations de l’élève</Text>
                <Text style={styles.text}>
                    L’élève demeure, durant la période de formation en milieu professionnel, sous statut scolaire. Il reste sous la responsabilité du chef d’établissement scolaire. L’élève n’est pas pris en compte dans le calcul de l’effectif de l’entreprise. Il ne peut participer aux éventuelles élections professionnelles. L’élève est soumis aux règles générales en vigueur dans l’entreprise, notamment en matière de santé et sécurité, d’horaires et de discipline, sous réserve des dispositions des articles 8 et 9. L’élève est soumis au secret professionnel. Il est tenu d’observer une entière discrétion sur l’ensemble des renseignements qu’il pourra recueillir. L’élève signale à l’enseignant référent/professeur principal les situations éventuelles de discrimination, harcèlement, violence à caractère sexiste ou sexuel.
                </Text>

                <Text style={styles.articleTitle}>Article 6 – Allocation de l’État</Text>
                <Text style={styles.text}>
                    Conformément au décret n°2023-765 du 11 août 2023 relatif au versement d’une allocation en faveur des lycéens de la voie professionnelle dans le cadre de la valorisation des périodes de formation en milieu professionnel, une allocation financière est créée à destination des lycéens. Cette allocation est versée par l’État au titre de l’ensemble des jours effectués par le lycéen en PFMP dans le cadre de la convention et attestés au moyen de l’attestation de stage.
                </Text>

                <Text style={styles.articleTitle}>Article 7 - Gratification par l’entreprise</Text>
                <Text style={styles.text}>
                    L’élève ne peut prétendre à aucune rémunération de l’entreprise. Toutefois, il peut lui être alloué une gratification. Lorsque la durée de la période de formation en milieu professionnel est supérieure à deux mois consécutifs ou, au cours d’une même année scolaire, à deux mois consécutifs ou non, la période fait l’objet d’une gratification versée mensuellement (15 % du plafond horaire de la sécurité sociale). Cette gratification n’a pas le caractère d’un salaire.
                </Text>

                <Text style={styles.articleTitle}>Article 8 - Durée du travail</Text>
                <Text style={styles.text}>
                    En ce qui concerne la durée du travail, tous les élèves sont soumis à la durée hebdomadaire légale ou conventionnelle si celle-ci est inférieure à la durée légale.
                </Text>

                <Text style={styles.articleTitle}>Article 9 - Durée et horaires de travail des élèves majeurs</Text>
                <Text style={styles.text}>
                    Dans l’hypothèse où l’élève majeur est soumis à une durée hebdomadaire modulée, la moyenne des durées de travail ne pourra excéder les limites indiquées ci-dessus. En ce qui concerne le travail de nuit, seul l’élève majeur nommément désigné par le chef d’établissement scolaire peut être incorporé à une équipe de nuit.
                </Text>

                <Text style={styles.articleTitle}>Article 10 - Durée et horaires de travail des élèves mineurs</Text>
                <Text style={styles.text}>
                    La durée de travail de l’élève mineur ne peut excéder 8 heures par jour et 35 heures par semaine. Le repos hebdomadaire de l’élève mineur doit être d’une durée minimale de deux jours consécutifs, comprenant le dimanche. La période minimale de repos quotidien est fixée à 14h (moins de 16 ans) ou 12h (16-18 ans). Au-delà de 4h30 de travail, l’élève mineur doit bénéficier d’une pause de 30 minutes. Le travail de nuit est interdit :
                </Text>
                <View style={{ marginLeft: 10 }}>
                    <Text style={styles.text}>- à l’élève mineur de 16 à 18 ans entre 22h et 6h ;</Text>
                    <Text style={styles.text}>- à l’élève de moins de 16 ans entre 20h et 6h.</Text>
                </View>

                <Text style={styles.articleTitle}>Article 11 - Avantages offerts par l’entreprise</Text>
                <Text style={styles.text}>
                    Conformément à l’article L.124-13 du code de l’éducation, le stagiaire a accès au restaurant d’entreprise ou aux titres-restaurant dans les mêmes conditions que les salariés. Il bénéficie également de la prise en charge des frais de transport.
                </Text>

                <Text style={styles.articleTitle}>Article 12 – Santé et sécurité au travail</Text>
                <Text style={styles.text}>
                    La stagiaire bénéficie des mêmes droits que les salariés dans le domaine de la santé et sécurité. L’entreprise veille à :
                </Text>
                <View style={{ marginLeft: 10 }}>
                    <Text style={styles.text}>- Procéder à l’évaluation des risques professionnels ;</Text>
                    <Text style={styles.text}>- Prendre toutes les mesures nécessaires pour assurer la sécurité ;</Text>
                    <Text style={styles.text}>- Fournir les équipements de protection individuelle nécessaires ;</Text>
                    <Text style={styles.text}>- Informer et former le stagiaire des risques.</Text>
                </View>

                <Text style={styles.text}>
                    Il est interdit de confier au stagiaire des tâches dangereuses pour sa santé et sa sécurité.
                </Text>

                <Text style={styles.articleTitle}>Article 13 - Sécurité – travaux interdits aux mineurs</Text>
                <Text style={styles.text}>
                    En application du code du travail, l’élève mineur de quinze ans au moins peut être affecté aux travaux réglementés après que l’employeur ait adressé à l’inspecteur du travail une déclaration de dérogation. L’élève ne doit utiliser ces machines ou produits qu’avec l’autorisation et sous le contrôle permanent du tuteur.
                </Text>


                <Text style={styles.articleTitle}>Article 14 - Sécurité électrique</Text>
                <Text style={styles.text}>
                    L’élève ayant à intervenir sur des installations électriques doit y être habilité par le responsable de l’entreprise d’accueil en fonction de la nature des travaux. Cette habilitation fait suite à une formation suivie par l’élève en établissement scolaire.
                </Text>

                <Text style={styles.articleTitle}>Article 15 - Couverture des accidents du travail</Text>
                <Text style={styles.text}>
                    L’élève bénéficie de la législation sur les accidents du travail (L. 412-8 du code de la sécurité sociale). L’obligation de déclaration d’accident incombe à l’entreprise d’accueil (lettre recommandée à la CPAM dans les 48h). L’entreprise fait parvenir une copie au chef d’établissement.
                </Text>

                <Text style={styles.articleTitle}>Article 16 - Autorisation d’absence</Text>
                <Text style={styles.text}>
                    En cas de grossesse, de paternité ou d’adoption, le stagiaire bénéficie de congés et d’autorisations d’absence. Pour les stages d'une durée supérieure à 2 mois, la convention doit prévoir la possibilité de congés.
                </Text>

                <Text style={styles.articleTitle}>Article 17 - Assurance responsabilité civile</Text>
                <Text style={styles.text}>
                    Le chef de l’entreprise d’accueil prend les dispositions nécessaires pour garantir sa responsabilité civile. Le chef d’établissement contracte une assurance couvrant la responsabilité civile de l’élève pour les dommages qu’il pourrait causer.
                </Text>

                <Text style={styles.articleTitle}>Article 18 - Encadrement et suivi</Text>
                <Text style={styles.text}>
                    Les conditions d’encadrement figurent dans l’annexe pédagogique. L’encadrement comporte à minima : une prise de contact, un suivi régulier avec élève et tuteur, et l’évaluation du stage.
                </Text>

                <Text style={styles.articleTitle}>Article 19 - Suspension et résiliation</Text>
                <Text style={styles.text}>
                    Le chef d’établissement et le représentant de l’entreprise se tiendront mutuellement informés des difficultés. Ils prendront d’un commun accord les dispositions propres à résoudre les problèmes d’absentéisme ou de discipline. Au besoin, ils étudieront la résiliation de la convention.
                </Text>

                <Text style={styles.articleTitle}>Article 20 - Validation en cas d’interruption</Text>
                <Text style={styles.text}>
                    Lorsque le stagiaire interrompt sa période de formation pour motif lié à la maladie, accident, etc., l’établissement propose une modalité alternative de validation de sa formation. Un report de la fin de la période est possible.
                </Text>

                <Text style={styles.articleTitle}>Article 21 – Attestation de stage</Text>
                <Text style={styles.text}>
                    À l’issue de la période, le responsable de l’entreprise délivre une attestation type (annexe) qui doit être complétée et signée le dernier jour du stage.
                </Text>


                {/* SIGNATURES */}
                <View wrap={false}>
                    <Text style={{ marginTop: 20, fontWeight: 'bold', fontSize: 11, borderTopWidth: 1, paddingTop: 10 }}>Signatures et cachets</Text>
                    <View style={styles.signatureRow}>
                        <View style={[
                            styles.signatureBox, 
                            data.signatures?.head?.hash ? localStyles.signatureBoxValid : {},
                            (data.status === 'REJECTED' && (data as any).metadata?.rejectedByRole === 'school_head') ? localStyles.rejectionBox : {}
                        ]}>
                            <Text style={styles.signatureLabel}>Le chef d’établissement</Text>
                            {data.status === 'REJECTED' && (data as any).metadata?.rejectedByRole === 'school_head' ? (
                                <Text style={localStyles.rejectionText}>REFUSÉE</Text>
                            ) : (
                                <SignatureContent
                                    img={data.signatures?.head?.img}
                                    hash={data.signatures?.head?.hash}
                                    date={data.signatures?.head?.signedAt}
                                    code={data.signatures?.head?.code}
                                    signatureId={data.signatures?.head?.signatureId}
                                />
                            )}
                        </View>
                        <View style={[
                            styles.signatureBox, 
                            (data.signatures?.company_head?.hash || (data.signatures?.tutor?.hash && data.ent_rep_email === data.tuteur_email)) ? localStyles.signatureBoxValid : {},
                            (data.status === 'REJECTED' && (
                                (data as any).metadata?.rejectedByRole === 'company_head' || 
                                (data as any).metadata?.rejectedByRole === 'company_head_tutor'
                            )) ? localStyles.rejectionBox : {}
                        ]}>
                            <Text style={styles.signatureLabel}>Le représentant de l’entreprise</Text>
                            {data.status === 'REJECTED' && (
                                (data as any).metadata?.rejectedByRole === 'company_head' || 
                                (data as any).metadata?.rejectedByRole === 'company_head_tutor'
                            ) ? (
                                <Text style={localStyles.rejectionText}>REFUSÉE</Text>
                            ) : (
                                <SignatureContent
                                    img={data.signatures?.company_head?.img || (data.ent_rep_email === data.tuteur_email ? data.signatures?.tutor?.img : undefined)}
                                    hash={data.signatures?.company_head?.hash || (data.ent_rep_email === data.tuteur_email ? data.signatures?.tutor?.hash : undefined)}
                                    date={data.signatures?.company_head?.signedAt || (data.ent_rep_email === data.tuteur_email ? data.signatures?.tutor?.signedAt : undefined)}
                                    code={data.signatures?.company_head?.code || (data.ent_rep_email === data.tuteur_email ? data.signatures?.tutor?.code : undefined)}
                                    signatureId={data.signatures?.company_head?.signatureId || (data.ent_rep_email === data.tuteur_email ? data.signatures?.tutor?.signatureId : undefined)}
                                />
                            )}
                        </View>
                        <View style={[styles.signatureBox, data.signatures?.student?.hash ? localStyles.signatureBoxValid : {}]}>
                            <Text style={styles.signatureLabel}>L’élève</Text>
                            <SignatureContent
                                img={data.signatures?.student?.img}
                                hash={data.signatures?.student?.hash}
                                date={data.signatures?.student?.signedAt}
                                code={data.signatures?.student?.code}
                                signatureId={data.signatures?.student?.signatureId}
                            />
                        </View>
                        {/* Legal Rep Box - Always Visible */}
                        <View style={[
                            styles.signatureBox, 
                            (data.signatures?.parent?.hash || (data.est_mineur === false && data.signatures?.student?.hash)) ? localStyles.signatureBoxValid : {},
                            (data.status === 'REJECTED' && (
                                (data as any).metadata?.rejectedByRole === 'parent' || 
                                (data as any).metadata?.rejectedByRole === 'rep_legal'
                            )) ? localStyles.rejectionBox : {}
                        ]}>
                            <Text style={styles.signatureLabel}>Le rep. légal {data.est_mineur ? '' : '(l\'élève majeur)'}</Text>
                            {data.status === 'REJECTED' && (
                                (data as any).metadata?.rejectedByRole === 'parent' || 
                                (data as any).metadata?.rejectedByRole === 'rep_legal'
                            ) ? (
                                <Text style={localStyles.rejectionText}>REFUSÉE</Text>
                            ) : (
                                <>
                                    {/* If Minor: Show Parent Signature */}
                                    {data.est_mineur && (
                                        <SignatureContent
                                            img={data.signatures?.parent?.img}
                                            hash={data.signatures?.parent?.hash}
                                            date={data.signatures?.parent?.signedAt}
                                            code={data.signatures?.parent?.code}
                                            signatureId={data.signatures?.parent?.signatureId}
                                        />
                                    )}
                                    {/* If Major: Show Student Signature (Self-Representation) */}
                                    {!data.est_mineur && (
                                        <SignatureContent
                                            img={data.signatures?.student?.img}
                                            hash={data.signatures?.student?.hash}
                                            date={data.signatures?.student?.signedAt}
                                            code={data.signatures?.student?.code}
                                            signatureId={data.signatures?.student?.signatureId}
                                        />
                                    )}
                                </>
                            )}
                        </View>
                        <View style={[
                            styles.signatureBox, 
                            (data.signatures?.tutor?.hash || (data.signatures?.company_head?.hash && data.ent_rep_email === data.tuteur_email)) ? localStyles.signatureBoxValid : {},
                            (data.status === 'REJECTED' && (
                                (data as any).metadata?.rejectedByRole === 'tutor' || 
                                (data as any).metadata?.rejectedByRole === 'company_head_tutor'
                            )) ? localStyles.rejectionBox : {}
                        ]}>
                            <Text style={styles.signatureLabel}>Le tuteur</Text>
                            {data.status === 'REJECTED' && (
                                (data as any).metadata?.rejectedByRole === 'tutor' || 
                                (data as any).metadata?.rejectedByRole === 'company_head_tutor'
                            ) ? (
                                <Text style={localStyles.rejectionText}>REFUSÉE</Text>
                            ) : (
                                <SignatureContent
                                    img={data.signatures?.tutor?.img || (data.ent_rep_email === data.tuteur_email ? data.signatures?.company_head?.img : undefined)}
                                    hash={data.signatures?.tutor?.hash || (data.ent_rep_email === data.tuteur_email ? data.signatures?.company_head?.hash : undefined)}
                                    date={data.signatures?.tutor?.signedAt || (data.ent_rep_email === data.tuteur_email ? data.signatures?.company_head?.signedAt : undefined)}
                                    code={data.signatures?.tutor?.code || (data.ent_rep_email === data.tuteur_email ? data.signatures?.company_head?.code : undefined)}
                                    signatureId={data.signatures?.tutor?.signatureId || (data.ent_rep_email === data.tuteur_email ? data.signatures?.company_head?.signatureId : undefined)}
                                />
                            )}
                        </View>
                        <View style={[
                            styles.signatureBox, 
                            data.signatures?.teacher?.hash ? localStyles.signatureBoxValid : {},
                            (data.status === 'REJECTED' && (data as any).metadata?.rejectedByRole === 'teacher') ? localStyles.rejectionBox : {}
                        ]}>
                            <Text style={styles.signatureLabel}>L’enseignant référent/Prof. Principal</Text>
                            {data.status === 'REJECTED' && (data as any).metadata?.rejectedByRole === 'teacher' ? (
                                <Text style={localStyles.rejectionText}>REFUSÉE</Text>
                            ) : (
                                <SignatureContent
                                    img={data.signatures?.teacher?.img}
                                    hash={data.signatures?.teacher?.hash}
                                    date={data.signatures?.teacher?.signedAt}
                                    code={data.signatures?.teacher?.code}
                                    signatureId={data.signatures?.teacher?.signatureId}
                                />
                            )}
                        </View>
                    </View>
                </View>

                {/* REJECTION MOTIF - BELOW SIGNATURES IF REJECTED */}
                {data.status === 'REJECTED' && (
                    <View style={localStyles.rejectionReasonBox}>
                        <Text style={localStyles.rejectionReasonTitle}>⚠️ MOTIF DU REFUS DE LA CONVENTION</Text>
                        <Text style={localStyles.rejectionReasonText}>
                            &ldquo; {data.rejection_reason || (data as any).metadata?.rejection_reason || "Aucun motif précisé"} &rdquo;
                        </Text>
                    </View>
                )}
                {data.status === 'VALIDATED_HEAD' && qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
            </Page>

            {/* --- ANNEXE 1: PEDAGOGIQUE --- */}
            {/* --- ANNEXE 1: PEDAGOGIQUE --- */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.annexTitle}>ANNEXE 1 : ANNEXE PÉDAGOGIQUE</Text>
                <View style={styles.row}><Text style={styles.label}>Élève :</Text><Text style={styles.value}>{data.eleve_nom} {data.eleve_prenom}</Text></View>
                <View style={styles.row}><Text style={styles.label}>Diplôme :</Text><Text style={styles.value}>{data.diplome_intitule}</Text></View>

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Activités et Compétences</Text>
                <View style={[styles.table, { height: 200 }]}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={[styles.tableCell, { width: '50%' }]}>Activités prévues</Text>
                        <Text style={[styles.tableCell, { width: '50%', borderRightWidth: 0 }]}>Compétences visées</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, { width: '50%', height: 180 }]}>{data.stage_activites || '...'}</Text>
                        <Text style={[styles.tableCell, { width: '50%', borderRightWidth: 0, height: 180 }]}>...</Text>
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Modalités de suivi</Text>
                <Text style={styles.text}>Suivi sur site / à distance par l'enseignant référent/professeur principal.</Text>
                {data.status === 'VALIDATED_HEAD' && qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
            </Page>

            {/* --- ANNEXE 2: FINANCIERE --- */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.annexTitle}>ANNEXE 2 : ANNEXE FINANCIÈRE</Text>

                <Text style={styles.text}>Pour aider l’établissement à mieux gérer ses frais, veuillez remplir ce document.</Text>

                <Text style={styles.sectionTitle}>Avantages offerts par l’entreprise</Text>

                {/* Logic: If any expense is true, company participates */}
                <View style={styles.row}>
                    <Text style={{ marginRight: 10 }}>L’entreprise participe-t-elle aux frais ?</Text>
                    <View style={styles.checkboxRow}>
                        <View style={[styles.checkbox, { backgroundColor: (data.frais_restauration || data.frais_transport || data.frais_hebergement) ? '#000' : 'transparent' }]} />
                        <Text>Oui</Text>
                    </View>
                    <View style={[styles.checkboxRow, { marginLeft: 10 }]}>
                        <View style={[styles.checkbox, { backgroundColor: !(data.frais_restauration || data.frais_transport || data.frais_hebergement) ? '#000' : 'transparent' }]} />
                        <Text>Non</Text>
                    </View>
                </View>

                <View style={{ marginLeft: 20, marginTop: 5 }}>
                    <View style={styles.checkboxRow}>
                        <View style={[styles.checkbox, { backgroundColor: data.frais_restauration ? '#000' : 'transparent' }]} />
                        <Text>Frais de restauration</Text>
                    </View>
                    <View style={styles.checkboxRow}>
                        <View style={[styles.checkbox, { backgroundColor: data.frais_transport ? '#000' : 'transparent' }]} />
                        <Text>Frais de transport</Text>
                    </View>
                    <View style={styles.checkboxRow}>
                        <View style={[styles.checkbox, { backgroundColor: data.frais_hebergement ? '#000' : 'transparent' }]} />
                        <Text>Frais d’hébergement</Text>
                    </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Gratification éventuelle</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Montant :</Text>
                    <Text style={styles.value}>{data.gratification_montant || '0'} € / mois</Text>
                </View>
            </Page>
            
            {/* --- ANNEXE 3: EVALUATION --- */}
            {data.evaluationAnswers && (
                <Page size="A4" style={styles.page}>
                    <Text style={styles.annexTitle}>ANNEXE 3 : ÉVALUATION PROFESSIONNELLE</Text>
                    
                    <View style={styles.row}>
                        <Text style={styles.label}>Date de l'évaluation :</Text>
                        <Text style={styles.value}>{data.evaluationDate ? new Date(data.evaluationDate).toLocaleDateString('fr-FR') : 'Non renseignée'}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Note / Appréciation globale :</Text>
                        <Text style={[styles.value, { fontFamily: pdfTheme.fonts.bold, color: pdfTheme.colors.primary }]}>
                            {data.evaluationFinalGrade || 'N/A'}
                        </Text>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 15 }]}>Synthèse de l'enseignant</Text>
                    <View style={[styles.table, { minHeight: 100, padding: 8 }]}>
                        <Text style={styles.text}>{ (data as any).synthesis || '...' }</Text>
                    </View>

                    <Text style={[styles.text, { fontSize: 8, color: '#666', marginTop: 20 }]}>
                        Ce document constitue une annexe officielle à la convention de stage et valide les compétences acquises par l'élève durant sa période de formation en milieu professionnel.
                    </Text>
                    
                    {data.status === 'VALIDATED_HEAD' && qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
                </Page>
            )}


            {/* --- QR CODE FOOTER (All Pages) --- */}

            {/* --- CERTIFICATE PAGE --- */}
            {data.status === 'VALIDATED_HEAD' && (
                <CertificatePage data={data} hashCode={hashCode} qrCodeUrl={qrCodeUrl} />
            )}
        </Document >
    );
}

// --- ERASMUS PLACEHOLDER ---
function ErasmusPlaceholderPdf({ data, qrCodeUrl, hashCode }: PdfProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={[styles.header, { fontSize: 24, color: '#1d4ed8', marginTop: 100 }]}>
                    ERASMUS+ MOBILITY
                </Text>
                <Text style={[styles.subHeader, { fontSize: 14 }]}>
                    CONVENTION DE STAGE ERASMUS+
                </Text>
                <View style={{ margin: 20, padding: 20, borderWidth: 2, borderColor: '#1d4ed8', borderStyle: 'dashed' }}>
                    <Text style={{ textAlign: 'center', fontSize: 12 }}>
                        Le modèle de convention Erasmus+ est en cours de développement.
                    </Text>
                    <Text style={{ textAlign: 'center', fontSize: 12, marginTop: 10 }}>
                        Veuillez vous référer au modèle standard pour l'instant ou contacter l'administrateur.
                    </Text>
                </View>
                <Text style={{ textAlign: 'center', marginTop: 20 }}>
                    Élève : {data.eleve_nom} {data.eleve_prenom}
                </Text>
                <Text style={{ textAlign: 'center' }}>
                    Destination : {data.ent_pays || 'Inconnue'}
                </Text>

                {/* --- QR CODE FOOTER --- */}
                {qrCodeUrl && (
                    <View fixed style={{ position: 'absolute', bottom: 10, right: 10, alignItems: 'flex-end', opacity: 0.8 }}>
                        <Image src={qrCodeUrl} style={{ width: 50, height: 50 }} />
                    </View>
                )}
            </Page>
        </Document>
    );
}

// --- STAGE DE SECONDE PDF TEMPLATE ---
function StageSecondePdf({ data, qrCodeUrl, hashCode }: PdfProps) {
    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '...';
    
    const SignatureContent = ({ img, hash, date, code, signatureId }: { img?: string, hash?: string, date?: string, code?: string, signatureId?: string }) => {
        if (!img) return null;
        return (
            <View>
                <Image src={img} style={{ width: 100, height: 35, objectFit: 'contain' }} />
                {hash && (
                    <View style={localStyles.validBadge}>
                        <Text>✅ SIGNÉ</Text>
                    </View>
                )}
                {date && <Text style={{ fontSize: 5, color: '#059669', marginTop: 1 }}>Le {new Date(date).toLocaleString('fr-FR')}</Text>}
                {(code || signatureId) && (
                    <View style={[localStyles.authCodeBox, { marginTop: 1, paddingVertical: 1 }]}>
                        <Text style={localStyles.authCodeText}>Certificat: {signatureId || code}</Text>
                    </View>
                )}
                {hash && <Text style={localStyles.hashText}>Hash: {hash.substring(0, 24)}...</Text>}
            </View>
        );
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={{ marginBottom: 15 }}>
                    <Text style={[styles.header, { fontSize: 11, textAlign: 'center' }]}>
                        CONVENTION RELATIVE À L'ORGANISATION DE LA SÉQUENCE D'OBSERVATION EN MILIEU PROFESSIONNEL
                    </Text>
                    <Text style={[styles.text, { fontSize: 7, textAlign: 'center', marginTop: 4 }]}>
                        Pour les élèves de collège (quatrième et troisième) et de lycée (seconde générale et technologique)
                    </Text>
                </View>

                <Text style={[styles.text, { fontSize: 6, color: '#666', marginBottom: 10, textAlign: 'justify' }]}>
                    Vu le code du travail, et notamment son article L. 4153-1 ; le code de l'éducation, et notamment ses articles L. 124-1, L. 134-9, L. 313-1, L. 331-4, L. 331-5, L. 332-3, L. 335-2, L. 411-3, L. 421-7, L. 911-4, D. 331-1 à D. 331-9, D. 333-3-1 ; le code civil, et notamment ses articles 1240 à 1242 ; la circulaire n°96-248 du 25-10-1996 relative à la surveillance des élèves ; la circulaire du 10-2-2021 relative au projet d’accueil individualisé pour raison de santé ; la circulaire du 16 juillet 2024 relative à l’organisation des sorties et voyages scolaires dans les écoles, les collèges et les lycées publics ; la circulaire du 21 novembre 2025 relative aux séquences d’observation, visite d’information et stages pour les élèves de collège et de lycée général et technologique ; la délibération du conseil d’administration en date du {(data as any).ecole_ca_date || '...'} de l’établissement ;
                </Text>

                <View style={{ marginBottom: 10 }}>
                    <Text style={[styles.text, { fontFamily: pdfTheme.fonts.bold }]}>Entre :</Text>
                    <Text style={styles.text}>
                        l'entreprise ou l'organisme d'accueil : <Text style={{ fontFamily: pdfTheme.fonts.bold }}>{data.ent_nom || '...'}</Text>, représenté par <Text style={{ fontFamily: pdfTheme.fonts.bold }}>{data.ent_rep_nom || '...'}</Text>, en qualité de responsable de l'organisme d'accueil d'une part, et
                    </Text>
                    <Text style={styles.text}>
                        l'établissement d'enseignement scolaire : <Text style={{ fontFamily: pdfTheme.fonts.bold }}>{data.ecole_nom || '...'}</Text>, représenté par <Text style={{ fontFamily: pdfTheme.fonts.bold }}>{data.ecole_chef_nom || '...'}</Text>, en qualité de chef ou cheffe d'établissement d'autre part,
                    </Text>
                </View>

                <View style={{ marginBottom: 10 }}>
                    <Text style={[styles.text, { fontFamily: pdfTheme.fonts.bold }]}>Concernant :</Text>
                    <Text style={[styles.text, { fontSize: 10, fontFamily: pdfTheme.fonts.bold, color: pdfTheme.colors.primary }]}>
                        {data.eleve_prenom} {data.eleve_nom}
                    </Text>
                </View>

                <Text style={[styles.text, { marginTop: 5, marginBottom: 5 }]}>Il a été convenu ce qui suit :</Text>

                <Text style={styles.sectionTitle}>Titre I : Dispositions générales</Text>
                
                <Text style={styles.articleTitle}>Article 1</Text>
                <Text style={styles.text}>La présente convention a pour objet la mise en œuvre d'une séquence d'observation en milieu professionnel, au bénéfice des élèves scolarisés en classe de quatrième ou de troisième au collège ou en classe de seconde générale et technologique au lycée.</Text>

                <Text style={styles.articleTitle}>Article 2</Text>
                <Text style={styles.text}>Les objectifs et les modalités de la séquence d'observation sont consignés dans l'annexe pédagogique. Les modalités de prise en charge des frais afférents à cette séquence ainsi que les modalités d'assurances sont définies dans l'annexe financière.</Text>

                <Text style={styles.articleTitle}>Article 3</Text>
                <Text style={styles.text}>L'organisation de la séquence d'observation est déterminée d'un commun accord entre le ou la responsable de l'organisme d'accueil et le ou la cheffe d'établissement.</Text>

                <Text style={styles.articleTitle}>Article 4</Text>
                <Text style={styles.text}>Les élèves demeurent sous statut scolaire durant la période d'observation en milieu professionnel. Ils restent placés sous l'autorité et la responsabilité du chef ou de la cheffe d'établissement. Ils ne peuvent prétendre à aucune rémunération ou gratification de l'entreprise ou de l'organisme d'accueil.</Text>

                <Text style={styles.articleTitle}>Article 5</Text>
                <Text style={styles.text}>
                    Durant la séquence d'observation, les élèves n'ont pas à concourir au travail dans l'entreprise ou l'organisme d'accueil.
                    Au cours des séquences d'observation, les élèves peuvent effectuer des enquêtes en liaison avec les enseignements. Ils peuvent également participer à des activités de l'entreprise ou de l'organisme d’accueil, à des essais ou à des démonstrations en liaison avec les enseignements et les objectifs de formation de leur classe, sous le contrôle des personnels responsables de leur encadrement en milieu professionnel.
                    Les élèves ne peuvent accéder aux machines, appareils ou produits dont l'usage est proscrit aux mineurs par les articles D. 4153-15 à D. 4153-37 du code du travail. Ils ne peuvent ni procéder à des manœuvres ou manipulations sur d'autres machines, produits ou appareils de production, ni effectuer des travaux légers autorisés aux mineurs par ce même code.
                    Si l’état de santé de l’élève nécessite d’avoir une trousse d’urgence dans le cadre d’un Projet d’Accueil Individualisé (PAI), les représentants légaux s’assurent que l’élève concerné emporte la trousse pendant la durée de la séquence d’observation.
                </Text>

                <Text style={styles.articleTitle}>Article 6</Text>
                <Text style={styles.text}>La souscription par l’élève majeur ou par les responsables légaux d’un élève mineur d’une assurance scolaire couvrant les dommages dont l’élève serait l’auteur (garantie responsabilité civile) ou qu’il pourrait subir (garantie dommages corporels) en milieu professionnel est vivement recommandée. En application des articles 1240 à 1242 du code civil, le chef ou la cheffe d’entreprise ou le ou la responsable de l’organisme d’accueil (hors services de l’Etat, qui est son propre assureur) prend les dispositions nécessaires pour garantir sa responsabilité civile chaque fois qu’elle peut être engagée.</Text>

                <Text style={styles.articleTitle}>Article 7</Text>
                <Text style={styles.text}>En cas d'accident survenant à l'élève, soit en milieu professionnel, soit au cours du trajet, le ou la responsable de l'organisme d’accueil alerte sans délai le chef ou la cheffe d’établissement d’enseignement de l’élève par tout moyen mis à sa disposition et lui adresse la déclaration d'accident dûment renseignée dans la même journée.</Text>

                {qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
            </Page>

            <Page size="A4" style={styles.page}>
                <Text style={styles.articleTitle}>Article 8</Text>
                <Text style={styles.text}>
                    Dans le cadre de l’obligation générale de l’employeur d’assurer la sécurité et de protéger la santé physique et mentale des travailleurs et des travailleuses, et conformément aux articles L. 1142-2-1, L.1153-1 et suivants du code du travail, et à la loi n°2018-703 du 3 août 2018 renforçant la lutte contre les violences sexistes et sexuelles, l’organisme d’accueil s’engage à préserver l’élève de toute forme d’agissement sexiste, de harcèlement ou de violence sexuelle. Il prend toutes les dispositions nécessaires en vue de prévenir les faits de harcèlement et toute forme de violence verbale ou physique à caractère discriminatoire.
                    L’organisme d’accueil s’engage à fournir à l’élève, dès son arrivée, une information claire sur les politiques internes en matière de lutte contre les violences sexistes et sexuelles, ainsi que sur les procédures de signalement et de recours disponibles.
                    Dans le cadre de la prévention des risques professionnels, l’organisme d’accueil veille à procéder à l’évaluation des risques professionnels auxquels l’élève est susceptible d’être exposé et à prendre toutes les mesures nécessaires pour assurer la sécurité et protéger l’élève. Il fournit à l’élève les équipements de protection individuelle nécessaires, veille au port effectif de ces équipements après l’avoir formé à leur utilisation. Il informe et forme l’élève aux risques liés au poste de travail et aux moyens pour les prévenir.
                    En cas de non-respect des règles d’hygiène et de sécurité prévues par son règlement intérieur, l’organisme d’accueil peut suspendre et mettre fin au stage en concertation avec l’établissement d’enseignement. En cas de difficultés, l’élève peut s’adresser à plusieurs personnes ressources dans et hors de l’organisme d’accueil : personnel de l’établissement, tuteur de l’organisme d’accueil ou personne référente désignée par l’organisme d’accueil.
                </Text>

                <Text style={styles.articleTitle}>Article 9</Text>
                <Text style={styles.text}>Le ou la cheffe d'établissement d'enseignement et le ou la responsable de l'organisme d'accueil de l'élève se tiendront mutuellement informés des difficultés qui pourraient naître de l'application de la présente convention et prendront, d'un commun accord et en liaison avec l'équipe pédagogique, les dispositions propres à les résoudre notamment en cas de manquement à la discipline. Les difficultés qui pourraient être rencontrées lors de toute période en milieu professionnel, et notamment toute absence d'un élève, seront aussitôt portées à la connaissance du chef ou de la cheffe d'établissement.</Text>

                <Text style={styles.articleTitle}>Article 10</Text>
                <Text style={styles.text}>
                    La présente convention est signée pour la durée de la séquence d'observation en milieu professionnel, qui est fixée à :
                    • cinq jours (consécutifs ou non) pour les élèves scolarisés au collège ;
                    • une semaine (si deux organismes d’accueil différents) ou deux semaines consécutives durant la seconde quinzaine du mois de juin, pour les élèves scolarisés en seconde générale ou technologique.
                </Text>

                <View style={{ marginTop: 15 }}>
                    <Text style={styles.sectionTitle}>Titre II : Dispositions particulières</Text>
                    <Text style={[styles.articleTitle, { color: '#1d4ed8' }]}>Annexe pédagogique</Text>
                    
                    <View style={localStyles.table}>
                        <View style={localStyles.tableRow}>
                            <Text style={[localStyles.tableCell, { width: '40%', fontWeight: 'bold' }]}>Élève :</Text>
                            <Text style={[localStyles.tableCell, { width: '60%' }]}>{data.eleve_prenom} {data.eleve_nom}</Text>
                        </View>
                        <View style={localStyles.tableRow}>
                            <Text style={[localStyles.tableCell, { width: '40%', fontWeight: 'bold' }]}>Date de naissance :</Text>
                            <Text style={[localStyles.tableCell, { width: '60%' }]}>{formatDate(data.eleve_date_naissance)}</Text>
                        </View>
                        <View style={localStyles.tableRow}>
                            <Text style={[localStyles.tableCell, { width: '40%', fontWeight: 'bold' }]}>Classe :</Text>
                            <Text style={[localStyles.tableCell, { width: '60%' }]}>{data.eleve_classe}</Text>
                        </View>
                        <View style={localStyles.tableRow}>
                            <Text style={[localStyles.tableCell, { width: '40%', fontWeight: 'bold' }]}>PAI (raison de santé) :</Text>
                            <Text style={[localStyles.tableCell, { width: '60%' }]}>{(data as any).pai_exist ? 'Oui' : 'Non'}</Text>
                        </View>
                        <View style={localStyles.tableRow}>
                            <Text style={[localStyles.tableCell, { width: '40%', fontWeight: 'bold' }]}>Tuteur d'accueil :</Text>
                            <Text style={[localStyles.tableCell, { width: '60%' }]}>{data.tuteur_nom} ({data.tuteur_fonction || 'Tuteur'})</Text>
                        </View>
                        <View style={localStyles.tableRow}>
                            <Text style={[localStyles.tableCell, { width: '40%', fontWeight: 'bold' }]}>Dates de la séquence :</Text>
                            <Text style={[localStyles.tableCell, { width: '60%' }]}>Du {formatDate(data.stage_date_debut)} au {formatDate(data.stage_date_fin)} inclusivement</Text>
                        </View>
                    </View>
                </View>

                {/* HORAIRES SUMMARY */}
                <View style={{ marginTop: 10 }}>
                    <Text style={[styles.text, { fontFamily: pdfTheme.fonts.bold, marginBottom: 5 }]}>Horaires journaliers de l'élève :</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <Text style={[styles.tableCell, { width: '20%' }]}>Jour</Text>
                            <Text style={[styles.tableCell, { width: '40%' }]}>Matin</Text>
                            <Text style={[styles.tableCell, { width: '40%', borderRightWidth: 0 }]}>Après-midi</Text>
                        </View>
                        {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((day) => {
                            const slots = (data as any).stage_horaires?.[day];
                            if (!slots) return null;
                            return (
                                <View key={day} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { width: '20%' }]}>{day}</Text>
                                    <Text style={[styles.tableCell, { width: '40%' }]}>
                                        {slots.matin_debut && slots.matin_fin ? `${slots.matin_debut} - ${slots.matin_fin}` : '-'}
                                    </Text>
                                    <Text style={[styles.tableCell, { width: '40%', borderRightWidth: 0 }]}>
                                        {slots.apres_midi_debut && slots.apres_midi_fin ? `${slots.apres_midi_debut} - ${slots.apres_midi_fin}` : '-'}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
            </Page>

            <Page size="A4" style={styles.page}>
                <Text style={styles.articleTitle}>Objectifs assignés</Text>
                <Text style={styles.text}>La séquence d'observation en milieu professionnel a pour objectif de sensibiliser l’élève à l'environnement technologique, économique et professionnel, en liaison avec les programmes d'enseignement, notamment dans le cadre de son éducation à l'orientation.</Text>
                
                <Text style={styles.articleTitle}>Activités prévues</Text>
                <View style={{ padding: 8, borderWidth: 1, borderColor: '#eee', minHeight: 60 }}>
                    <Text style={styles.text}>{data.stage_activites || 'Observations des différents services de l\'organisme d\'accueil...'}</Text>
                </View>

                <Text style={styles.articleTitle}>Modalités d'évaluation</Text>
                <Text style={styles.text}>La séquence d'observation est précédée d'un temps de préparation et suivie d'un temps d'exploitation ou de restitution qui permet d’en valoriser les acquis. Cette restitution peut prendre la forme d’un rapport de stage, ou, au lycée, d’un échange collectif en classe de première.</Text>

                <View style={{ marginTop: 15 }}>
                    <Text style={[styles.articleTitle, { color: '#1d4ed8' }]}>Annexe financière</Text>
                    <Text style={[styles.articleTitle, { fontSize: 9 }]}>Hébergement</Text>
                    <Text style={styles.text}>L’hébergement de l’élève en milieu professionnel n’entre pas dans le cadre de la présente convention.</Text>
                    
                    <Text style={[styles.articleTitle, { fontSize: 9 }]}>Restauration</Text>
                    <Text style={styles.text}>L’élève peut accéder à l’espace restauration de l’organisme d’accueil dans les conditions fixées par le règlement intérieur. La participation financière demeure à la charge du représentant légal, sauf décision contraire de l'organisme d'accueil.</Text>
                    
                    <Text style={[styles.articleTitle, { fontSize: 9 }]}>Transport</Text>
                    <Text style={styles.text}>Dès lors que l'activité implique un déplacement en début ou fin de temps scolaire, il est assimilé au trajet habituel. L’élève peut s’y rendre ou en revenir seul.</Text>
                </View>

                {/* SIGNATURES BLOCK */}
                <View wrap={false} style={{ marginTop: 30 }}>
                    <Text style={{ fontFamily: pdfTheme.fonts.bold, fontSize: 10, borderBottomWidth: 1, paddingBottom: 5, marginBottom: 10 }}>Signatures de la convention</Text>
                    <View style={localStyles.signatureRow}>
                        <View style={[localStyles.signatureBox, data.signatures?.head?.hash ? localStyles.signatureBoxValid : {}]}>
                            <Text style={localStyles.signatureLabel}>Le/la chef d'établissement</Text>
                            <SignatureContent {...data.signatures?.head} />
                        </View>
                        <View style={[localStyles.signatureBox, data.signatures?.company_head?.hash ? localStyles.signatureBoxValid : {}]}>
                            <Text style={localStyles.signatureLabel}>Le/la responsable d'accueil</Text>
                            <SignatureContent {...data.signatures?.company_head} />
                        </View>
                        <View style={[localStyles.signatureBox, data.signatures?.student?.hash ? localStyles.signatureBoxValid : {}]}>
                            <Text style={localStyles.signatureLabel}>L’élève</Text>
                            <SignatureContent {...data.signatures?.student} />
                        </View>
                        <View style={[localStyles.signatureBox, data.signatures?.parent?.hash ? localStyles.signatureBoxValid : {}]}>
                            <Text style={localStyles.signatureLabel}>Le/les responsable(s) légaux</Text>
                            <SignatureContent {...data.signatures?.parent} />
                        </View>
                    </View>
                </View>

                {qrCodeUrl && <QrCodeFooter url={qrCodeUrl} code={hashCode} />}
            </Page>
            
            {/* Certificat d'Authenticité */}
            {data.status === 'VALIDATED_HEAD' && (
                <CertificatePage data={data} hashCode={hashCode} qrCodeUrl={qrCodeUrl} />
            )}
        </Document>
    );
}

// --- MAIN FACTORY COMPONENT ---
export function ConventionPdf(props: PdfProps) {
    const { data } = props;

    // Factory Logic
    if (data.type === 'STAGE_SECONDE') {
        return <StageSecondePdf {...props} />;
    }

    if (data.type === 'ERASMUS_MOBILITY') {
        return <ErasmusPlaceholderPdf {...props} />;
    }

    // Default to Standard (PFMP_STANDARD or other)
    return <StandardConventionPdf {...props} />;
}
