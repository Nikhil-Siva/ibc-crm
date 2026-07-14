-- ============================================================
-- Insurance CRM Database Schema
-- Company: Invic Business Corp LLP
-- Created: 2026-05-29
-- ============================================================

CREATE DATABASE IF NOT EXISTS insurance_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE insurance_crm;

-- ============================================================
-- USERS (CRM login accounts for agents and admins)
-- ============================================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  mobile VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'agent', 'manager') DEFAULT 'agent',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- LEADS (all new enquiries before conversion)
-- ============================================================
CREATE TABLE leads (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- CUSTOMERS (converted leads — confirmed clients)
-- ============================================================
CREATE TABLE customers (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- POLICIES (one customer can have multiple policies)
-- ============================================================
CREATE TABLE policies (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================
-- FOLLOWUPS (tasks/reminders for leads and customers)
-- ============================================================
CREATE TABLE followups (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- DOCUMENTS (uploaded files for customers/policies)
-- ============================================================
CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  policy_id INT,
  doc_type ENUM('Aadhaar','PAN','Photo','Proposal Form','Policy Bond','Bank Statement','Income Proof','Medical Report','Claim Form','Other'),
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- AGENTS (recruitment tracking — candidates to become agents)
-- ============================================================
CREATE TABLE agents (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- COMMUNICATION LOG (every WhatsApp/SMS/Email sent)
-- ============================================================
CREATE TABLE communication_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT,
  customer_id INT,
  channel ENUM('WhatsApp','SMS','Email'),
  message_type ENUM('Renewal Reminder','Follow-up Reminder','Welcome','Birthday','Policy Anniversary','Custom'),
  message_body TEXT,
  status ENUM('Sent','Failed','Pending') DEFAULT 'Pending',
  sent_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DEFAULT ADMIN USER
-- Password: Admin@123 (bcrypt hash will be generated by backend seed)
-- ============================================================
-- Note: The backend server will auto-seed the admin user on first run
-- if no admin exists. This ensures the password hash is generated fresh.
