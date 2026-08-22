/**
 * GET /api/runs/[id]/pdf - generates the PDF on demand from the stored
 * `report` jsonb (react-pdf's `renderToBuffer`), not from a cached/pre-built
 * file. Same "one shape, two renderers" principle as ReportView.tsx: this
 * route and the web report page both render the exact same `Report` the
 * pipeline produced, they just produce different bytes from it.
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { getRun } from "@/lib/runs";
import { ReportDocument } from "@/pdf/ReportDocument";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    return Response.json({ error: "No run with this id." }, { status: 404 });
  }
  if (run.status !== "complete" || !run.report) {
    return Response.json({ error: `This run isn't complete yet (status: ${run.status}) - no report to export.` }, { status: 409 });
  }

  const buffer = await renderToBuffer(<ReportDocument report={run.report} runId={run.id} />);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="call-score-${run.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
