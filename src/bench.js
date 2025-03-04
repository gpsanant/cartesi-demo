const fs = require('fs');
const os = require('os');
const path = require('path');
const { bench_sql } = require('./sql_bench.js');

async function bench() {
    bench_simple();
    await bench_sql();
}

module.exports = { bench };

function bench_simple() {
    const start = process.hrtime.bigint();

    // Code to benchmark
    for (let i = 0; i < 1e6; i++) {
        Math.sqrt(i);
    }

    const end = process.hrtime.bigint();
    console.log(`Square root execution time: ${(end - start)} nanoseconds`);

    // test disk io
    const testData = 'x'.repeat(1024 * 1024); // 1MB of data
    const testFile = path.join(os.tmpdir(), 'benchmark_test.txt');

    // Write benchmark
    const writeStart = process.hrtime.bigint();
    fs.writeFileSync(testFile, testData);
    const writeEnd = process.hrtime.bigint();
    console.log(`Write execution time: ${(writeEnd - writeStart)} nanoseconds`);

    // Read benchmark
    const readStart = process.hrtime.bigint();
    const readData = fs.readFileSync(testFile, 'utf8');
    const readEnd = process.hrtime.bigint();
    console.log(`Read execution time: ${(readEnd - readStart)} nanoseconds`);

    // Cleanup
    fs.unlinkSync(testFile);
}

bench().catch(console.error);
