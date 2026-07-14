require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function setup() {
  console.log('🔧 Starting database setup...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL server.');

  const db = process.env.DB_NAME || 'insurance_crm';

  // 1. Drop old database and recreate fresh
  await connection.query(`DROP DATABASE IF EXISTS \`${db}\`;`);
  await connection.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${db}\`;`);
  console.log('✅ Fresh database created.');

  // 2. Create all tables with Sequelize-compatible column names (createdAt / updatedAt)
  await connection.query(`
    CREATE TABLE \`Users\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15),
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'agent', 'manager') DEFAULT 'agent',
      is_active TINYINT(1) DEFAULT 1,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Users table created.');

  await connection.query(`
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
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      FOREIGN KEY (assigned_to) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Leads table created.');

  await connection.query(`
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
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES \`Leads\`(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Customers table created.');

  await connection.query(`
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
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES \`Customers\`(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Policies table created.');

  await connection.query(`
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
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES \`Leads\`(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES \`Customers\`(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Followups table created.');

  await connection.query(`
    CREATE TABLE \`Documents\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT,
      policy_id INT,
      doc_type ENUM('Aadhaar','PAN','Photo','Proposal Form','Policy Bond','Bank Statement','Income Proof','Medical Report','Claim Form','Other'),
      file_name VARCHAR(255),
      file_path VARCHAR(500),
      uploaded_by INT,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES \`Customers\`(id) ON DELETE CASCADE,
      FOREIGN KEY (policy_id) REFERENCES \`Policies\`(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Documents table created.');

  await connection.query(`
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
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      FOREIGN KEY (referred_by) REFERENCES \`Users\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Agents table created.');

  await connection.query(`
    CREATE TABLE \`CommunicationLogs\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT,
      customer_id INT,
      channel ENUM('WhatsApp','SMS','Email'),
      message_type ENUM('Renewal Reminder','Follow-up Reminder','Welcome','Birthday','Policy Anniversary','Custom'),
      message_body TEXT,
      status ENUM('Sent','Failed','Pending') DEFAULT 'Pending',
      sent_at DATETIME,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ CommunicationLogs table created.');

  // 3. Seed admin user directly with bcrypt hash
  const password_hash = await bcrypt.hash('Admin@123', 10);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await connection.query(
    `INSERT INTO \`Users\` (name, email, mobile, password_hash, role, is_active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Admin', 'admin@insurancecrm.com', '9999999999', password_hash, 'admin', 1, now, now]
  );
  console.log('✅ Admin user created.');

  await connection.end();

  console.log('\n🎉 ===== SETUP COMPLETE =====');
  console.log('Now run: npm run dev');
  console.log('Then login at http://localhost:5173 with:');
  console.log('  📧 Email:    admin@insurancecrm.com');
  console.log('  🔑 Password: Admin@123');
  console.log('============================\n');
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
