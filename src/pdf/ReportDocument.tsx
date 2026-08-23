/**
 * Phase 8: PDF export. Same principle as ReportView.tsx (Phase 7) - one
 * `Report` shape (src/types/report.ts), two renderers. This one runs
 * server-side only (react-pdf's components aren't DOM components), so unlike
 * ReportView it imports the real `Report` type directly instead of
 * redeclaring a loose local shape - there's no HTTP/JSON boundary to lose
 * type safety across here.
 *
 * Deliberately NOT collapsible like the web view - a PDF is a static,
 * printable artifact, so every dimension's full detail (reasoning, quick fix,
 * evidence) is always shown, not tucked behind a toggle nothing can click.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Report, ReportDimension, SignalCorrection, SignalEvidenceIssue } from "@/types/report";

// Deliberately no Font.register call - "Helvetica" is one of the 14 standard
// PDF fonts react-pdf supports out of the box (with real bold/italic/
// bold-italic variants resolved automatically from fontWeight/fontStyle), so
// registering it would only risk misconfiguring something that already works.
//
// Bug found via real-data verification: the standard fonts use WinAnsi
// encoding, which does NOT include U+2192 (→) - it silently rendered as a
// garbage glyph ("3 →5" became "3 '5") instead of erroring, so it wasn't
// caught by any type/build check, only by actually looking at a rendered
// page. Curly quotes/middle-dot/em-dash below ARE in WinAnsi and render
// fine; the arrow specifically is not - use "->" instead, matching the
// ASCII convention already used for this everywhere else in the codebase.

const BAND_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  Elite: { bg: "#eafaf1", fg: "#1e7e46", border: "#a8e0c2" },
  Strong: { bg: "#eaf3fb", fg: "#1a5f9e", border: "#a9cdea" },
  Inconsistent: { bg: "#fef9e7", fg: "#9a7d0a", border: "#eddc8a" },
  "At Risk": { bg: "#fdf0e5", fg: "#a85c1a", border: "#f0c99a" },
  Fail: { bg: "#fdecea", fg: "#a5301f", border: "#f0aca3" },
};
const DEFAULT_BAND_COLOR = { bg: "#f2f2f2", fg: "#333", border: "#ccc" };

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#222" },
  h1: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  meta: { fontSize: 9, color: "#777", marginBottom: 14 },

  banner: { borderRadius: 4, borderWidth: 1, padding: 12, marginBottom: 14 },
  bannerRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 6 },
  bannerScore: { fontSize: 22, fontWeight: "bold" },
  bannerMax: { fontSize: 12, marginLeft: 4, opacity: 0.75 },
  bannerBand: { fontSize: 10, fontWeight: "bold", marginLeft: "auto" },
  bannerBrief: { fontSize: 10, lineHeight: 1.5, marginBottom: 4 },
  bannerNote: { fontSize: 8.5, opacity: 0.8 },

  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 4, padding: 10, marginBottom: 12 },
  cardTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 4 },
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.4 },

  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 8, marginTop: 4 },

  dim: { borderWidth: 1, borderColor: "#ddd", borderRadius: 4, marginBottom: 8, padding: 10 },
  dimHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  dimId: { fontSize: 8.5, fontWeight: "bold", color: "#888", width: 26 },
  dimName: { fontSize: 10.5, fontWeight: "bold", flex: 1 },
  dimScore: { fontSize: 10.5, fontWeight: "bold" },
  dimScoreDisabled: { fontSize: 9, fontStyle: "italic", color: "#999" },
  dimLabel: { fontSize: 7.5, fontWeight: "bold", color: "#999", textTransform: "uppercase", marginTop: 5, marginBottom: 1 },
  dimText: { fontSize: 9, lineHeight: 1.4 },
  dimNote: { fontSize: 8.5, backgroundColor: "#fef5e7", color: "#6b4a00", padding: 4, borderRadius: 3, marginTop: 4 },
  evidenceItem: { fontSize: 8.5, borderLeftWidth: 2, borderLeftColor: "#ccc", paddingLeft: 6, marginTop: 3 },
  evidenceLine: { fontSize: 7.5, color: "#999" },
  evidenceQuote: { fontSize: 8.5, fontStyle: "italic" },

  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#999", textAlign: "center" },
});

function Banner({ report }: { report: Report }) {
  const color = BAND_COLORS[report.band] ?? DEFAULT_BAND_COLOR;
  const isRescaled = report.maxPossible !== 100;
  const totalCap = report.appliedCaps.find((c) => c.effect.type === "maxTotal");

  return (
    <View style={[styles.banner, { backgroundColor: color.bg, borderColor: color.border }]}>
      <View style={styles.bannerRow}>
        <Text style={[styles.bannerScore, { color: color.fg }]}>{report.total}</Text>
        <Text style={[styles.bannerMax, { color: color.fg }]}>/ 100</Text>
        <Text style={[styles.bannerBand, { color: color.fg }]}>{report.band}</Text>
      </View>
      {report.brief && <Text style={[styles.bannerBrief, { color: color.fg }]}>{report.brief}</Text>}
      {isRescaled && (
        <Text style={[styles.bannerNote, { color: color.fg }]}>
          Raw dimension score was {report.rawTotal} / {report.maxPossible}
          {report.callType === "coaching" ? " (Movement Coaching Quality disabled for this call)" : ""}, rescaled to /100.
        </Text>
      )}
      {totalCap && (
        <Text style={[styles.bannerNote, { color: color.fg }]}>
          An automatic cap held the total to {totalCap.effect.type === "maxTotal" ? totalCap.effect.value : report.total} - see
          {" "}&quot;Applied caps&quot; below.
        </Text>
      )}
      <Text style={[styles.bannerNote, { color: color.fg, marginTop: 4 }]}>
        {report.callType === "kickoff" ? "Kickoff call" : "Coaching call"} · scored with {report.model}
      </Text>
    </View>
  );
}

function SignalCorrectionsCard({ corrections }: { corrections: SignalCorrection[] }) {
  if (corrections.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Signal corrections applied</Text>
      {corrections.map((c, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>-</Text>
          <Text style={styles.bulletText}>
            {c.signal} (tied to {c.dimensionId}): reported as {String(c.reportedValue)}, corrected to {String(c.correctedValue)} -
            {" "}{c.reason}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SignalEvidenceIssuesCard({ issues }: { issues: SignalEvidenceIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Unvalidated cap signals corrected</Text>
      {issues.map((c, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>-</Text>
          <Text style={styles.bulletText}>
            {c.signal} (cap: {c.capId}): reported as {String(c.reportedValue)}, corrected to {String(c.correctedValue)} -
            {" "}{c.reason}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DimensionBlock({ dim }: { dim: ReportDimension }) {
  return (
    <View style={styles.dim} wrap={false}>
      <View style={styles.dimHeader}>
        <Text style={styles.dimId}>{dim.id}</Text>
        <Text style={styles.dimName}>{dim.name}</Text>
        {dim.disabled ? (
          <Text style={styles.dimScoreDisabled}>disabled</Text>
        ) : (
          <Text style={styles.dimScore}>
            {dim.score ?? "—"} / {dim.maxScore}
          </Text>
        )}
      </View>

      {dim.disabled ? (
        <Text style={styles.dimText}>This dimension was disabled{dim.disabledReason ? `: ${dim.disabledReason}` : "."}</Text>
      ) : (
        <>
          <Text style={styles.dimLabel}>Observed behaviour</Text>
          <Text style={styles.dimText}>{dim.observedBehaviour}</Text>

          <Text style={styles.dimLabel}>Reasoning</Text>
          <Text style={styles.dimText}>{dim.reasoning}</Text>

          {dim.quickFix && (
            <>
              <Text style={styles.dimLabel}>Quick fix</Text>
              <Text style={styles.dimText}>{dim.quickFix}</Text>
            </>
          )}

          {dim.cappedBy && <Text style={styles.dimNote}>Capped by: {dim.cappedBy}</Text>}
          {dim.scoreClampReason && <Text style={styles.dimNote}>Score clamped: {dim.scoreClampReason}</Text>}
          {dim.insufficientEvidence && <Text style={styles.dimNote}>Flagged: low cited evidence for this dimension.</Text>}

          <Text style={styles.dimLabel}>Evidence ({dim.evidence.length})</Text>
          {dim.evidence.length === 0 ? (
            <Text style={[styles.dimText, { color: "#999", fontStyle: "italic" }]}>No cited evidence for this dimension.</Text>
          ) : (
            dim.evidence.map((ev, i) => (
              <View key={i} style={styles.evidenceItem}>
                <Text style={styles.evidenceLine}>Line {ev.line}</Text>
                <Text style={styles.evidenceQuote}>&ldquo;{ev.quote}&rdquo;</Text>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

export function ReportDocument({ report, runId }: { report: Report; runId: string }) {
  return (
    <Document title={`Call score report - ${runId}`}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.h1}>Call Score Report</Text>
        <Text style={styles.meta}>
          Run {runId} · generated {new Date(report.generatedAt).toLocaleString()}
        </Text>

        <Banner report={report} />

        {report.oneThing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>The one thing to improve</Text>
            <Text style={[styles.dimText, { fontWeight: "bold", marginBottom: 3 }]}>
              {report.oneThing.dimensionName} ({report.oneThing.currentScore} -&gt; {report.oneThing.potentialScore})
            </Text>
            <Text style={[styles.dimText, { marginBottom: 4 }]}>
              Fixing this alone moves the total from {report.oneThing.currentTotal} to {report.oneThing.potentialTotal} -
              {" "}{report.oneThing.potentialBand}.
            </Text>
            <Text style={styles.dimText}>{report.oneThing.explanation}</Text>
          </View>
        )}

        {report.evidenceWarning && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Evidence warning</Text>
            <Text style={styles.dimText}>
              A meaningful share of this transcript&apos;s cited evidence didn&apos;t hold up during validation. The scores in this
              report only reflect evidence that passed validation.
            </Text>
          </View>
        )}

        <SignalCorrectionsCard corrections={report.signalCorrections} />
        <SignalEvidenceIssuesCard issues={report.signalEvidenceIssues} />

        {report.redFlags.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Red flags</Text>
            {report.redFlags.map((flag, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>-</Text>
                <Text style={styles.bulletText}>{flag}</Text>
              </View>
            ))}
          </View>
        )}

        {report.appliedCaps.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Applied caps</Text>
            {report.appliedCaps.map((cap) => (
              <View key={cap.id} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>-</Text>
                <Text style={styles.bulletText}>{cap.condition}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Dimension scores</Text>
        {report.dimensions.map((dim) => (
          <DimensionBlock key={dim.id} dim={dim} />
        ))}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
