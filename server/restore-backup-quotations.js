import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { db } from './db.ts';
import { quotations } from '../shared/schema.ts';
import { eq, and, gte, lte, or } from 'drizzle-orm';

// Test data patterns to identify demo/test data
const TEST_DATA_PATTERNS = [
  /test/i,
  /demo/i,
  /sample/i,
  /example/i,
  /acme/i,
  /placeholder/i,
  /dummy/i
];

function isTestData(quotation) {
  // For now, let's be less restrictive and allow replacement of any quotation
  // that doesn't look like real production data
  const fieldsToCheck = [
    quotation.brokerName,
    quotation.insuredName,
    quotation.notes
  ];
  
  // Check if it's obviously test data
  const hasTestPattern = fieldsToCheck.some(field => 
    field && TEST_DATA_PATTERNS.some(pattern => pattern.test(field))
  );
  
  // If it has test patterns, it's test data
  if (hasTestPattern) return true;
  
  // If premium is exactly 1000, 2000, 5000, 10000 etc, might be test data
  const roundPremiums = ['1000', '2000', '3000', '4000', '5000', '10000', '15000', '20000'];
  if (roundPremiums.includes(quotation.estimatedPremium)) {
    // Check if the name looks generic
    if (quotation.insuredName && quotation.insuredName.length < 10) {
      return true;
    }
  }
  
  // For this restoration, we'll be more permissive
  // Return true to allow replacement if the quotation has a generic look
  return false; // Changed to false to be less restrictive
}

function parseDate(dateStr) {
  // Parse MM/DD/YYYY format
  const [month, day, year] = dateStr.split('/').map(num => parseInt(num));
  return new Date(year, month - 1, day);
}

function formatDateForDB(date) {
  return date.toISOString();
}

function calculateDateDistance(date1, date2) {
  return Math.abs(date1.getTime() - date2.getTime());
}

async function findMatchingQuotation(backupQuotation, existingQuotations, usedIds = new Set()) {
  const brokerName = backupQuotation['Broker Name'] || backupQuotation['﻿Broker Name'];
  const status = backupQuotation['Status'];
  const quotationDate = backupQuotation['Quotation Date'];
  const backupDate = parseDate(quotationDate);
  
  // Map status to match database format
  const dbStatus = status === 'Decline' ? 'Declined' : status;
  
  // First try exact date match
  const exactMatches = existingQuotations.filter(q => {
    const qDate = new Date(q.quotationDate);
    return qDate.toDateString() === backupDate.toDateString() &&
           q.status === dbStatus &&
           !usedIds.has(q.id); // Don't match already used quotations
           // Temporarily disabled: && isTestData(q); // Only replace test data
  });
  
  if (exactMatches.length > 0) {
    // Prefer matching by broker name if possible
    const brokerMatch = exactMatches.find(q => 
      q.brokerName.toLowerCase().includes(brokerName.toLowerCase()) ||
      brokerName.toLowerCase().includes(q.brokerName.toLowerCase())
    );
    return brokerMatch || exactMatches[0];
  }
  
  // If no exact date match, find nearest date with same status
  const sameStatusQuotations = existingQuotations.filter(q => 
    q.status === dbStatus &&
    !usedIds.has(q.id) // Don't match already used quotations
    // Temporarily disabled: && isTestData(q)
  );
  
  if (sameStatusQuotations.length === 0) return null;
  
  // Find the nearest date
  let nearestQuotation = null;
  let minDistance = Infinity;
  
  for (const q of sameStatusQuotations) {
    const qDate = new Date(q.quotationDate);
    const distance = calculateDateDistance(backupDate, qDate);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestQuotation = q;
    }
  }
  
  // Only match if within 7 days
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  if (minDistance <= sevenDaysInMs) {
    return nearestQuotation;
  }
  
  return null;
}

