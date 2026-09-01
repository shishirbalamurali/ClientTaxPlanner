import { NextResponse } from 'next/server';
import { SAMPLE_CLIENTS, getClient } from '@/data/clients';
import { buildClientWorkbook } from '@/lib/excel/workbook';

export const runtime = 'nodejs';
export const dynamicParams = false;

export function generateStaticParams() {
  return SAMPLE_CLIENTS.map((client) => ({ clientId: client.id }));
}

function filenameFor(displayName: string, taxYear: number): string {
  const slug = displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${taxYear}-Client-Analysis.xlsx`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) {
    return NextResponse.json({ error: `Unknown client "${clientId}".` }, { status: 404 });
  }

  const buffer = await buildClientWorkbook(client);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filenameFor(client.displayName, client.taxYear)}"`,
      // Built at deploy time and identical for every visitor: let the CDN hold
      // it, and have browsers revalidate so a redeploy is picked up at once.
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
