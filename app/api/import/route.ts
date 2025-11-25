import { NextRequest, NextResponse } from 'next/server';
import { parseCsv, validateCustomerHeaders, validateContractHeaders, normalizeRow } from '@/lib/csv';
import { runImportJob } from '@/lib/job.queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const customersFile = formData.get('customers') as File | null;
    const contractsFile = formData.get('contracts') as File | null;

    if (!customersFile) {
      return NextResponse.json({ error: 'customers.csv is required' }, { status: 400 });
    }

    const customersBuffer = Buffer.from(await customersFile.arrayBuffer());
    let customerRows = parseCsv(customersBuffer);
    customerRows = customerRows.map(normalizeRow);

    const validCust = validateCustomerHeaders(customerRows);
    if (!validCust.ok) {
      return NextResponse.json({ error: validCust.message }, { status: 400 });
    }

    let contractRows: Record<string, string>[] = [];
    if (contractsFile) {
      const contractsBuffer = Buffer.from(await contractsFile.arrayBuffer());
      contractRows = parseCsv(contractsBuffer);
      contractRows = contractRows.map(normalizeRow);

      const validCont = validateContractHeaders(contractRows);
      if (!validCont.ok) {
        return NextResponse.json({ error: validCont.message }, { status: 400 });
      }
    }

    const jobId = await runImportJob({
      customers: customerRows,
      contracts: contractRows,
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`Created job: ${jobId}`);
    return NextResponse.json({ jobId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

