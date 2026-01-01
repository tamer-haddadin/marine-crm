// Simple quotation analysis script
// This script will connect to the database and analyze existing quotation data

const { Pool } = require('pg');

// Database configuration (update these if needed)
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'marine_underwriting',
  user: 'postgres',
  password: 'postgres',
});

async function analyzeQuotations() {
  console.log('🔍 Analyzing existing quotation data...');
  
  try {
    // Get all quotations
    const result = await pool.query('SELECT * FROM quotations ORDER BY quotation_date DESC');
    const quotations = result.rows;
    
    console.log(`📊 Total quotations in database: ${quotations.length}`);
    
    // Group by date
    const dateGroups = {};
    quotations.forEach(q => {
      const dateStr = new Date(q.quotation_date).toLocaleDateString('en-GB');
      if (!dateGroups[dateStr]) dateGroups[dateStr] = [];
      dateGroups[dateStr].push(q);
    });
    
    console.log('\n📅 Quotations by date:');
    Object.keys(dateGroups).sort().forEach(date => {
      console.log(`  ${date}: ${dateGroups[date].length} quotations`);
      
      // Show sample data to identify demo vs real
      const samples = dateGroups[date].slice(0, 3);
      samples.forEach(q => {
        console.log(`    - ${q.insured_name} (${q.status}) - Premium: ${q.estimated_premium} AED`);
      });
    });
    
    // Focus on February 6, 2025 data
    const targetDate = '06/02/2025';
    const feb6Data = dateGroups[targetDate] || [];
    
    console.log(`\n🎯 Focus on ${targetDate}:`);
    if (feb6Data.length > 0) {
      console.log(`Found ${feb6Data.length} quotations on this date:`);
      feb6Data.forEach((q, index) => {
        console.log(`  ${index + 1}. ID: ${q.id} | ${q.insured_name} | ${q.status} | ${q.estimated_premium} AED`);
        console.log(`      Product: ${q.marine_product_type} | Broker: ${q.broker_name}`);
      });
      
      // Identify potential demo data
      console.log(`\n🎯 Potential demo data on ${targetDate}:`);
      const demoPatterns = [/test/i, /demo/i, /sample/i, /example/i, /abc/i, /xyz/i, /company/i, /broker/i];
      
      const potentialDemo = feb6Data.filter(q => {
        const nameCheck = demoPatterns.some(pattern => 
          pattern.test(q.insured_name) || pattern.test(q.broker_name || '')
        );
        const premiumCheck = q.estimated_premium && 
          (parseFloat(q.estimated_premium) % 1000 === 0 || parseFloat(q.estimated_premium) < 100);
        return nameCheck || premiumCheck;
      });
      
      if (potentialDemo.length > 0) {
        console.log(`Found ${potentialDemo.length} potential demo quotations:`);
        potentialDemo.forEach((q, index) => {
          console.log(`  ${index + 1}. ID: ${q.id} | ${q.insured_name} | ${q.estimated_premium} AED`);
        });
      } else {
        console.log('No obvious demo data found on this date.');
      }
      
    } else {
      console.log('No quotations found on this date.');
    }
    
    // Show your backup data that would be restored
    console.log(`\n📋 Your backup data to restore:`);
    const backupData = [
      { insured_name: "CRYSTAL SS GENERAL TRADING CO LLC", product: "Marine Open Cover", premium: "6250", status: "Open" },
      { insured_name: "ISMAIL IBRAHIM MOHAMMAD HAMAD", product: "Pleasure Boats", premium: "13800", status: "Open", notes: "PYRATE" },
      { insured_name: "QASWA LOGISTICS", product: "Haulier Liability/FFL", premium: "0", status: "Decline", decline_reason: "No risk appetite" },
      { insured_name: "ALLURE PERFUMES MANUFACTURING LLC", product: "Goods in Transit", premium: "5000", status: "Open" },
      { insured_name: "MUBARAK ESSA MUBARAK ESSA ALMANSOORI", product: "Pleasure Boats", premium: "2800", status: "Open", notes: "MUBARAK" }
    ];
    
    backupData.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.insured_name} | ${item.product} | ${item.premium} AED | ${item.status}`);
      if (item.notes) console.log(`      Notes: ${item.notes}`);
      if (item.decline_reason) console.log(`      Decline Reason: ${item.decline_reason}`);
    });
    
    console.log(`\n📝 Restoration Strategy:`);
    console.log(`1. Total backup items: ${backupData.length}`);
    console.log(`2. Existing quotations on ${targetDate}: ${feb6Data.length}`);
    console.log(`3. Potential demo data to replace: ${potentialDemo?.length || 0}`);
    
    if (potentialDemo && potentialDemo.length > 0) {
      console.log(`\n🔄 Proposed replacements:`);
      const maxReplacements = Math.min(potentialDemo.length, backupData.length);
      for (let i = 0; i < maxReplacements; i++) {
        console.log(`  Replace ID ${potentialDemo[i].id}: ${potentialDemo[i].insured_name} → ${backupData[i].insured_name}`);
      }
      
      if (backupData.length > potentialDemo.length) {
        console.log(`  Add ${backupData.length - potentialDemo.length} new quotations`);
      }
    } else {
      console.log(`\n➕ Would add all ${backupData.length} quotations as new entries`);
    }
    
    return { feb6Data, potentialDemo, backupData };
    
  } catch (error) {
    console.error('❌ Error analyzing quotations:', error);
    throw error;
  }
}

async function main() {
  console.log('🔧 Marine Underwriting Quotation Analysis');
  console.log('==========================================');
  
  try {
    await analyzeQuotations();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Analysis completed successfully!');
    console.log('💡 This was a read-only analysis - no data was modified.');
    console.log('📝 Review the restoration strategy above.');
    console.log('\n🎯 Next steps:');
    console.log('1. If the strategy looks good, we can proceed with restoration');
    console.log('2. Demo data will be safely replaced with your real data');
    console.log('3. All confirmed quotations and orders will be preserved');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    console.error('💡 Make sure the database is running and accessible');
  } finally {
    await pool.end();
  }
}

// Run the analysis
main(); 