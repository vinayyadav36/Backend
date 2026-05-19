#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const DATA_DIR = path.resolve(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getAllCollections() {
  ensureDir(DATA_DIR);
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .map(f => f.replace(/\.json$/, ''));
}

function printUsage() {
  console.log(`
Jarvis DB Control (dbctl) — CLI for JSON NoSQL management

Usage:
  dbctl backup --out=<file.tar.gz>     Create full backup of all JSON collections
  dbctl restore --in=<file.tar.gz>     Restore from backup (WARNING: overwrites current data)
  dbctl migrate --dry-run              Preview migration without applying
  dbctl migrate --apply                Apply data migration transformations
  dbctl import --file=<data.json>      Import bulk data from JSON file
  dbctl compact --collection=<name>    Compact a collection (remove soft-deleted docs)
  dbctl audit --from=ISO --to=ISO      Query audit trail for a time range
  dbctl list                           List all collections with document counts
  dbctl stats                          Show storage statistics

Options:
  --help                               Show this help
`);
}

async function cmdBackup(outPath) {
  ensureDir(BACKUP_DIR);
  const collections = getAllCollections();
  if (collections.length === 0) {
    console.log('No collections found in', DATA_DIR);
    return;
  }

  const archive = {};
  for (const col of collections) {
    const fp = path.join(DATA_DIR, `${col}.json`);
    archive[col] = JSON.parse(fs.readFileSync(fp, 'utf8'));
    console.log(`  Packed: ${col}.json (${archive[col].length} documents)`);
  }

  const outFile = outPath || path.join(BACKUP_DIR, `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`);
  const json = JSON.stringify(archive);
  const compressed = zlib.gzipSync(json);
  fs.writeFileSync(outFile, compressed);
  console.log(`\nBackup saved to: ${outFile}`);
  console.log(`Size: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
}

async function cmdRestore(inPath) {
  if (!inPath || !fs.existsSync(inPath)) {
    console.error('Error: Backup file not found:', inPath);
    return;
  }

  const compressed = fs.readFileSync(inPath);
  const json = zlib.gunzipSync(compressed).toString();
  const archive = JSON.parse(json);

  ensureDir(DATA_DIR);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(`This will overwrite ${Object.keys(archive).length} collections. Continue? (y/N) `, (answer) => {
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      console.log('Restore cancelled.');
      return;
    }

    for (const [col, docs] of Object.entries(archive)) {
      fs.writeFileSync(path.join(DATA_DIR, `${col}.json`), JSON.stringify(docs, null, 2), 'utf8');
      console.log(`  Restored: ${col}.json (${docs.length} documents)`);
    }
    console.log('\nRestore complete.');
  });
}

async function cmdMigrateDryRun() {
  console.log('Migration Dry Run Report\n');
  const collections = getAllCollections();
  for (const col of collections) {
    const fp = path.join(DATA_DIR, `${col}.json`);
    const docs = JSON.parse(fs.readFileSync(fp, 'utf8'));
    console.log(`  ${col}: ${docs.length} documents`);
    if (docs.length > 0) {
      const sampleKeys = Object.keys(docs[0]);
      console.log(`    Fields: ${sampleKeys.join(', ')}`);
      const hasTimestamps = docs[0].createdAt || docs[0].created_at;
      console.log(`    Has timestamps: ${!!hasTimestamps}`);
      const hasId = docs[0]._id || docs[0].id;
      console.log(`    Has identifier: ${!!hasId}`);
    }
    if (col === 'audit_logs') {
      const uniqueActors = new Set(docs.map(d => d.userId || d.actor_id).filter(Boolean));
      console.log(`    Unique actors: ${uniqueActors.size}`);
    }
  }
  console.log(`\nTotal collections: ${collections.length}`);
  console.log('No changes applied. Run with --apply to execute migrations.');
}

async function cmdMigrateApply() {
  console.log('Applying data migrations...\n');
  const collections = getAllCollections();

  for (const col of collections) {
    const fp = path.join(DATA_DIR, `${col}.json`);
    let docs = JSON.parse(fs.readFileSync(fp, 'utf8'));
    let changed = 0;

    docs = docs.map(doc => {
      const out = Object.assign({}, doc);

      // Ensure _id exists
      if (!out._id && out.id) {
        out._id = out.id;
        changed++;
      }
      if (!out._id) {
        const crypto = require('crypto');
        out._id = crypto.randomBytes(12).toString('hex');
        changed++;
      }

      // Ensure timestamps
      if (!out.createdAt && !out.created_at) {
        out.createdAt = new Date().toISOString();
        changed++;
      } else if (!out.createdAt && out.created_at) {
        out.createdAt = out.created_at;
        changed++;
      }
      if (!out.updatedAt && !out.updated_at) {
        out.updatedAt = new Date().toISOString();
        changed++;
      } else if (!out.updatedAt && out.updated_at) {
        out.updatedAt = out.updated_at;
        changed++;
      }

      return out;
    });

    if (changed > 0) {
      fs.writeFileSync(fp, JSON.stringify(docs, null, 2), 'utf8');
      console.log(`  ${col}: ${changed} documents migrated`);
    } else {
      console.log(`  ${col}: No changes needed`);
    }
  }

  console.log('\nMigration complete.');
}

async function cmdImport(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('Error: File not found:', filePath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  ensureDir(DATA_DIR);

  if (Array.isArray(data)) {
    const col = path.basename(filePath, '.json').replace(/^import_?/, '');
    const fp = path.join(DATA_DIR, `${col}.json`);
    const existing = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
    const merged = [...existing, ...data];
    fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`Imported ${data.length} documents into ${col}.json (total: ${merged.length})`);
  } else if (typeof data === 'object') {
    for (const [col, docs] of Object.entries(data)) {
      if (!Array.isArray(docs)) continue;
      const fp = path.join(DATA_DIR, `${col}.json`);
      const existing = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
      const merged = [...existing, ...docs];
      fs.writeFileSync(fp, JSON.stringify(merged, null, 2), 'utf8');
      console.log(`Imported ${docs.length} documents into ${col}.json (total: ${merged.length})`);
    }
  }
}

async function cmdCompact(collection) {
  if (!collection) {
    console.error('Error: Specify --collection=<name>');
    return;
  }

  const fp = path.join(DATA_DIR, `${collection}.json`);
  if (!fs.existsSync(fp)) {
    console.error(`Error: Collection ${collection} not found`);
    return;
  }

  const docs = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const before = docs.length;

  // Remove soft-deleted documents and compact
  const compacted = docs.filter(d => d.status !== 'deleted' && d.isActive !== false);
  const removed = before - compacted.length;

  fs.writeFileSync(fp, JSON.stringify(compacted, null, 2), 'utf8');
  console.log(`Compacted ${collection}: ${before} → ${compacted.length} documents (removed ${removed})`);
}

async function cmdAudit(from, to) {
  const fp = path.join(DATA_DIR, 'audit_logs.json');
  if (!fs.existsSync(fp)) {
    console.log('No audit logs found.');
    return;
  }

  const logs = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(to) : new Date();

  const filtered = logs.filter(log => {
    const ts = new Date(log.timestamp || log.createdAt);
    return ts >= fromDate && ts <= toDate;
  });

  console.log(`Audit entries from ${fromDate.toISOString()} to ${toDate.toISOString()}:`);
  console.log(`Total: ${filtered.length}`);
  console.log('');

  if (filtered.length > 0) {
    console.log('Recent entries:');
    filtered.slice(-10).reverse().forEach(log => {
      console.log(`  [${log.timestamp}] ${log.action} by ${log.userId} — ${log.statusCode}`);
    });
  }
}

async function cmdList() {
  const collections = getAllCollections();
  let totalDocs = 0;
  let totalSize = 0;

  console.log('Collections:\n');
  for (const col of collections) {
    const fp = path.join(DATA_DIR, `${col}.json`);
    const stats = fs.statSync(fp);
    const docs = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const sizeKB = (stats.size / 1024).toFixed(1);
    totalDocs += docs.length;
    totalSize += stats.size;
    console.log(`  ${col.padEnd(25)} ${String(docs.length).padStart(6)} docs  ${sizeKB.padStart(8)} KB`);
  }

  console.log(`\n  ${'─'.repeat(45)}`);
  console.log(`  ${'TOTAL'.padEnd(25)} ${String(totalDocs).padStart(6)} docs  ${(totalSize / 1024).toFixed(1).padStart(8)} KB`);
}

async function cmdStats() {
  const collections = getAllCollections();
  let totalSize = 0;

  console.log('Storage Statistics:\n');

  for (const col of collections) {
    const fp = path.join(DATA_DIR, `${col}.json`);
    const stats = fs.statSync(fp);
    const docs = JSON.parse(fs.readFileSync(fp, 'utf8'));
    totalSize += stats.size;

    const avgDocSize = docs.length > 0 ? (stats.size / docs.length) : 0;

    console.log(`  ${col}:`);
    console.log(`    Documents: ${docs.length}`);
    console.log(`    File size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`    Avg doc:   ${avgDocSize.toFixed(0)} bytes`);
  }

  console.log(`\n  Total data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    printUsage();
    return;
  }

  const cmd = args[0];

  const getArg = (prefix) => {
    const arg = args.find(a => a.startsWith(prefix));
    return arg ? arg.split('=')[1] : null;
  };

  switch (cmd) {
    case 'backup':
      await cmdBackup(getArg('--out'));
      break;
    case 'restore':
      await cmdRestore(getArg('--in'));
      break;
    case 'migrate':
      if (args.includes('--dry-run')) await cmdMigrateDryRun();
      else if (args.includes('--apply')) await cmdMigrateApply();
      else console.error('Specify --dry-run or --apply');
      break;
    case 'import':
      await cmdImport(getArg('--file'));
      break;
    case 'compact':
      await cmdCompact(getArg('--collection'));
      break;
    case 'audit':
      await cmdAudit(getArg('--from'), getArg('--to'));
      break;
    case 'list':
      await cmdList();
      break;
    case 'stats':
      await cmdStats();
      break;
    default:
      console.error('Unknown command:', cmd);
      printUsage();
  }
}

main().catch(console.error);
