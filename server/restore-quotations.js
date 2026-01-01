const XLSX = require('xlsx');
const { db } = require('./db');
const { quotations } = require('../shared/schema');
const { eq, and, gte, lte } = require('drizzle-orm');

/**
 * Safe Quotation Data Restoration Script
 * This script restores quotation data from Excel backup while preserving system integrity
 */

async function restoreQuotationsFromExcel(excelFilePath, options = {}) {
  const {
    dryRun = true, // Set to false to actually perform the restoration
    replaceTestData = true, // Only replace obvious test/dummy data
    dateRange = null, // { start: Date, end: Date } - only restore data in this range
    preserveExistingIds = true, // Don't overwrite existing quotation IDs
    backupBeforeRestore = true // Create backup before restoration
  } = options;

  console.log('🔄 Starting quotation restoration process...');
  console.log(`📁 Excel file: ${excelFilePath}`);
  console.log(`🧪 Dry run mode: ${dryRun ? 'ON' : 'OFF'}`);
  
  try {
    // Step 1: Read and validate Excel file
    console.log('\n📖 Reading Excel file...');
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Found ${excelData.length} rows in Excel file`);
    
    // Step 2: Validate Excel data structure
    console.log('\n🔍 Validating Excel data structure...');
    if (excelData.length === 0) {
      throw new Error('Excel file is empty');
    }
    
    // Check required columns (adjust based on your Excel structure)
    const sampleRow = excelData[0];
    const requiredFields = ['brokerName', 'insuredName', 'marineProductType', 'estimatedPremium', 'currency', 'quotationDate', 'status'];
    const excelColumns = Object.keys(sampleRow);
    
    console.log('📋 Excel columns found:', excelColumns);
    
    // Map Excel columns to database fields (you may need to adjust this)
    const columnMapping = detectColumnMapping(excelColumns);
    console.log('🗺️  Column mapping:', columnMapping);
    
    // Step 3: Get current quotations from database
    console.log('\n📊 Analyzing current database state...');
    const existingQuotations = await db.select().from(quotations);
    console.log(`📈 Current quotations in database: ${existingQuotations.length}`);
    
    // Step 4: Identify test/dummy data to replace
    const testDataPatterns = [
      /test/i,
      /dummy/i,
      /sample/i,
      /example/i,
      /demo/i,
      /^broker\s*\d+$/i,
      /^insured\s*\d+$/i,
      /^client\s*\d+$/i
    ];
    
    const testQuotations = existingQuotations.filter(q => 
      testDataPatterns.some(pattern => 
        pattern.test(q.brokerName) || 
        pattern.test(q.insuredName)
      )
    );
    
    console.log(`🧪 Identified ${testQuotations.length} test/dummy quotations to potentially replace`);
    
    // Step 5: Process Excel data
    console.log('\n🔄 Processing Excel data...');
    const processedData = [];
    const errors = [];
    
    for (let i = 0; i < excelData.length; i++) {
      try {
        const row = excelData[i];
        const processedRow = processExcelRow(row, columnMapping, i + 1);
        
        // Apply date range filter if specified
        if (dateRange) {
          const quotationDate = new Date(processedRow.quotationDate);
          if (quotationDate < dateRange.start || quotationDate > dateRange.end) {
            continue; // Skip this row
          }
        }
        
        processedData.push(processedRow);
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }
    
    console.log(`✅ Successfully processed ${processedData.length} rows`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} rows had errors:`, errors);
    }
    
    // Step 6: Create restoration plan
    console.log('\n📋 Creating restoration plan...');
    const restorationPlan = createRestorationPlan(processedData, existingQuotations, {
      replaceTestData,
      preserveExistingIds
    });
    
    console.log(`📊 Restoration plan:`);
    console.log(`  - Quotations to insert: ${restorationPlan.toInsert.length}`);
    console.log(`  - Quotations to update: ${restorationPlan.toUpdate.length}`);
    console.log(`  - Quotations to keep unchanged: ${restorationPlan.toKeep.length}`);
    
    // Step 7: Show preview
    console.log('\n👀 Preview of changes:');
    if (restorationPlan.toInsert.length > 0) {
      console.log('\n📥 NEW QUOTATIONS TO INSERT:');
      restorationPlan.toInsert.slice(0, 3).forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.brokerName} - ${q.insuredName} - ${q.marineProductType} (${q.status})`);
      });
      if (restorationPlan.toInsert.length > 3) {
        console.log(`  ... and ${restorationPlan.toInsert.length - 3} more`);
      }
    }
    
    if (restorationPlan.toUpdate.length > 0) {
      console.log('\n🔄 QUOTATIONS TO UPDATE:');
      restorationPlan.toUpdate.slice(0, 3).forEach((update, i) => {
        console.log(`  ${i + 1}. ID ${update.id}: ${update.old.brokerName} → ${update.new.brokerName}`);
      });
      if (restorationPlan.toUpdate.length > 3) {
        console.log(`  ... and ${restorationPlan.toUpdate.length - 3} more`);
      }
    }
    
    // Step 8: Execute restoration (if not dry run)
    if (!dryRun) {
      console.log('\n🚀 Executing restoration...');
      
      // Create backup first
      if (backupBeforeRestore) {
        await createQuotationsBackup();
      }
      
      // Execute the restoration
      await executeRestorationPlan(restorationPlan);
      
      console.log('✅ Restoration completed successfully!');
    } else {
      console.log('\n🧪 DRY RUN COMPLETE - No changes were made to the database');
      console.log('💡 To execute the restoration, run with dryRun: false');
    }
    
    return {
      success: true,
      summary: {
        excelRows: excelData.length,
        processedRows: processedData.length,
        toInsert: restorationPlan.toInsert.length,
        toUpdate: restorationPlan.toUpdate.length,
        errors: errors.length
      }
    };
    
  } catch (error) {
    console.error('❌ Restoration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function detectColumnMapping(excelColumns) {
  const mapping = {};
  
  // Common column name variations
  const fieldMappings = {
    brokerName: ['broker', 'broker name', 'brokername', 'broker_name'],
    insuredName: ['insured', 'insured name', 'insuredname', 'insured_name', 'client', 'client name'],
    marineProductType: ['product', 'product type', 'marine product', 'marine product type', 'producttype'],
    estimatedPremium: ['premium', 'estimated premium', 'estimatedpremium', 'estimated_premium', 'amount'],
    currency: ['currency', 'curr'],
    quotationDate: ['date', 'quotation date', 'quotationdate', 'quotation_date', 'created date'],
    status: ['status', 'quotation status', 'state'],
    notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
    declineReason: ['decline reason', 'declinereason', 'decline_reason', 'reason']
  };
  
  for (const [dbField, variations] of Object.entries(fieldMappings)) {
    const match = excelColumns.find(col => 
      variations.some(variation => 
        col.toLowerCase().includes(variation.toLowerCase())
      )
    );
    if (match) {
      mapping[dbField] = match;
    }
  }
  
  return mapping;
}

function processExcelRow(row, columnMapping, rowNumber) {
  const processed = {};
  
  // Map required fields
  for (const [dbField, excelColumn] of Object.entries(columnMapping)) {
    if (excelColumn && row[excelColumn] !== undefined) {
      processed[dbField] = row[excelColumn];
    }
  }
  
  // Validate and clean data
  if (!processed.brokerName || !processed.insuredName) {
    throw new Error(`Missing required fields (broker/insured) in row ${rowNumber}`);
  }
  
  // Clean and validate date
  if (processed.quotationDate) {
    const date = new Date(processed.quotationDate);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date in row ${rowNumber}: ${processed.quotationDate}`);
    }
    processed.quotationDate = date;
  } else {
    processed.quotationDate = new Date(); // Default to today
  }
  
  // Clean and validate premium
  if (processed.estimatedPremium) {
    const premium = parseFloat(processed.estimatedPremium.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(premium) || premium < 0) {
      throw new Error(`Invalid premium in row ${rowNumber}: ${processed.estimatedPremium}`);
    }
    processed.estimatedPremium = premium;
  } else {
    processed.estimatedPremium = 0;
  }
  
  // Set defaults
  processed.currency = processed.currency || 'AED';
  processed.status = processed.status || 'Open';
  processed.notes = processed.notes || '';
  processed.declineReason = processed.declineReason || null;
  processed.requiresPreConditionSurvey = false;
  
  return processed;
}