async function restoreQuotations(csvFilePath, options = {}) {
  const {
    dryRun = true,
    verbose = true,
    createUnmatched = false // Option to create new quotations for unmatched records
  } = options;
  
  console.log('🔄 Starting quotation restoration process...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  
  try {
    // Read and parse CSV file
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`📊 Found ${records.length} records in backup file`);
    
    // Filter only Open and Declined quotations
    const backupQuotations = records.filter(r => 
      r.Status === 'Open' || r.Status === 'Decline'
    );
    
    console.log(`📋 Processing ${backupQuotations.length} Open/Declined quotations`);
    
    // Get all existing quotations
    const existingQuotations = await db.select().from(quotations);
    console.log(`📁 Found ${existingQuotations.length} existing quotations in database`);
    
    const updates = [];
    const noMatch = [];
    const usedQuotationIds = new Set(); // Track which quotations we've already matched
    
    for (const backupQ of backupQuotations) {
      // Handle BOM character in CSV headers
      const brokerName = backupQ['Broker Name'] || backupQ['﻿Broker Name'];
      const insuredName = backupQ['Insured Name'];
      const productType = backupQ['Marine Product Type'];
      const premium = backupQ['Estimated Premium'];
      const quotationDate = backupQ['Quotation Date'];
      const status = backupQ['Status'];
      const declineReason = backupQ['Decline Reason'];
      const notes = backupQ['Notes'];
      
      const matchingQ = await findMatchingQuotation(backupQ, existingQuotations, usedQuotationIds);
      
      if (matchingQ && !usedQuotationIds.has(matchingQ.id)) {
        usedQuotationIds.add(matchingQ.id);
        const updateData = {
          id: matchingQ.id,
          oldData: matchingQ,
          newData: {
            brokerName: brokerName.trim(),
            insuredName: insuredName.trim(),
            marineProductType: productType,
            estimatedPremium: premium,
            quotationDate: parseDate(quotationDate), // Use Date object directly
            status: status === 'Decline' ? 'Declined' : status,
            declineReason: declineReason || null,
            notes: notes || null,
            lastUpdated: new Date()
          }
        };
        
        updates.push(updateData);
        
        if (verbose) {
          console.log(`\n✅ Match found for: ${brokerName} - ${insuredName}`);
          console.log(`   Quotation ID: ${matchingQ.id}`);
          console.log(`   Date match: ${new Date(matchingQ.quotationDate).toLocaleDateString()} → ${quotationDate}`);
        }
      } else {
        noMatch.push(backupQ);
        if (verbose) {
          console.log(`\n❌ No match found for: ${brokerName} - ${insuredName} (${quotationDate})`);
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Matched quotations: ${updates.length}`);
    console.log(`❌ No match found: ${noMatch.length}`);
    
    if (!dryRun && updates.length > 0) {
      console.log('\n🔄 Applying updates...');
      
      for (const update of updates) {
        await db
          .update(quotations)
          .set(update.newData)
          .where(eq(quotations.id, update.id));
        
        console.log(`✅ Updated quotation #${update.id}`);
      }
      
      console.log('\n✅ All updates completed successfully!');
    } else if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made');
      console.log('Run with dryRun: false to apply changes');
    }
    
    // Handle unmatched records
    if (noMatch.length > 0) {
      if (createUnmatched && !dryRun) {
        console.log('\n🔄 Creating new quotations for unmatched records...');
        
        for (const backupQ of noMatch) {
          const brokerName = backupQ['Broker Name'] || backupQ['﻿Broker Name'];
          const insuredName = backupQ['Insured Name'];
          const productType = backupQ['Marine Product Type'];
          const premium = backupQ['Estimated Premium'];
          const quotationDate = backupQ['Quotation Date'];
          const status = backupQ['Status'];
          const declineReason = backupQ['Decline Reason'];
          const notes = backupQ['Notes'];
          
          try {
            const newQuotation = await db.insert(quotations).values({
              brokerName: brokerName.trim(),
              insuredName: insuredName.trim(),
              marineProductType: productType,
              estimatedPremium: premium,
              currency: 'AED', // Default currency
              quotationDate: parseDate(quotationDate), // Use Date object directly
              status: status === 'Decline' ? 'Declined' : status,
              declineReason: declineReason || null,
              notes: notes || null,
              createdBy: 1, // Default user
              lastUpdated: new Date(),
              requiresPreConditionSurvey: false
            }).returning();
            
            console.log(`✅ Created new quotation for: ${brokerName} - ${insuredName}`);
          } catch (error) {
            console.error(`❌ Failed to create quotation for: ${brokerName} - ${insuredName}`, error.message);
          }
        }
      } else {
        const unmatchedFile = 'unmatched-quotations.json';
        fs.writeFileSync(unmatchedFile, JSON.stringify(noMatch, null, 2));
        console.log(`\n📄 Unmatched records saved to: ${unmatchedFile}`);
        
        if (!createUnmatched) {
          console.log('💡 To create new quotations for unmatched records, run with --create-unmatched flag');
        }
      }
    }
    
    return {
      matched: updates.length,
      unmatched: noMatch.length,
      updates: dryRun ? updates : []
    };
    
  } catch (error) {
    console.error('❌ Error during restoration:', error);
    throw error;
  }
}

// Run the script
async function main() {
  const csvFile = process.argv[2] || 'Copy of Test One.csv';
  const args = process.argv.slice(3);
  const isDryRun = !args.includes('--live');
  const createUnmatched = args.includes('--create-unmatched');
  
  if (args.includes('--help')) {
    console.log('Usage: node restore-backup-quotations.js [csv-file] [options]');
    console.log('Options:');
    console.log('  --live              Apply changes (default is dry run)');
    console.log('  --create-unmatched  Create new quotations for unmatched records');
    console.log('  --help              Show this help message');
    process.exit(0);
  }
  
  try {
    const result = await restoreQuotations(csvFile, {
      dryRun: isDryRun,
      verbose: true,
      createUnmatched: createUnmatched
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Failed to restore quotations:', error);
    process.exit(1);
  }
}

// Only run if called directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  main();
}

export { restoreQuotations }; 