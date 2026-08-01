import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatMoney } from '@/lib/jobs/totals';

export type InvoicePdfLine = {
  description: string;
  qty: number;
  unit_price: number;
  taxable?: boolean;
};

export type InvoicePdfProps = {
  companyName: string;
  companyLegalName?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyAddress?: string | null;
  licenseNumber?: string | null;
  brandColor?: string | null;
  invoiceFooter?: string | null;
  jobNumber?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  invoiceStatus?: string | null;
  paymentStatus?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  lines: InvoicePdfLine[];
  issuedAt?: string | null;
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
    marginBottom: 24,
  },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  muted: { color: '#666666', fontSize: 9, marginBottom: 2 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  section: { marginBottom: 16 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingBottom: 6,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
  },
  colDesc: { flex: 3 },
  colQty: { flex: 0.7, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colAmt: { flex: 1.1, textAlign: 'right' },
  totals: { marginTop: 12, alignItems: 'flex-end' },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    marginBottom: 3,
    width: 200,
  },
  totalLabel: { width: 90, textAlign: 'right', color: '#555555' },
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

export function InvoiceDocument(props: InvoicePdfProps) {
  const accent = props.brandColor?.trim() || '#0f766e';
  const issued =
    props.issuedAt && !Number.isNaN(new Date(props.issuedAt).getTime())
      ? new Date(props.issuedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

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
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.muted}>
              {props.jobNumber ? `#${props.jobNumber}` : 'Job invoice'}
            </Text>
            <Text style={styles.muted}>Date {issued}</Text>
            <Text style={styles.muted}>
              {props.paymentStatus === 'Paid' ? 'PAID' : 'Amount due'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
            Bill to
          </Text>
          <Text>{props.customerName || 'Customer'}</Text>
          {props.customerAddress ? (
            <Text style={styles.muted}>{props.customerAddress}</Text>
          ) : null}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Price</Text>
          <Text style={styles.colAmt}>Amount</Text>
        </View>
        {(props.lines.length ? props.lines : [
          {
            description: 'Services',
            qty: 1,
            unit_price: props.total,
          },
        ]).map((line, i) => {
          const amt = (Number(line.qty) || 0) * (Number(line.unit_price) || 0);
          return (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.colDesc}>{line.description || 'Item'}</Text>
              <Text style={styles.colQty}>
                {(Number(line.qty) || 0).toFixed(2)}
              </Text>
              <Text style={styles.colPrice}>
                {formatMoney(Number(line.unit_price) || 0)}
              </Text>
              <Text style={styles.colAmt}>{formatMoney(amt)}</Text>
            </View>
          );
        })}

        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatMoney(props.subtotal)}
            </Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>
              {formatMoney(props.taxAmount)}
            </Text>
          </View>
          <View style={[styles.totalLine, styles.grand]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(props.total)}</Text>
          </View>
        </View>

        {props.invoiceFooter ? (
          <Text style={styles.footer}>{props.invoiceFooter}</Text>
        ) : (
          <Text style={styles.footer}>
            Thank you for your business — {props.companyName}
          </Text>
        )}
      </Page>
    </Document>
  );
}
