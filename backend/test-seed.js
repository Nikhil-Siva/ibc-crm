require('dotenv').config();
const { User, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function testSeed() {
  try {
    await sequelize.authenticate();
    console.log('DB Connected.');
    
    // Check if user exists
    const adminCount = await User.count({ where: { email: 'admin@insurancecrm.com' } });
    if (adminCount === 0) {
      console.log('User does not exist, creating...');
      const password_hash = await bcrypt.hash('Admin@123', 10);
      const user = await User.create({
        name: 'Admin',
        email: 'admin@insurancecrm.com',
        mobile: '9999999999',
        password_hash,
        role: 'admin',
        is_active: true,
      });
      console.log('✅ Default admin user created (admin@insurancecrm.com / Admin@123)', user.toJSON());
    } else {
      console.log('User already exists!');
      const user = await User.findOne({ where: { email: 'admin@insurancecrm.com' } });
      console.log('User details:', user.toJSON());
    }
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
  } finally {
    process.exit(0);
  }
}

testSeed();
