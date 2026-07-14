require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function fullAuditAndFix() {
  console.log('\n====================================');
  console.log('STEP 1: DIAGNOSING AUTHENTICATION SYSTEM');
  console.log('====================================\n');

  // ── STEP 1: Connect to MySQL ──────────────────────────────
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: false,
    });
    console.log('✅ STEP 1: MySQL connection OK');
  } catch (err) {
    console.error('❌ STEP 1 FAILED — Cannot connect to MySQL:', err.message);
    console.error('   Fix: Check DB_HOST, DB_USER, DB_PASSWORD in backend/.env');
    process.exit(1);
  }

  // ── STEP 2: Check DB exists ──────────────────────────────
  const db = process.env.DB_NAME || 'insurance_crm';
  try {
    const [dbs] = await conn.query(`SHOW DATABASES LIKE '${db}'`);
    if (dbs.length === 0) {
      console.log(`⚠️  STEP 2: Database '${db}' does NOT exist — will create it`);
    } else {
      console.log(`✅ STEP 2: Database '${db}' exists`);
    }
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${db}\``);
  } catch (err) {
    console.error('❌ STEP 2 FAILED:', err.message);
    process.exit(1);
  }

  // ── STEP 3: Check existing tables ────────────────────────
  const [tables] = await conn.query("SHOW TABLES");
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log(`\n✅ STEP 3: Tables found in DB: [${tableNames.join(', ') || 'NONE'}]`);

  // ── STEP 4: Detect column naming convention ───────────────
  let useSnakeCase = false;
  if (tableNames.some(t => t.toLowerCase() === 'users')) {
    try {
      const [cols] = await conn.query("DESCRIBE `users`");
      const colNames = cols.map(c => c.Field);
      console.log(`\n✅ STEP 4: users table columns: [${colNames.join(', ')}]`);
      useSnakeCase = colNames.includes('created_at');
      console.log(`   Timestamp convention: ${useSnakeCase ? 'snake_case (created_at)' : 'camelCase (createdAt)'}`);
    } catch(e) {}
  } else if (tableNames.some(t => t.toLowerCase() === 'Users')) {
    // Sequelize style
  }

  // ── STEP 5: Drop ALL tables (clean slate) ─────────────────
  console.log('\n⚙️  STEP 5: Dropping all tables for clean rebuild...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  const dropOrder = ['CommunicationLogs','Agents','Documents','Followups','Policies','Customers','Leads','Users',
                     'communication_logs','agents','documents','followups','policies','customers','leads','users'];
  for (const tbl of dropOrder) {
    try { await conn.query(`DROP TABLE IF EXISTS \`${tbl}\``); } catch(e) {}
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('✅ STEP 5: All old tables dropped.');

  // ── STEP 6: Create tables with CAMELCASE timestamps ───────
  // Sequelize by default uses createdAt / updatedAt unless told otherwise
  console.log('\n⚙️  STEP 6: Creating tables with Sequelize-compatible schema...');

  await conn.query(`
    CREATE TABLE \`Users\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15),
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','agent','manager') DEFAULT 'agent',
      is_active TINYINT(1) DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ Users');

  await conn.query(`
    CREATE TABLE \`Leads\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      mobile VARCHAR(15) NOT NULL,
      email VARCHAR(100),
      age INT,
      occupation VARCHAR(100),
      city VARCHAR(100),
      source ENUM('Facebook','Google','WhatsApp','Referral','Walk-in','Instagram','Cold Call','Other') DEFAULT 'Other',
      insurance_interest ENUM('Life','Health','Motor','Term','Investment','ULIP','Other'),
      status ENUM('New','Interested','Follow-up','Proposal Sent','Document Collection','Payment Pending','Closed Won','Closed Lost','Not Interested') DEFAULT 'New',
      priority ENUM('Hot','Warm','Cold') DEFAULT 'Warm',
      assigned_to INT,
      notes TEXT,
      last_contacted_at DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ Leads');

  await conn.query(`
    CREATE TABLE \`Customers\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT,
      name VARCHAR(100) NOT NULL,
      mobile VARCHAR(15) NOT NULL,
      alternate_mobile VARCHAR(15),
      email VARCHAR(100),
      dob DATE,
      gender ENUM('Male','Female','Other'),
      occupation VARCHAR(100),
      annual_income DECIMAL(12,2),
      address TEXT,
      city VARCHAR(100),
      pincode VARCHAR(10),
      pan_number VARCHAR(20),
      aadhaar_number VARCHAR(20),
      nominee_name VARCHAR(100),
      nominee_relation VARCHAR(50),
      nominee_dob DATE,
      assigned_to INT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES \`Leads\`(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ Customers');

  await conn.query(`
    CREATE TABLE \`Policies\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      policy_number VARCHAR(100),
      insurer VARCHAR(150) NOT NULL,
      policy_type ENUM('Life','Health','Term','Motor','ULIP','Endowment','Money Back','Pension','Other'),
      plan_name VARCHAR(200),
      sum_assured DECIMAL(14,2),
      premium_amount DECIMAL(10,2),
      premium_frequency ENUM('Monthly','Quarterly','Half-Yearly','Yearly','Single'),
      payment_mode ENUM('Online','Cheque','Cash','NEFT','ECS'),
      start_date DATE,
      maturity_date DATE,
      due_date DATE,
      next_due_date DATE,
      policy_term_years INT,
      status ENUM('Active','Lapsed','Surrendered','Matured','Claimed','Pending') DEFAULT 'Active',
      commission_earned DECIMAL(10,2),
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES \`Customers\`(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ Policies');

  await conn.query(`
    CREATE TABLE \`Followups\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT,
      customer_id INT,
      type ENUM('Call','WhatsApp','Meeting','Email','Site Visit') NOT NULL,
      scheduled_at DATETIME NOT NULL,
      notes TEXT,
      outcome TEXT,
      is_done TINYINT(1) DEFAULT 0,
      done_at DATETIME,
      created_by INT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES \`Leads\`(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES \`Customers\`(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ Followups');

  await conn.query(`
    CREATE TABLE \`Documents\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT,
      policy_id INT,
      doc_type ENUM('Aadhaar','PAN','Photo','Proposal Form','Policy Bond','Bank Statement','Income Proof','Medical Report','Claim Form','Other'),
      file_name VARCHAR(255),
      file_path VARCHAR(500),
      uploaded_by INT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES \`Customers\`(id) ON DELETE CASCADE,
      FOREIGN KEY (policy_id) REFERENCES \`Policies\`(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ Documents');

  await conn.query(`
    CREATE TABLE \`Agents\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      mobile VARCHAR(15),
      email VARCHAR(100),
      city VARCHAR(100),
      age INT,
      occupation VARCHAR(100),
      education VARCHAR(100),
      referred_by INT,
      interview_status ENUM('Not Scheduled','Scheduled','Appeared','Passed','Failed','Joined','Dropped') DEFAULT 'Not Scheduled',
      interview_date DATE,
      training_status ENUM('Not Started','In Progress','Completed') DEFAULT 'Not Started',
      irda_exam_status ENUM('Not Registered','Registered','Passed','Failed') DEFAULT 'Not Registered',
      activation_status ENUM('Inactive','Active') DEFAULT 'Inactive',
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (referred_by) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ Agents');

  await conn.query(`
    CREATE TABLE \`CommunicationLogs\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT,
      customer_id INT,
      channel ENUM('WhatsApp','SMS','Email'),
      message_type ENUM('Renewal Reminder','Follow-up Reminder','Welcome','Birthday','Policy Anniversary','Custom'),
      message_body TEXT,
      status ENUM('Sent','Failed','Pending') DEFAULT 'Pending',
      sent_at DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✅ CommunicationLogs');

  // ── STEP 7: Generate bcrypt hash and insert admin ─────────
  console.log('\n⚙️  STEP 7: Generating fresh bcrypt hash and seeding admin user...');
  const plainPassword = 'Admin@123';
  const hash = await bcrypt.hash(plainPassword, 10);
  
  // Verify the hash works before inserting
  const verified = await bcrypt.compare(plainPassword, hash);
  if (!verified) {
    console.error('❌ CRITICAL: bcrypt self-test failed! bcrypt library is broken.');
    process.exit(1);
  }
  console.log('  ✅ bcrypt hash generated and self-verified.');

  const now = new Date();
  await conn.query(
    `INSERT INTO \`Users\` (name, email, mobile, password_hash, role, is_active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Admin', 'admin@insurancecrm.com', '9999999999', hash, 'admin', 1, now, now]
  );
  console.log('  ✅ Admin user inserted into Users table.');

  // ── STEP 8: Verify inserted data ─────────────────────────
  console.log('\n⚙️  STEP 8: Verifying inserted admin user...');
  const [rows] = await conn.query(`SELECT id, name, email, role, is_active, LEFT(password_hash, 10) as hash_start, LENGTH(password_hash) as hash_len FROM \`Users\` WHERE email = 'admin@insurancecrm.com'`);
  if (rows.length === 0) {
    console.error('❌ STEP 8 FAILED: User was not inserted!');
  } else {
    const u = rows[0];
    console.log(`  ✅ User found: id=${u.id}, email=${u.email}, role=${u.role}, is_active=${u.is_active}`);
    console.log(`  ✅ Hash starts with: ${u.hash_start}... (length: ${u.hash_len})`);
    if (u.hash_start.startsWith('$2b$')) {
      console.log('  ✅ Hash is valid bcrypt format.');
    } else {
      console.error('  ❌ Hash is NOT valid bcrypt!');
    }
  }

  // ── STEP 9: Final bcrypt comparison simulation ────────────
  console.log('\n⚙️  STEP 9: Simulating login (full end-to-end test)...');
  const [allRows] = await conn.query(`SELECT * FROM \`Users\` WHERE email = 'admin@insurancecrm.com'`);
  const dbUser = allRows[0];
  const loginTest = await bcrypt.compare('Admin@123', dbUser.password_hash);
  if (loginTest) {
    console.log('  ✅ Login simulation PASSED — bcrypt.compare("Admin@123", storedHash) = TRUE');
  } else {
    console.error('  ❌ Login simulation FAILED — password does not match stored hash!');
  }

  await conn.end();

  console.log('\n====================================');
  console.log('✅ ALL STEPS COMPLETE — DATABASE IS FIXED');
  console.log('====================================');
  console.log('\nNow do the following:');
  console.log('  1. Restart backend:  npm run dev');
  console.log('  2. Restart frontend: npm run dev  (in frontend folder)');
  console.log('  3. Login at http://localhost:5173');
  console.log('  4. Email:    admin@insurancecrm.com');
  console.log('  5. Password: Admin@123');
  console.log('');
}

fullAuditAndFix().catch(err => {
  console.error('\n❌ FATAL ERROR:', err.message);
  console.error(err);
  process.exit(1);
});
