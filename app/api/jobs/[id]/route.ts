import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/job.queue';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Fetching job: ${id}`);
    const job = getJob(id);

    if (!job) {
      console.log(`Job ${id} not found`);
      return NextResponse.json({ error: 'Job not found', jobId: id }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error: any) {
    console.error('Error fetching job:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

