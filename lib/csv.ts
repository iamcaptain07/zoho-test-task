import { parse } from 'csv-parse/sync';

export function parseCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString('utf8');
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records as Record<string, string>[];
}

export function validateCustomerHeaders(rows: Record<string, string>[]) {
  if (rows.length === 0) {
    return { ok: false, message: 'customers.csv is empty' };
  }

  const required = ['customer_id', 'last_name'];
  const headers = Object.keys(rows[0]).map(h => h.toLowerCase());

  for (const r of required) {
    if (!headers.includes(r)) {
      return { ok: false, message: `Missing required column: ${r}` };
    }
  }

  return { ok: true };
}

export function validateContractHeaders(rows: Record<string, string>[]) {
  if (rows.length === 0) {
    return { ok: true };
  }

  const required = ['contract_id', 'customer_id'];
  const headers = Object.keys(rows[0]).map(h => h.toLowerCase());

  for (const r of required) {
    if (!headers.includes(r)) {
      return { ok: false, message: `Missing required column: ${r}` };
    }
  }

  return { ok: true };
}

export function normalizeFieldName(field: string): string {
  const lower = field.toLowerCase();
  const mapping: Record<string, string> = {
    customer_id: 'customer_id',
    customerid: 'customer_id',
    'customer id': 'customer_id',
    first_name: 'first_name',
    firstname: 'first_name',
    'first name': 'first_name',
    last_name: 'last_name',
    lastname: 'last_name',
    'last name': 'last_name',
    email: 'email',
    phone: 'phone',
    birthday: 'birthday',
    occupation_status: 'occupation_status',
    occupationstatus: 'occupation_status',
    'occupation status': 'occupation_status',
    marital_status: 'marital_status',
    maritalstatus: 'marital_status',
    'marital status': 'marital_status',
    contract_id: 'contract_id',
    contractid: 'contract_id',
    'contract id': 'contract_id',
    insurance_type: 'insurance_type',
    insurancetype: 'insurance_type',
    'insurance type': 'insurance_type',
    insurance_company: 'insurance_company',
    insurancecompany: 'insurance_company',
    'insurance company': 'insurance_company',
    price: 'price',
    billing_cycle: 'billing_cycle',
    billingcycle: 'billing_cycle',
    'billing cycle': 'billing_cycle',
  };

  return mapping[lower] || field;
}

export function normalizeRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeFieldName(key)] = value;
  }
  return normalized;
}

