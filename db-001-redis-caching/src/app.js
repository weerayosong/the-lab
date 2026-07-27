// src/app.js
import express from "express";
import pkg from "pg";
import compression from "compression";
import morgan from "morgan";
import { createClient } from "redis";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE CONNECTIONS
// ============================================

// PostgreSQL Connection Pool
const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5433,
  database: process.env.PGDATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis Client
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
});

redisClient.on("error", (err) => {
  console.warn("⚠️  Redis connection error:", err.message);
});

redisClient.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.warn(
      "⚠️  Cannot connect to Redis, caching disabled:",
      error.message,
    );
  }
};

// ============================================
// MIDDLEWARE
// ============================================

app.use(compression());
app.use(express.json());

morgan.token("cache-status", (req, res) => {
  return res.locals.cacheHit ? "CACHE_HIT" : "DB_QUERY";
});

morgan.token("query-time", (req, res) => {
  return res.locals.queryTime ? `${res.locals.queryTime}ms` : "-";
});

app.use(
  morgan(":method :url :status :cache-status :query-time - :response-time ms"),
);

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", async (req, res) => {
  try {
    const dbResult = await pool.query("SELECT NOW()");
    const cacheStatus = redisClient.isReady ? "connected" : "disconnected";

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: "connected",
          timestamp: dbResult.rows[0].now,
        },
        cache: {
          status: cacheStatus,
          type: "redis",
        },
      },
      environment: {
        node_version: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: { status: "error", message: error.message },
        cache: { status: redisClient.isReady ? "connected" : "disconnected" },
      },
    });
  }
});

// ============================================
// DIRECT DATABASE ENDPOINTS (BASELINE)
// ============================================

/**
 * GET /api/sales/direct/:year/:month
 * แก้ไข: transaction_date แทน order_date
 */
