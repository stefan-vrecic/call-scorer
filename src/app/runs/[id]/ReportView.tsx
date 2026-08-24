"use client";

/**
 * Phase 7: the real report view. Renders exactly the `Report` shape
 * (src/types/report.ts) that the pipeline produces and Supabase stores -
 * this component and the Phase 8 PDF are the two renderers of that one
 * shape, per the type file's own doc comment. Deliberately typed loosely
 * (this file's own local interfaces, not an import of the pipeline's
 * Report type) because this is a client component reading `report jsonb`
 * back out of an API response - it doesn't know statically that the value
 * matches, only that it came from our own pipeline.
 */

import styles from "./report.module.css";

interface Evidence {
  line: number;
  quote: string;
}

interface ReportDimension {
  id: string;
  name: string;
  maxScore: number;
  score: number | null;
  reasoning: string;
  quickFix: string;
  evidence: Evidence[];
  observedBehaviour: string;
  insufficientEvidence: boolean;
  disabled: boolean;
  disabledReason?: string;
  cappedBy?: string;
  scoreClampReason?: string;
}

type CapEffect =
  | { type: "maxTotal"; value: number }
  | { type: "maxDimension"; dimensionId: string; value: number }
  | { type: "zeroDimension"; dimensionId: string; nonRecoverable: boolean };

interface AppliedCap {
  id: string;
  condition: string;
  effect: CapEffect;
}

interface OneThing {
  dimensionId: string;
  dimensionName: string;
  currentScore: number;
  potentialScore: number;
  currentTotal: number;
  potentialTotal: number;
  potentialBand: string;
  explanation: string;
}

interface SignalCorrection {
  signal: string;
  dimensionId: string;
  reportedValue: boolean;
  correctedValue: boolean;
  reason: string;
}

interface SignalEvidenceIssue {
  signal: string;
  capId: string;
  reportedValue: boolean;
  correctedValue: boolean;
  reason: string;
}

export interface ReportShape {
  callType: "kickoff" | "coaching";
  model: string;
  dimensions: ReportDimension[];
  appliedCaps: AppliedCap[];
  rawTotal: number;
  total: number;
  maxPossible: number;
  band: string;
  oneThing: OneThing | null;
  evidenceWarning: boolean;
  signalCorrections: SignalCorrection[];
  signalEvidenceIssues: SignalEvidenceIssue[];
  brief: string;
  redFlags: string[];
  generatedAt: string;
}

const BAND_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  Elite: { bg: "#eafaf1", fg: "#1e7e46", border: "#a8e0c2" },
  Strong: { bg: "#eaf3fb", fg: "#1a5f9e", border: "#a9cdea" },
  Inconsistent: { bg: "#fef9e7", fg: "#9a7d0a", border: "#eddc8a" },
  "At Risk": { bg: "#fdf0e5", fg: "#a85c1a", border: "#f0c99a" },
  Fail: { bg: "#fdecea", fg: "#a5301f", border: "#f0aca3" },
};
const DEFAULT_BAND_COLOR = { bg: "#f2f2f2", fg: "#333", border: "#ccc" };