function createRestorationPlan(excelData, existingQuotations, options) {
  const { replaceTestData, preserveExistingIds } = options;
  
  const plan = {
    toInsert: [],
    toUpdate: [],
    toKeep: []
  };
  
  // Identify test data if replaceTestData is enabled
  const testDataPatterns = [
    /test/i, /dummy/i, /sample/i, /example/i, /demo/i,
    /^broker\s*\d+$/i, /^insured\s*\d+$/i, /^client\s*\d+$/i
  ];
  
  const isTestData = (quotation) => 
    testDataPatterns.some(pattern => 
      pattern.test(quotation.brokerName) || 
      pattern.test(quotation.insuredName)
    );
  
  // Find quotations to potentially replace
  const testQuotations = replaceTestData ? 
    existingQuotations.filter(isTestData) : [];
  
  let testQuotationIndex = 0;
  
  for (const excelRow of excelData) {
    // Check if this exact quotation already exists
    const existingMatch = existingQuotations.find(existing => 
      existing.brokerName === excelRow.brokerName &&
      existing.insuredName === excelRow.insuredName &&
      existing.marineProductType === excelRow.marineProductType &&
      Math.abs(new Date(existing.quotationDate) - excelRow.quotationDate) < 24 * 60 * 60 * 1000 // Within 1 day
    );
    
    if (existingMatch && !isTestData(existingMatch)) {
      // Real data already exists, keep it
      plan.toKeep.push(existingMatch);
    } else if (replaceTestData && testQuotationIndex < testQuotations.length) {
      // Replace test data with real data
      plan.toUpdate.push({
        id: testQuotations[testQuotationIndex].id,
        old: testQuotations[testQuotationIndex],
        new: excelRow
      });
      testQuotationIndex++;
    } else {
      // Insert as new quotation
      plan.toInsert.push(excelRow);
    }
  }
  
  return plan;
}

