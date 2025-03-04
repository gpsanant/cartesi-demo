import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function bench_sql() {
    const start = process.hrtime.bigint();
    const dbPath = path.join(os.tmpdir(), 'sql_benchmark.db');
    
    // Initialize database
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Test 1: Create complex schema
    const schemaStart = process.hrtime.bigint();
    await createSchema(db);
    const schemaEnd = process.hrtime.bigint();
    console.log(`Schema creation time: ${(schemaEnd - schemaStart)} nanoseconds`);

    // Test 2: Insert test data
    const insertStart = process.hrtime.bigint();
    await insertTestData(db);
    const insertEnd = process.hrtime.bigint();
    console.log(`Data insertion time: ${(insertEnd - insertStart)} nanoseconds`);

    // Test 3: Complex JOIN query with window functions
    const joinStart = process.hrtime.bigint();
    const joinResult = await db.all(`
        WITH RankedOrders AS (
            SELECT 
                o.order_id,
                o.customer_id,
                o.order_date,
                o.total_amount,
                ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.total_amount DESC) as rank
            FROM orders o
        )
        SELECT 
            c.name,
            c.email,
            ro.order_id,
            ro.total_amount,
            ro.rank,
            GROUP_CONCAT(p.name) as products
        FROM customers c
        JOIN RankedOrders ro ON c.customer_id = ro.customer_id
        JOIN order_items oi ON ro.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.product_id
        WHERE ro.rank <= 3
        GROUP BY c.customer_id, ro.order_id
        ORDER BY c.customer_id, ro.rank
    `);
    const joinEnd = process.hrtime.bigint();
    console.log(`Complex JOIN query time: ${(joinEnd - joinStart)} nanoseconds`);

    // Test 4: Recursive CTE query
    const cteStart = process.hrtime.bigint();
    const cteResult = await db.all(`
        WITH RECURSIVE category_tree AS (
            SELECT 
                category_id,
                name,
                parent_id,
                1 as level
            FROM categories
            WHERE parent_id IS NULL
            
            UNION ALL
            
            SELECT 
                c.category_id,
                c.name,
                c.parent_id,
                ct.level + 1
            FROM categories c
            JOIN category_tree ct ON c.parent_id = ct.category_id
        )
        SELECT * FROM category_tree
        ORDER BY level, category_id
    `);
    const cteEnd = process.hrtime.bigint();
    console.log(`Recursive CTE query time: ${(cteEnd - cteStart)} nanoseconds`);

    // Test 5: Complex aggregation with subqueries
    const aggStart = process.hrtime.bigint();
    const aggResult = await db.all(`
        SELECT 
            c.name,
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(o.total_amount) as total_spent,
            (
                SELECT AVG(total_amount)
                FROM orders o2
                WHERE o2.customer_id = c.customer_id
            ) as avg_order_value,
            (
                SELECT COUNT(*)
                FROM order_items oi
                JOIN orders o3 ON oi.order_id = o3.order_id
                WHERE o3.customer_id = c.customer_id
            ) as total_items
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        GROUP BY c.customer_id
        HAVING total_orders > 0
        ORDER BY total_spent DESC
    `);
    const aggEnd = process.hrtime.bigint();
    console.log(`Complex aggregation time: ${(aggEnd - aggStart)} nanoseconds`);

    // Test 6: Full-text search
    const searchStart = process.hrtime.bigint();
    const searchResult = await db.all(`
        SELECT 
            p.product_id,
            p.name,
            p.description,
            p.price,
            c.name as category_name
        FROM products p
        JOIN categories c ON p.category_id = c.category_id
        WHERE p.description LIKE '%premium%'
        OR p.description LIKE '%exclusive%'
        ORDER BY p.price DESC
    `);
    const searchEnd = process.hrtime.bigint();
    console.log(`Full-text search time: ${(searchEnd - searchStart)} nanoseconds`);

    // Cleanup
    await db.close();
    fs.unlinkSync(dbPath);

    const end = process.hrtime.bigint();
    console.log(`Total SQL benchmark time: ${(end - start)} nanoseconds`);
}

async function createSchema(db) {
    // Drop tables if they exist (in reverse order of dependencies)
    await db.exec(`
        DROP TABLE IF EXISTS order_items;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS products;
        DROP TABLE IF EXISTS categories;
        DROP TABLE IF EXISTS customers;
    `);

    // Create tables
    await db.exec(`
        CREATE TABLE customers (
            customer_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE categories (
            category_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id INTEGER,
            FOREIGN KEY (parent_id) REFERENCES categories(category_id)
        );

        CREATE TABLE products (
            product_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            category_id INTEGER,
            FOREIGN KEY (category_id) REFERENCES categories(category_id)
        );

        CREATE TABLE orders (
            order_id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_amount DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        );

        CREATE TABLE order_items (
            order_item_id INTEGER PRIMARY KEY,
            order_id INTEGER,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(order_id),
            FOREIGN KEY (product_id) REFERENCES products(product_id)
        );
    `);
}

async function insertTestData(db) {
    // Insert customers
    await db.exec(`
        INSERT INTO customers (name, email) VALUES
        ('John Doe', 'john@example.com'),
        ('Jane Smith', 'jane@example.com'),
        ('Bob Johnson', 'bob@example.com')
    `);

    // Insert categories
    await db.exec(`
        INSERT INTO categories (name, parent_id) VALUES
        ('Electronics', NULL),
        ('Computers', 1),
        ('Smartphones', 1),
        ('Clothing', NULL),
        ('Men', 4),
        ('Women', 4)
    `);

    // Insert products
    await db.exec(`
        INSERT INTO products (name, description, price, category_id) VALUES
        ('Premium Laptop', 'High-end laptop with premium features', 1299.99, 2),
        ('Smartphone Pro', 'Latest smartphone with exclusive features', 999.99, 3),
        ('Classic T-Shirt', 'Comfortable cotton t-shirt', 29.99, 5),
        ('Designer Dress', 'Elegant designer dress', 199.99, 6)
    `);

    // Insert orders and order items
    await db.exec(`
        INSERT INTO orders (customer_id, total_amount) VALUES
        (1, 1329.98),
        (1, 229.98),
        (2, 999.99),
        (3, 199.99);

        INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
        (1, 1, 1, 1299.99),
        (1, 3, 1, 29.99),
        (2, 3, 2, 29.99),
        (3, 2, 1, 999.99),
        (4, 4, 1, 199.99)
    `);
}