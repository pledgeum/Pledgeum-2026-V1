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
            <Text style={{ fontSize: 5, color: '#999', marginTop: 1, fontFamily: 'Courier' }}>
                Code d'authentification de la signature numérique : {code}
            </Text>
        )}
    </View>
);

// --- STANDARD PDF TEMPLATE (Existing CERFA-like) ---
function StandardConventionPdf({ data, qrCodeUrl, hashCode }: PdfProps) {
    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '...';

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
                        <Text style={styles.value}>{data.ecole_chef_nom}</Text>
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
                        <View style={styles.signatureBox}>
                            <Text style={styles.signatureLabel}>Le chef d’établissement</Text>
                            {data.signatures?.headImg && <Image src={data.signatures.headImg} style={{ width: 100, height: 40 }} />}
                            {data.signatures?.headCode && (
                                <View style={localStyles.authCodeBox}>
                                    <Text style={localStyles.authCodeText}>Code d'authentification de la signature numérique : {data.signatures.headCode}</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.signatureBox}>
                            <Text style={styles.signatureLabel}>Le représentant de l’entreprise</Text>
                            {data.signatures?.companyImg && <Image src={data.signatures.companyImg} style={{ width: 100, height: 40 }} />}
                            {data.signatures?.companyCode && (
                                <View style={localStyles.authCodeBox}>
                                    <Text style={localStyles.authCodeText}>Code d'authentification de la signature numérique : {data.signatures.companyCode}</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.signatureBox}>
                            <Text style={styles.signatureLabel}>L’élève</Text>
                            {data.signatures?.studentImg && <Image src={data.signatures.studentImg} style={{ width: 100, height: 40 }} />}
                            {data.signatures?.studentCode && (
                                <View style={localStyles.authCodeBox}>
                                    <Text style={localStyles.authCodeText}>Code d'authentification de la signature numérique : {data.signatures.studentCode}</Text>
                                </View>
                            )}
                        </View>
                        {/* Legal Rep Box - Always Visible */}
                        <View style={styles.signatureBox}>
                            <Text style={styles.signatureLabel}>Le rep. légal {data.est_mineur ? '' : '(l\'élève majeur)'}</Text>

                            {/* If Minor: Show Parent Signature */}
                            {data.est_mineur && (
                                <>
                                    {data.signatures?.parentImg && <Image src={data.signatures.parentImg} style={{ width: 100, height: 40 }} />}
                                    {data.signatures?.parentCode && (
                                        <View style={localStyles.authCodeBox}>
                                            <Text style={localStyles.authCodeText}>Code d'authentification de la signature numérique : {data.signatures.parentCode}</Text>
                                        </View>
                                    )}
                                </>
                            )}

                            {/* If Major: Show Student Signature (Self-Representation) */}
                            {!data.est_mineur && (
                                <>
                                    {data.signatures?.studentImg && <Image src={data.signatures.studentImg} style={{ width: 100, height: 40 }} />}
                                    {data.signatures?.studentCode && (
                                        <View style={localStyles.authCodeBox}>
                                            <Text style={localStyles.authCodeText}>Code d'authentification de la signature numérique : {data.signatures.studentCode}</Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                        <View style={styles.signatureBox}>
                            <Text style={styles.signatureLabel}>Le tuteur</Text>
                            {data.signatures?.tutorImg && <Image src={data.signatures.tutorImg} style={{ width: 100, height: 40 }} />}
                            {data.signatures?.tutorCode && (
                                <View style={localStyles.authCodeBox}>
                                    <Text style={localStyles.authCodeText}>Code d'authentification de la signature numérique : {data.signatures.tutorCode}</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.signatureBox}>
                            <Text style={styles.signatureLabel}>L’enseignant référent/Prof. Principal</Text>
                            {data.signatures?.teacherImg && <Image src={data.signatures.teacherImg} style={{ width: 100, height: 40 }} />}
                            {data.signatures?.teacherCode && (
                                <View style={localStyles.authCodeBox}>
                                    <Text style={localStyles.authCodeText}>Code d'authentification de la signature numérique : {data.signatures.teacherCode}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
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

// --- MAIN FACTORY COMPONENT ---
export function ConventionPdf(props: PdfProps) {
    const { data } = props;

    // Factory Logic
    if (data.type === 'ERASMUS_MOBILITY') {
        return <ErasmusPlaceholderPdf {...props} />;
    }

    // Default to Standard (PFMP_STANDARD or STAGE_2NDE)
    return <StandardConventionPdf {...props} />;
}
