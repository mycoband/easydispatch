import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatMoney } from '@/lib/jobs/totals';

export type WalkthroughPdfPart = {
  name: string;
  quantity: number;
  estimated_cost: number;
};

export type WalkthroughPdfProps = {
  companyName: string;
  companyLegalName?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyAddress?: string | null;
  licenseNumber?: string | null;
  brandColor?: string | null;
  jobNumber?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  jobType?: string | null;
  findings?: string | null;
  workPerformed?: string | null;
  recommendations?: string | null;
  customerSummary?: string | null;
  parts: WalkthroughPdfPart[];
  laborHours?: number | null;
  laborRate?: number | null;
  partsTotal?: number | null;
  laborTotal?: number | null;
  grandTotal?: number | null;
  generatedAt?: string | null;
  savedAt?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  muted: { color: '#666666', fontSize: 9, marginBottom: 2 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#444444',
    marginBottom: 4,
  },
  body: { fontSize: 10, lineHeight: 1.4, color: '#222222' },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingBottom: 5,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
  },
  colDesc: { flex: 3 },
  colQty: { flex: 0.7, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colAmt: { flex: 1.1, textAlign: 'right' },
  totals: { marginTop: 10, alignItems: 'flex-end' },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    marginBottom: 3,
    width: 220,
  },
  totalLabel: { width: 100, textAlign: 'right', color: '#555555' },
  totalValue: { width: 80, textAlign: 'right' },
  grand: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
  },
});

function fmtDate(iso?: string | null) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Section({
  title,
  text,
}: {
  title: string;
  text?: string | null;
}) {
  const body = text?.trim();
  if (!body) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

export function WalkthroughDocument(props: WalkthroughPdfProps) {
  const accent = props.brandColor?.trim() || '#0f766e';
  const saved = fmtDate(props.savedAt);
  const generated = fmtDate(props.generatedAt);
  const laborTotal =
    props.laborTotal ??
    (Number(props.laborHours) || 0) * (Number(props.laborRate) || 0);
  const partsTotal =
    props.partsTotal ??
    props.parts.reduce(
      (s, p) => s + (Number(p.quantity) || 0) * (Number(p.estimated_cost) || 0),
      0
    );
  const grand =
    props.grandTotal ?? partsTotal + laborTotal;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.brand, { color: accent }]}>
              {props.companyName}
            </Text>
            {props.companyLegalName ? (
              <Text style={styles.muted}>{props.companyLegalName}</Text>
            ) : null}
            {props.companyAddress ? (
              <Text style={styles.muted}>{props.companyAddress}</Text>
            ) : null}
            {props.companyPhone ? (
              <Text style={styles.muted}>{props.companyPhone}</Text>
            ) : null}
            {props.companyEmail ? (
              <Text style={styles.muted}>{props.companyEmail}</Text>
            ) : null}
            {props.licenseNumber ? (
              <Text style={styles.muted}>License {props.licenseNumber}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.title}>Job Walkthrough</Text>
            <Text style={styles.muted}>
              Job {props.jobNumber || '—'}
              {props.jobType ? ` · ${props.jobType}` : ''}
            </Text>
            {saved ? <Text style={styles.muted}>Saved {saved}</Text> : null}
            {generated ? (
              <Text style={styles.muted}>Generated {generated}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Text style={styles.body}>{props.customerName || '—'}</Text>
          {props.customerAddress ? (
            <Text style={styles.muted}>{props.customerAddress}</Text>
          ) : null}
        </View>

        <Section title="Customer summary" text={props.customerSummary} />
        <Section title="Findings" text={props.findings} />
        <Section title="Work performed" text={props.workPerformed} />
        <Section title="Recommendations" text={props.recommendations} />

        {(props.parts.length > 0 ||
          props.laborHours != null ||
          props.laborRate != null) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parts & labor</Text>
            {props.parts.length > 0 ? (
              <>
                <View style={styles.tableHeader}>
                  <Text style={styles.colDesc}>Item</Text>
                  <Text style={styles.colQty}>Qty</Text>
                  <Text style={styles.colPrice}>Each</Text>
                  <Text style={styles.colAmt}>Amount</Text>
                </View>
                {props.parts.map((p, i) => {
                  const amt =
                    (Number(p.quantity) || 0) * (Number(p.estimated_cost) || 0);
                  return (
                    <View key={i} style={styles.row}>
                      <Text style={styles.colDesc}>{p.name}</Text>
                      <Text style={styles.colQty}>{p.quantity}</Text>
                      <Text style={styles.colPrice}>
                        {formatMoney(p.estimated_cost)}
                      </Text>
                      <Text style={styles.colAmt}>{formatMoney(amt)}</Text>
                    </View>
                  );
                })}
              </>
            ) : null}
            {(props.laborHours != null || props.laborRate != null) && (
              <Text style={[styles.muted, { marginTop: 6 }]}>
                Labor:{' '}
                {props.laborHours != null ? `${props.laborHours}h` : '—'}
                {props.laborRate != null
                  ? ` @ ${formatMoney(props.laborRate)}/hr`
                  : ''}
              </Text>
            )}
            <View style={styles.totals}>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Parts</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(partsTotal)}
                </Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Labor</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(laborTotal)}
                </Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={[styles.totalLabel, styles.grand]}>Total est.</Text>
                <Text style={[styles.totalValue, styles.grand]}>
                  {formatMoney(grand)}
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          Generated by EasyDispatch · Job Walkthrough report
        </Text>
      </Page>
    </Document>
  );
}
