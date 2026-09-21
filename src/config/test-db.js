const pool = require('./database');

async function testConnection() {
    try {
        const connection = await pool.getConnection();

        console.log('✅ Kết nối MySQL thành công!');

        connection.release();
        process.exit(0);
    } catch (error) {
        console.error('❌ Kết nối MySQL thất bại!');
        console.error(error.message);
        process.exit(1);
    }
}

testConnection();