export default function ReportView({ report }: { report: ReportShape }) {
  const bandColor = BAND_COLORS[report.band] ?? DEFAULT_BAND_COLOR;
  // `total` is always on the rescaled /100 scale; `rawTotal`/`maxPossible` are
  // the pre-rescale raw-dimension-points scale (see applyRubricRules.ts) - two
  // different scales, never compared directly. A maxTotal cap is the only
  // thing that can make the reported /100 total lower than what the raw
  // dimension scores would rescale to, so detect it from appliedCaps, not by
  // comparing total to rawTotal.
  const totalCap = report.appliedCaps.find((c) => c.effect.type === "maxTotal");
  const isRescaled = report.maxPossible !== 100;

  return (
    <div className={styles.wrap}>
      <section
        className={styles.banner}
        style={
          {
            "--band-bg": bandColor.bg,
            "--band-fg": bandColor.fg,
            "--band-border": bandColor.border,
          } as React.CSSProperties
        }
      >
        <div className={styles.bannerTop}>
          <span className={styles.bannerScore}>{report.total}</span>
          <span className={styles.bannerMax}>/ 100</span>
          <span className={styles.bannerBand}>{report.band}</span>
        </div>
        {report.brief && <p className={styles.bannerBrief}>{report.brief}</p>}
        {isRescaled && (
          <p className={styles.rawTotalNote}>
            Raw dimension score was {report.rawTotal} / {report.maxPossible}
            {report.callType === "coaching" ? " (Movement Coaching Quality disabled for this call)" : ""}, rescaled to /100.
          </p>
        )}
        {totalCap && (
          <p className={styles.rawTotalNote}>
            Would otherwise have scored higher - an automatic cap held the total to {totalCap.effect.type === "maxTotal" ? totalCap.effect.value : report.total} - see &ldquo;Applied caps&rdquo; below.
          </p>
        )}
        <p className={styles.bannerMeta}>
          {report.callType === "kickoff" ? "Kickoff call" : "Coaching call"} &middot; scored with {report.model}
        </p>
      </section>

      {report.oneThing && (
        <section className={`${styles.card} ${styles.oneThing}`}>
          <div className={styles.cardTitle}>The one thing to improve</div>
          <div className={styles.oneThingHeadline}>
            {report.oneThing.dimensionName} ({report.oneThing.currentScore} &rarr; {report.oneThing.potentialScore})
          </div>
          <div className={styles.oneThingMove}>
            Fixing this alone moves the total from {report.oneThing.currentTotal} to {report.oneThing.potentialTotal} -
            {" "}{report.oneThing.potentialBand}.
          </div>
          <p>{report.oneThing.explanation}</p>
        </section>
      )}

      {report.evidenceWarning && (
        <section className={`${styles.card} ${styles.notice}`}>
          <div className={styles.cardTitle}>⚠️ Evidence warning</div>
          <p style={{ margin: 0 }}>
            A meaningful share of this transcript&apos;s cited evidence didn&apos;t hold up during validation. The scores below only
            reflect evidence that passed validation - this is a flag to review the transcript quality, not necessarily the score itself.
          </p>
        </section>
      )}

      {report.signalCorrections.length > 0 && (
        <section className={`${styles.card} ${styles.notice}`}>
          <div className={styles.cardTitle}>⚠️ Signal corrections applied</div>
          <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            A call-level signal disagreed with its own dimension&apos;s validated evidence. The signal was corrected before scoring so
            it wouldn&apos;t trigger a cap based on unevidenced data.
          </p>
          {report.signalCorrections.map((c, i) => (
            <div key={i} className={styles.correctionRow}>
              <strong>{c.signal}</strong> (tied to {c.dimensionId}): reported as <code>{String(c.reportedValue)}</code>, corrected to{" "}
              <code>{String(c.correctedValue)}</code> &mdash; {c.reason}
            </div>
          ))}
        </section>
      )}

      {(report.signalEvidenceIssues ?? []).length > 0 && (
        <section className={`${styles.card} ${styles.notice}`}>
          <div className={styles.cardTitle}>⚠️ Unvalidated cap signals corrected</div>
          <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            A signal that would have triggered a scoring cap had no citation that checked out against the transcript. It was treated as
            not firing before scoring, the same evidence-or-nothing bar applied to per-dimension evidence.
          </p>
          {report.signalEvidenceIssues.map((c, i) => (
            <div key={i} className={styles.correctionRow}>
              <strong>{c.signal}</strong> (cap: {c.capId}): reported as <code>{String(c.reportedValue)}</code>, corrected to{" "}
              <code>{String(c.correctedValue)}</code> &mdash; {c.reason}
            </div>
          ))}
        </section>
      )}

      {report.redFlags.length > 0 && (
        <section className={`${styles.card} ${styles.redFlags}`}>
          <div className={styles.cardTitle}>🚩 Red flags</div>
          <ul>
            {report.redFlags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </section>
      )}

      {report.appliedCaps.length > 0 && (
        <section className={`${styles.card} ${styles.caps}`}>
          <div className={styles.cardTitle}>Applied caps</div>
          <ul>
            {report.appliedCaps.map((cap) => (
              <li key={cap.id}>{cap.condition}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className={styles.cardTitle} style={{ marginBottom: "0.6rem" }}>
          Dimension scores
        </div>
        <div className={styles.dimensionList}>
          {report.dimensions.map((dim) => (
            <DimensionRow key={dim.id} dim={dim} />
          ))}
        </div>
      </section>

      <p className={styles.footerMeta}>Report generated {new Date(report.generatedAt).toLocaleString()}</p>
    </div>
  );
}

function DimensionRow({ dim }: { dim: ReportDimension }) {
  return (
    <details className={styles.dimension}>
      <summary className={styles.dimSummary}>
        <span className={styles.dimCaret}>▶</span>
        <span className={styles.dimId}>{dim.id}</span>
        <span className={styles.dimName}>{dim.name}</span>
        {dim.cappedBy && <span className={`${styles.dimFlag} ${styles.dimFlagCap}`}>capped</span>}
        {dim.scoreClampReason && <span className={`${styles.dimFlag} ${styles.dimFlagClamp}`}>clamped</span>}
        {dim.insufficientEvidence && <span className={`${styles.dimFlag} ${styles.dimFlagInsufficient}`}>low evidence</span>}
        {dim.disabled ? (
          <span className={styles.dimScoreDisabled}>disabled</span>
        ) : (
          <span className={styles.dimScore}>
            {dim.score ?? "—"} / {dim.maxScore}
          </span>
        )}
      </summary>

      <div className={styles.dimBody}>
        {dim.disabled ? (
          <p style={{ margin: 0 }}>
            This dimension was disabled{dim.disabledReason ? `: ${dim.disabledReason}` : "."}
          </p>
        ) : (
          <>
            <div>
              <div className={styles.dimLabel}>Observed behaviour</div>
              <p style={{ margin: 0 }}>{dim.observedBehaviour}</p>
            </div>

            <div>
              <div className={styles.dimLabel}>Reasoning</div>
              <p style={{ margin: 0 }}>{dim.reasoning}</p>
            </div>

            {dim.quickFix && (
              <div>
                <div className={styles.dimLabel}>Quick fix</div>
                <p style={{ margin: 0 }}>{dim.quickFix}</p>
              </div>
            )}

            {dim.cappedBy && <p className={styles.dimNote}>Capped by: {dim.cappedBy}</p>}
            {dim.scoreClampReason && <p className={styles.dimNote}>Score clamped: {dim.scoreClampReason}</p>}

            <div>
              <div className={styles.dimLabel}>Evidence ({dim.evidence.length})</div>
              {dim.evidence.length === 0 ? (
                <p className={styles.noEvidence}>No cited evidence for this dimension.</p>
              ) : (
                <div className={styles.evidenceList}>
                  {dim.evidence.map((ev, i) => (
                    <div key={i} className={styles.evidenceItem}>
                      <span className={styles.evidenceLine}>L{ev.line}</span>
                      <span className={styles.evidenceQuote}>&ldquo;{ev.quote}&rdquo;</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
