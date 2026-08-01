import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export type DaySheetStop = {
  time: string;
  customer: string;
  jobNumber: string;
  jobType: string;
  hours: string;
  notes: string;
  flags: string;
  status: string;
};

export type DaySheetTechBlock = {
  techName: string;
  stops: DaySheetStop[];
};

export type DaySheetPdfProps = {
  companyName: string;
  dateLabel: string;
  techBlocks: DaySheetTechBlock[];
  title?: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: { marginBottom: 16 },
  brand: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle: { fontSize: 11, color: '#444444' },
  tech: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
  },
  time: { width: 55, fontFamily: 'Helvetica-Bold' },
  body: { flex: 1 },
  meta: { color: '#666666', fontSize: 8, marginTop: 1 },
  empty: { color: '#999999', marginTop: 4, marginBottom: 8 },
});

export function DaySheetDocument(props: DaySheetPdfProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{props.companyName}</Text>
          <Text style={styles.subtitle}>
            {props.title || 'Day sheet'} — {props.dateLabel}
          </Text>
        </View>

        {props.techBlocks.length === 0 ? (
          <Text style={styles.empty}>No scheduled stops.</Text>
        ) : (
          props.techBlocks.map((block) => (
            <View key={block.techName} wrap={false}>
              <Text style={styles.tech}>
                {block.techName} ({block.stops.length})
              </Text>
              {block.stops.length === 0 ? (
                <Text style={styles.empty}>No stops</Text>
              ) : (
                block.stops.map((stop, i) => (
                  <View key={`${block.techName}-${i}`} style={styles.row}>
                    <Text style={styles.time}>{stop.time || '—'}</Text>
                    <View style={styles.body}>
                      <Text>
                        {stop.customer}
                        {stop.jobNumber ? ` · ${stop.jobNumber}` : ''}
                        {stop.flags ? ` · ${stop.flags}` : ''}
                      </Text>
                      <Text style={styles.meta}>
                        {[stop.jobType, stop.hours, stop.status]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      {stop.notes ? (
                        <Text style={styles.meta}>{stop.notes}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
