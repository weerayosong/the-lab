import pg from "pg";
import fs from "fs";
import csv from "csv-parser";

const { Client } = pg;

// ดึงค่า Config จาก Environment Variables
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

const BATCH_SIZE = 5000;

async function runSeed() {
  try {
    await client.connect();
    console.log("🛸 [System] Connected to PostgreSQL Database");

    // 1. สร้างตารางถ้ายังไม่มี
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        transaction_date TIMESTAMP,
        customer_id INT,
        region VARCHAR(50),
        category VARCHAR(50),
        product_name VARCHAR(100),
        price NUMERIC(10, 2),
        quantity INT,
        total_amount NUMERIC(12, 2)
      );
      TRUNCATE TABLE sales;`;
    await client.query(createTableQuery);
    console.log('🏗️ [System] Table "sales" is ready');

    // 2. อ่านไฟล์ CSV และทำ Batch Insert
    let batch = [];
    let totalInserted = 0;

    console.log("⏳ [Hyperdrive] Initiating data import sequences...");

    return new Promise((resolve, reject) => {
      fs.createReadStream("sales_data_1m.csv")
        .pipe(csv())
        .on("data", async (row) => {
          batch.push(row);
          if (batch.length === BATCH_SIZE) {
            // ดึงข้อมูลออกมาก่อนที่จะโดนทับ
            const currentBatch = [...batch];
            batch = [];
            totalInserted += currentBatch.length;
            await insertBatch(currentBatch);
            console.log(`🚀 [Hyperdrive] Inserted ${totalInserted} records...`);
          }
        })
        .on("end", async () => {
          // จัดการเศษที่เหลือใน Batch สุดท้าย
          if (batch.length > 0) {
            totalInserted += batch.length;
            await insertBatch(batch);
            console.log(`🚀 [Hyperdrive] Inserted ${totalInserted} records...`);
          }
          console.log(
            `✅ [Success] Data seeding complete! Total: ${totalInserted} rows.`,
          );
          await client.end();
          resolve();
        })
        .on("error", (err) => reject(err));
    });
  } catch (err) {
    console.error("❌ [Error] Seeding failed:", err);
    await client.end();
  }
}

// ฟังก์ชันย่อยสำหรับสร้างคำสั่ง SQL Insert หลายๆ แถวพร้อมกัน
async function insertBatch(records) {
  const values = [];
  const queryParams = [];

  records.forEach((row, index) => {
    const offset = index * 8;
    values.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`,
    );

    queryParams.push(
      row.transaction_date,
      row.customer_id,
      row.region,
      row.category,
      row.product_name,
      row.price,
      row.quantity,
      row.total_amount,
    );
  });

  const query = `
    INSERT INTO sales (transaction_date, customer_id, region, category, product_name, price, quantity, total_amount)
    VALUES ${values.join(", ")}
  `;

  await client.query(query, queryParams);
}

runSeed();
