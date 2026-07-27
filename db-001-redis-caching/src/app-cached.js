import express from "express";
import pkg from "pg";
import compression from "compression";
import morgan from "morgan";
import { createClient } from "redis";

const { Pool } = pkg;
const app = express();
const PORT = process.env.CACHED_PORT || 3001;

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

redisClient.on("error", (err) => console.warn("⚠️  Redis Error:", err.message));
redisClient.on("connect", () => console.log("✅ Redis Connected"));

// Cache configuration
const CACHE_TTL = 3600; // 1 hour default TTL
const CACHE_PREFIX = "sales:";

// Cache helper functions
async function getCache(key) {
  try {
    if (!redisClient.isReady) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn("Cache get error:", error.message);
    return null;
  }
}

async function setCache(key, data, ttl = CACHE_TTL) {
  try {
    if (!redisClient.isReady) return;
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.warn("Cache set error:", error.message);
  }
}

// ============================================
// MIDDLEWARE
// ============================================

app.use(compression());
app.use(express.json());

morgan.token("cache-status", (req, res) => {
  return res.locals.cacheHit ? "🎯 CACHE_HIT" : "💾 DB_QUERY";
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
    res.json({
      status: "healthy",
      cache_enabled: true,
      cache_connected: redisClient.isReady,
      database: "connected",
      timestamp: dbResult.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

// ============================================
// CACHED ENDPOINTS
// ============================================

/**
 * GET /api/sales/cached/:year/:month
 * Cached Monthly Sales Report
 */
app.get("/api/sales/cached/:year/:month", async (req, res) => {
  const startTime = Date.now();
  const { year, month } = req.params;
  const cacheKey = `${CACHE_PREFIX}monthly:${year}:${month}`;

  try {
    // 1. Try to get from cache
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      const queryTime = Date.now() - startTime;
      res.locals.cacheHit = true;
      res.locals.queryTime = queryTime;

      return res.json({
        ...cachedData,
        metadata: {
          ...cachedData.metadata,
          cache_hit: true,
          query_time_ms: queryTime,
        },
      });
    }

    // 2. Cache miss - query from database
    res.locals.cacheHit = false;

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

    const responseData = {
      success: true,
      metadata: {
        query_type: "cached",
        cache_enabled: true,
        cache_hit: false,
        year,
        month,
        query_time_ms: queryTime,
        result_count: result.rows.length,
      },
      summary,
      daily_breakdown: result.rows,
    };

    // 3. Store in cache for future requests
    await setCache(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/sales/cached/top-products/:year/:month
 * Cached Top Products
 */
app.get("/api/sales/cached/top-products/:year/:month", async (req, res) => {
  const startTime = Date.now();
  const { year, month } = req.params;
  const cacheKey = `${CACHE_PREFIX}top-products:${year}:${month}`;

  try {
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      const queryTime = Date.now() - startTime;
      res.locals.cacheHit = true;
      res.locals.queryTime = queryTime;

      return res.json({
        ...cachedData,
        metadata: {
          ...cachedData.metadata,
          cache_hit: true,
          query_time_ms: queryTime,
        },
      });
    }

    res.locals.cacheHit = false;

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

    const responseData = {
      success: true,
      metadata: {
        query_type: "cached",
        cache_enabled: true,
        cache_hit: false,
        year,
        month,
        query_time_ms: queryTime,
      },
      top_products: result.rows,
    };

    await setCache(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/sales/cached/range
 * Cached Date Range Query
 */
app.get("/api/sales/cached/range", async (req, res) => {
  const startTime = Date.now();
  const { start_date, end_date, page = 1, limit = 100 } = req.query;
  const cacheKey = `${CACHE_PREFIX}range:${start_date}:${end_date}:${page}:${limit}`;

  if (!start_date || !end_date) {
    return res.status(400).json({
      success: false,
      error: "start_date and end_date are required",
    });
  }

  try {
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      const queryTime = Date.now() - startTime;
      res.locals.cacheHit = true;
      res.locals.queryTime = queryTime;

      return res.json({
        ...cachedData,
        metadata: {
          ...cachedData.metadata,
          cache_hit: true,
          query_time_ms: queryTime,
        },
      });
    }

    res.locals.cacheHit = false;
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

    const responseData = {
      success: true,
      metadata: {
        query_type: "cached",
        cache_enabled: true,
        cache_hit: false,
        start_date,
        end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        query_time_ms: queryTime,
      },
      data: salesResult.rows,
    };

    await setCache(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/sales/cached/stats
 * Cached Overall Statistics
 */
app.get("/api/sales/cached/stats", async (req, res) => {
  const startTime = Date.now();
  const cacheKey = `${CACHE_PREFIX}stats`;

  try {
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      const queryTime = Date.now() - startTime;
      res.locals.cacheHit = true;
      res.locals.queryTime = queryTime;

      return res.json({
        ...cachedData,
        metadata: {
          ...cachedData.metadata,
          cache_hit: true,
          query_time_ms: queryTime,
        },
      });
    }

    res.locals.cacheHit = false;

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
        SUM(quantity) as total_quantity_sold
      FROM sales
    `;

    const result = await pool.query(query);
    const queryTime = Date.now() - startTime;
    res.locals.queryTime = queryTime;

    const responseData = {
      success: true,
      metadata: {
        query_type: "cached",
        cache_enabled: true,
        cache_hit: false,
        query_time_ms: queryTime,
      },
      statistics: result.rows[0],
    };

    await setCache(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      query_time_ms: Date.now() - startTime,
    });
  }
});

/**
 * POST /api/cache/invalidate
 * Manual cache invalidation
 */
app.post("/api/cache/invalidate", async (req, res) => {
  const { key } = req.body;

  try {
    if (key) {
      await redisClient.del(`${CACHE_PREFIX}${key}`);
      res.json({ success: true, message: `Cache invalidated: ${key}` });
    } else {
      // Flush all sales cache
      const keys = await redisClient.keys(`${CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      res.json({
        success: true,
        message: `All cache invalidated (${keys.length} keys)`,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SERVER STARTUP
// ============================================

const startServer = async () => {
  try {
    await redisClient.connect();
    await pool.query("SELECT 1");

    app.listen(PORT, () => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🚀 Cached API Server Ready on port ${PORT}`);
      console.log(
        `💾 Redis Cache: ${redisClient.isReady ? "✅ Connected" : "❌ Failed"}`,
      );
      console.log(`⏱️  Cache TTL: ${CACHE_TTL}s`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    });
  } catch (error) {
    console.error("❌ Failed to start:", error.message);
    process.exit(1);
  }
};

startServer();

export default app;