async function createQuotationsBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `quotations_backup_${timestamp}.json`;
  
  console.log(`💾 Creating backup: ${backupFile}`);
  
  const allQuotations = await db.select().from(quotations);
  const fs = require('fs');
  
  fs.writeFileSync(backupFile, JSON.stringify(allQuotations, null, 2));
  console.log(`✅ Backup created: ${backupFile}`);
  
  return backupFile;
}

async function executeRestorationPlan(plan) {
  // Insert new quotations
  if (plan.toInsert.length > 0) {
    console.log(`📥 Inserting ${plan.toInsert.length} new quotations...`);
    
    for (const quotation of plan.toInsert) {
      await db.insert(quotations).values({
        ...quotation,
        createdBy: 1, // Assuming admin user ID is 1
        lastUpdated: new Date()
      });
    }
  }
  
  // Update existing quotations
  if (plan.toUpdate.length > 0) {
    console.log(`🔄 Updating ${plan.toUpdate.length} quotations...`);
    
    for (const update of plan.toUpdate) {
      await db.update(quotations)
        .set({
          ...update.new,
          lastUpdated: new Date()
        })
        .where(eq(quotations.id, update.id));
    }
  }
  
  console.log('✅ Database restoration completed');
}

// Export the main function
module.exports = {
  restoreQuotationsFromExcel,
  createQuotationsBackup
};

// Example usage:
if (require.main === module) {
  console.log('📋 Quotation Restoration Tool');
  console.log('Usage: node restore-quotations.js [excel-file-path]');
  console.log('');
  
  const excelFile = process.argv[2];
  if (!excelFile) {
    console.log('❌ Please provide the Excel file path');
    console.log('Example: node restore-quotations.js ./backup.xlsx');
    process.exit(1);
  }
  
  // Run in dry run mode by default
  restoreQuotationsFromExcel(excelFile, {
    dryRun: true,
    replaceTestData: true,
    backupBeforeRestore: true
  }).then(result => {
    if (result.success) {
      console.log('\n🎉 Restoration preview completed successfully!');
      console.log('\n💡 To execute the actual restoration, modify the script to set dryRun: false');
    } else {
      console.log('\n❌ Restoration failed:', result.error);
    }
  }).catch(console.error);
} 