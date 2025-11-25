import { createRecords, searchRecords, updateRecord, getAllRecordsPaginated } from './zoho.client';

type JobPayload = {
  customers: Record<string, string>[];
  contracts: Record<string, string>[];
};

type JobLog = {
  ts: string;
  level: string;
  msg: string;
};

type Job = {
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs: JobLog[];
  stats?: {
    contactsCreated: number;
    contactsUpdated: number;
    contractsCreated: number;
    contractsUpdated: number;
    errors: number;
  };
};

const jobs: Record<string, Job> = (global as any).__zohoJobs || ((global as any).__zohoJobs = {});

function log(jobId: string, level: string, msg: string) {
  if (!jobs[jobId]) return;
  jobs[jobId].logs.push({
    ts: new Date().toISOString(),
    level,
    msg,
  });
}

function createJobId(): string {
  return 'job_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
}

export async function runImportJob(payload: JobPayload): Promise<string> {
  const jobId = createJobId();
  jobs[jobId] = {
    status: 'pending',
    logs: [],
    stats: {
      contactsCreated: 0,
      contactsUpdated: 0,
      contractsCreated: 0,
      contractsUpdated: 0,
      errors: 0,
    },
  };

  console.log(`Job ${jobId} created with status: pending`);

  (async () => {
    try {
      jobs[jobId].status = 'running';
      log(
        jobId,
        'info',
        `Starting import. Customers: ${payload.customers.length}, Contracts: ${payload.contracts.length}`
      );

      const contactMap: Record<string, string> = {};
      const batchSize = 50;

      log(jobId, 'info', 'Fetching existing contacts from Zoho...');
      let existingContacts: any[] = [];
      const emailMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      
      try {
        existingContacts = await getAllRecordsPaginated('Contacts');
        log(jobId, 'info', `Found ${existingContacts.length} existing contacts`);
        
        let contactsWithCustomerId = 0;
        for (const contact of existingContacts) {
          const customerId = contact.Customer_ID;
          if (customerId !== null && customerId !== undefined && customerId !== '') {
            const custIdStr = String(customerId);
            contactMap[custIdStr] = contact.id;
            contactsWithCustomerId++;
          }
          
          if (contact.Email) {
            emailMap[contact.Email.toLowerCase()] = contact.id;
          }
          
          const fullName = `${(contact.First_Name || '').toLowerCase()} ${(contact.Last_Name || '').toLowerCase()}`.trim();
          if (fullName) {
            nameMap[fullName] = contact.id;
          }
        }
        log(jobId, 'info', `Mapped ${Object.keys(contactMap).length} contacts by Customer_ID (${contactsWithCustomerId} out of ${existingContacts.length} have Customer_ID)`);
        log(jobId, 'info', `Also mapped ${Object.keys(emailMap).length} by email, ${Object.keys(nameMap).length} by name for fallback matching`);
        
        if (Object.keys(contactMap).length === 0 && existingContacts.length > 0) {
          const sampleContact = existingContacts[0];
          log(jobId, 'warn', `No contacts have Customer_ID field populated. Will use email/name matching.`);
          log(jobId, 'info', `Sample contact: id=${sampleContact.id}, Last_Name=${sampleContact.Last_Name}, Email=${sampleContact.Email}`);
        }
      } catch (e: any) {
        log(jobId, 'warn', `Could not fetch existing contacts: ${e.message}. Proceeding with creation only.`);
      }

      for (let i = 0; i < payload.customers.length; i += batchSize) {
        const batch = payload.customers.slice(i, i + batchSize);
        const toCreate: any[] = [];
        const toUpdate: Array<{ id: string; data: any }> = [];

        for (const row of batch) {
          const custId = row.customer_id;
          if (!custId) {
            log(jobId, 'warn', `Skipping row missing customer_id`);
            continue;
          }

          const custIdStr = String(custId);
          const custIdNum = Number(custId);
          let existingContactId = contactMap[custIdStr] || contactMap[String(custIdNum)];

          if (!existingContactId) {
            const rowEmail = row.email?.toLowerCase();
            const rowName = `${(row.first_name || '').toLowerCase()} ${(row.last_name || '').toLowerCase()}`.trim();
            
            if (rowEmail && emailMap[rowEmail]) {
              existingContactId = emailMap[rowEmail];
              log(jobId, 'info', `Matched contact by email for customer_id=${custId}`);
            } else if (rowName && nameMap[rowName]) {
              existingContactId = nameMap[rowName];
              log(jobId, 'info', `Matched contact by name for customer_id=${custId}`);
            }
            
            if (existingContactId) {
              contactMap[custIdStr] = existingContactId;
            }
          }

          if (existingContactId) {
            toUpdate.push({
              id: existingContactId,
              data: {
                Last_Name: row.last_name || 'Unknown',
                First_Name: row.first_name || '',
                Email: row.email || null,
                Phone: row.phone || null,
                Customer_ID: custIdNum,
                Birthday: row.birthday || null,
                Occupation_Status: row.occupation_status || null,
                Marital_Status: row.marital_status || null,
              },
            });
          } else {
            toCreate.push({
              Last_Name: row.last_name || 'Unknown',
              First_Name: row.first_name || '',
              Email: row.email || null,
              Phone: row.phone || null,
              Customer_ID: custIdNum,
              Birthday: row.birthday || null,
              Occupation_Status: row.occupation_status || null,
              Marital_Status: row.marital_status || null,
            });
          }
        }

        for (const updateItem of toUpdate) {
          try {
            await updateRecord('Contacts', updateItem.id, updateItem.data);
            const custId = String(updateItem.data.Customer_ID);
            contactMap[custId] = updateItem.id;
            jobs[jobId].stats!.contactsUpdated++;
            log(jobId, 'info', `Updated contact id=${updateItem.id} for customer_id=${custId}`);
          } catch (e: any) {
            jobs[jobId].stats!.errors++;
            log(jobId, 'error', `Failed to update contact: ${e.message}`);
          }
        }

        if (toCreate.length > 0) {
          try {
            const resp = await createRecords('Contacts', toCreate);
            const data = resp.data || [];

            for (let idx = 0; idx < data.length; idx++) {
              const item = data[idx];
              if (item.code === 'SUCCESS') {
                const id = item.details.id;
                const created = toCreate[idx];
                const custIdVal = String(created.Customer_ID);
                contactMap[custIdVal] = id;
                contactMap[String(Number(custIdVal))] = id;
                jobs[jobId].stats!.contactsCreated++;
                log(jobId, 'info', `Created contact id=${id} for customer_id=${custIdVal}`);
              } else {
                jobs[jobId].stats!.errors++;
                const errorMsg = item.details || item.message || JSON.stringify(item);
                log(jobId, 'error', `Failed to create contact: ${errorMsg}`);
              }
            }
          } catch (e: any) {
            jobs[jobId].stats!.errors++;
            log(jobId, 'error', `Batch create failed: ${e.message}`);
          }
        }
      }

      log(jobId, 'info', `Contacts processed. Creating contracts...`);

      log(jobId, 'info', 'Fetching existing contracts from Zoho...');
      const contractMap: Record<string, string> = {};
      try {
        const existingContracts = await getAllRecordsPaginated('Insurance_Contracts');
        log(jobId, 'info', `Found ${existingContracts.length} existing contracts`);
        
        for (const contract of existingContracts) {
          if (contract.Contract_ID) {
            contractMap[contract.Contract_ID] = contract.id;
          }
        }
        log(jobId, 'info', `Mapped ${Object.keys(contractMap).length} contracts by Contract_ID`);
      } catch (e: any) {
        log(jobId, 'warn', `Could not fetch existing contracts: ${e.message}. Proceeding with creation only.`);
      }

      for (let i = 0; i < payload.contracts.length; i += batchSize) {
        const batch = payload.contracts.slice(i, i + batchSize);
        const toCreate: any[] = [];
        const toUpdate: Array<{ id: string; data: any }> = [];

        for (const c of batch) {
          const custId = String(c.customer_id);
          const contactId = contactMap[custId];

          if (!contactId) {
            log(jobId, 'warn', `No contact found for customer_id=${custId}, skipping contract`);
            continue;
          }

          const existingContractId = contractMap[c.contract_id];

          const contractName = c.contract_id || `Contract-${custId}-${c.insurance_type}`;
          
          if (existingContractId) {
            toUpdate.push({
              id: existingContractId,
              data: {
                Name: contractName,
                Contract_ID: c.contract_id,
                Customer_ID: Number(custId),
                Insurance_Type: c.insurance_type,
                Insurance_Company: c.insurance_company,
                Price: c.price ? Number(c.price) : null,
                Billing_Cycle: c.billing_cycle,
                Contact_Lookup: { id: contactId },
              },
            });
          } else {
            toCreate.push({
              Name: contractName,
              Contract_ID: c.contract_id,
              Customer_ID: Number(custId),
              Insurance_Type: c.insurance_type,
              Insurance_Company: c.insurance_company,
              Price: c.price ? Number(c.price) : null,
              Billing_Cycle: c.billing_cycle,
              Contact_Lookup: { id: contactId },
            });
          }
        }

        for (const updateItem of toUpdate) {
          try {
            await updateRecord('Insurance_Contracts', updateItem.id, updateItem.data);
            jobs[jobId].stats!.contractsUpdated++;
            log(jobId, 'info', `Updated contract ${updateItem.data.Contract_ID}`);
          } catch (e: any) {
            jobs[jobId].stats!.errors++;
            log(jobId, 'error', `Failed to update contract: ${e.message}`);
          }
        }

        if (toCreate.length > 0) {
          try {
            const resp = await createRecords('Insurance_Contracts', toCreate);
            const data = resp.data || [];

            for (const item of data) {
              if (item.code === 'SUCCESS') {
                jobs[jobId].stats!.contractsCreated++;
                log(jobId, 'info', `Created contract: ${item.details.id}`);
              } else {
                jobs[jobId].stats!.errors++;
                log(jobId, 'error', `Failed to create contract: ${JSON.stringify(item)}`);
              }
            }
          } catch (e: any) {
            jobs[jobId].stats!.errors++;
            log(jobId, 'error', `Batch contract create failed: ${e.message}`);
          }
        }
      }

      jobs[jobId].status = 'completed';
      const stats = jobs[jobId].stats!;
      log(
        jobId,
        'info',
        `Job completed. Created: ${stats.contactsCreated} contacts, ${stats.contractsCreated} contracts. Updated: ${stats.contactsUpdated} contacts, ${stats.contractsUpdated} contracts. Errors: ${stats.errors}`
      );
    } catch (e: any) {
      jobs[jobId].status = 'failed';
      log(jobId, 'error', `Job failed: ${e.message}`);
    }
  })();

  return jobId;
}

export function getJob(jobId: string): Job | null {
  const job = jobs[jobId];
  if (!job) {
    console.log(`Job ${jobId} not found. Available jobs:`, Object.keys(jobs));
    return null;
  }
  return job;
}

export function getAllJobs(): Record<string, Job> {
  return jobs;
}