app.get("/api/sales/direct/:year/:month", async (req, res) => {
  const startTime = Date.now();
  const { year, month } = req.params;
  res.locals.cacheHit = false;

  try {
    const query = `
      SELECT 
        DATE_TRUNC('day', transaction_date) as date,
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        MIN(total_amount) as min_order,
        MAX(total_amount) as max_order
      FROM sales
      WHERE EXTRACT(YEAR FROM transaction_date) = $1 
        AND EXTRACT(MONTH FROM transaction_date) = $2
      GROUP BY DATE_TRUNC('day', transaction_date)
      ORDER BY date
    `;

    const result = await pool.query(query, [year, month]);

    const summary = {
      total_orders: 0,
      total_revenue: 0,
      avg_order_value: 0,
    };

    result.rows.forEach((row) => {
      summary.total_orders += parseInt(row.total_orders);
      summary.total_revenue += parseFloat(row.total_revenue);
    });

    if (result.rows.length > 0) {
      summary.avg_order_value = summary.total_revenue / summary.total_orders;
    }

    const queryTime = Date.now() - startTime;
    res.locals.queryTime = queryTime;

    res.json({
      success: true,
      metadata: {
        query_type: "direct_db",
        cache_enabled: false,
        year,
        month,
        query_time_ms: queryTime,
        result_count: result.rows.length,
      },
      summary,
      daily_breakdown: result.rows,
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/sales/direct/top-products/:year/:month
 * แก้ไข: ใช้ product_name แทน product_id, total_amount แทน amount
 */
app.get("/api/sales/direct/top-products/:year/:month", async (req, res) => {
  const startTime = Date.now();
  const { year, month } = req.params;
  res.locals.cacheHit = false;

  try {
    const query = `
      SELECT 
        product_name,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_price,
        MIN(transaction_date) as first_order,
        MAX(transaction_date) as last_order
      FROM sales
      WHERE EXTRACT(YEAR FROM transaction_date) = $1 
        AND EXTRACT(MONTH FROM transaction_date) = $2
      GROUP BY product_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [year, month]);
    const queryTime = Date.now() - startTime;
    res.locals.queryTime = queryTime;

    res.json({
      success: true,
      metadata: {
        query_type: "direct_db",
        cache_enabled: false,
        year,
        month,
        query_time_ms: queryTime,
      },
      top_products: result.rows,
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/sales/direct/range
 * แก้ไข: transaction_date, product_name, total_amount
 */
app.get("/api/sales/direct/range", async (req, res) => {
  const startTime = Date.now();
  const { start_date, end_date, page = 1, limit = 100 } = req.query;
  res.locals.cacheHit = false;

  if (!start_date || !end_date) {
    return res.status(400).json({
      success: false,
      error: "start_date and end_date are required",
    });
  }

  try {
    const offset = (page - 1) * limit;

    const query = `
      WITH sales_data AS (
        SELECT 
          transaction_date,
          customer_id,
          region,
          category,
          product_name,
          price,
          quantity,
          total_amount,
          COUNT(*) OVER() as total_count
        FROM sales
        WHERE transaction_date BETWEEN $1 AND $2
        ORDER BY transaction_date DESC
        OFFSET $3 LIMIT $4
      )
      SELECT * FROM sales_data
    `;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM sales 
      WHERE transaction_date BETWEEN $1 AND $2
    `;

    const [salesResult, countResult] = await Promise.all([
      pool.query(query, [start_date, end_date, offset, limit]),
      pool.query(countQuery, [start_date, end_date]),
    ]);

    const queryTime = Date.now() - startTime;
    res.locals.queryTime = queryTime;

    res.json({
      success: true,
      metadata: {
        query_type: "direct_db",
        cache_enabled: false,
        start_date,
        end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        query_time_ms: queryTime,
      },
      data: salesResult.rows,
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/sales/direct/stats
 * แก้ไข: ใช้คอลัมน์ที่มีอยู่จริง
 */
app.get("/api/sales/direct/stats", async (req, res) => {
  const startTime = Date.now();
  res.locals.cacheHit = false;

  try {
    const query = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_transaction,
        MIN(transaction_date) as first_transaction,
        MAX(transaction_date) as last_transaction,
        COUNT(DISTINCT product_name) as unique_products,
        COUNT(DISTINCT customer_id) as unique_customers,
        COUNT(DISTINCT region) as total_regions,
        SUM(quantity) as total_quantity_sold,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_amount) as median_amount
      FROM sales
    `;

    const result = await pool.query(query);
    const queryTime = Date.now() - startTime;
    res.locals.queryTime = queryTime;

    res.json({
      success: true,
      metadata: {
        query_type: "direct_db",
        cache_enabled: false,
        query_time_ms: queryTime,
      },
      statistics: result.rows[0],
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    available_endpoints: [
      "GET /health",
      "GET /api/sales/direct/:year/:month",
      "GET /api/sales/direct/top-products/:year/:month",
      "GET /api/sales/direct/range?start_date=&end_date=",
      "GET /api/sales/direct/stats",
    ],
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const startServer = async () => {
  try {
    const dbTest = await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected successfully");

    await connectRedis();

    app.listen(PORT, () => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🚀 Baseline API Server Ready`);
      console.log(`📍 Port: ${PORT}`);
      console.log(
        `🗄️  Database: PostgreSQL (${process.env.PGHOST}:${process.env.PGPORT})`,
      );
      console.log(
        `💾 Cache: Redis (${redisClient.isReady ? "✅ Connected" : "⚠️  Not Connected"})`,
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 Test Endpoints:");
      console.log(`   curl http://localhost:${PORT}/health`);
      console.log(`   curl http://localhost:${PORT}/api/sales/direct/2023/6`);
      console.log(
        `   curl http://localhost:${PORT}/api/sales/direct/top-products/2023/6`,
      );
      console.log(
        `   curl "http://localhost:${PORT}/api/sales/direct/range?start_date=2023-06-01&end_date=2023-06-30"`,
      );
      console.log(`   curl http://localhost:${PORT}/api/sales/direct/stats`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`\n📥 ${signal} received. Starting graceful shutdown...`);

  try {
    if (redisClient.isReady) {
      await redisClient.quit();
      console.log("💾 Redis connection closed");
    }

    await pool.end();
    console.log("🗄️  PostgreSQL pool closed");

    console.log("👋 Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();

export default app;
