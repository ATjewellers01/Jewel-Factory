/**
 * Database Sync Script: AWS RDS -> Local PostgreSQL
 * 
 * Safely replicates all schema data from the remote AWS RDS instance into the
 * local PostgreSQL development database without seed mocks.
 * 
 * Run with: `pnpm run db:sync`
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const rdsUrl =
  process.env.RDS_DATABASE_URL ||
  'postgresql://jewel_factory_app:ff379ae6cfc0422594b1d812d6d463d3c3d20f49313c546e@database-1.c98u4y6sk2lz.ap-south-1.rds.amazonaws.com:5432/jewel_factory?sslmode=require';

const localUrl = process.env.DATABASE_URL || '';

if (!localUrl) {
  console.error('❌ Error: DATABASE_URL is not set in environment or .env');
  process.exit(1);
}

const srcPrisma = new PrismaClient({ datasourceUrl: rdsUrl });
const dstPrisma = new PrismaClient({ datasourceUrl: localUrl });

const BATCH_SIZE = 50;

async function syncTable(table: string) {
  process.stdout.write(`  ⏳ Syncing table "${table}"... `);

  // 1. Fetch column metadata for casting (enums, arrays, json, numeric)
  const colInfo = await dstPrisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; udt_name: string }>>(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = '${table}';
  `);

  const localColSet = new Set(colInfo.map((c) => c.column_name));
  const castMap = new Map<string, string>();

  for (const c of colInfo) {
    if (c.data_type === 'USER-DEFINED') {
      castMap.set(c.column_name, `::"${c.udt_name}"`);
    } else if (c.data_type === 'numeric') {
      castMap.set(c.column_name, `::numeric`);
    } else if (c.data_type === 'ARRAY' && c.udt_name.startsWith('_')) {
      const base = c.udt_name.slice(1);
      castMap.set(c.column_name, `::${base}[]`);
    } else if (c.data_type === 'json' || c.data_type === 'jsonb') {
      castMap.set(c.column_name, `::${c.data_type}`);
    }
  }

  // 2. Fetch rows from RDS
  let rows: any[] = [];
  try {
    if (table === 'manufacturer_product_embeddings') {
      // Cast vector(512) to text so it doesn't fail on local postgres without pgvector
      rows = await srcPrisma.$queryRawUnsafe<any[]>(`
        SELECT product_id, qdrant_point_id, embedding_model, dimensions, image_url, metadata, indexed_at, embedding::text AS embedding
        FROM "manufacturer_product_embeddings";
      `);
    } else {
      rows = await srcPrisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${table}";`);
    }
  } catch (err: any) {
    console.log(`⚠️ Skipped (${err.message})`);
    return;
  }

  if (rows.length === 0) {
    console.log(`(0 rows)`);
    return;
  }

  // 3. Filter columns to only those that exist in destination table
  const cols = Object.keys(rows[0]).filter((col) => localColSet.has(col));
  const colSql = cols.map((c) => `"${c}"`).join(', ');

  // 4. Insert into local in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const valueTuples: string[] = [];

    chunk.forEach((row) => {
      const placeholders = cols.map((col) => {
        let val = row[col];
        if (val !== null && typeof val === 'object') {
          if (val instanceof Date) {
            // Keep Date object
          } else if (Array.isArray(val)) {
            // Keep array
          } else if (typeof val.toNumber === 'function' || typeof val.d === 'object') {
            // Prisma Decimal
            val = val.toString();
          } else {
            val = JSON.stringify(val);
          }
        }
        values.push(val);
        const cast = castMap.get(col) || '';
        return `$${values.length}${cast}`;
      });
      valueTuples.push(`(${placeholders.join(', ')})`);
    });

    const insertSql = `INSERT INTO "${table}" (${colSql}) VALUES ${valueTuples.join(', ')};`;
    await dstPrisma.$executeRawUnsafe(insertSql, ...values);
  }

  console.log(`✅ (${rows.length} rows copied)`);
}

async function main() {
  console.log('====================================================');
  console.log('🔄 Jewel Factory — Database Sync (AWS RDS -> Local)');
  console.log('====================================================');
  console.log(`Source:      AWS RDS (database-1.c98u4y6sk2lz...)`);
  console.log(`Destination: Local PostgreSQL (${localUrl.replace(/:[^:@]+@/, ':***@')})`);
  console.log('----------------------------------------------------');

  const startTime = Date.now();

  // Test connections
  try {
    await srcPrisma.$queryRawUnsafe('SELECT 1;');
    console.log('✅ Connected to AWS RDS successfully.');
  } catch (err: any) {
    console.error('❌ Failed to connect to AWS RDS:', err.message);
    process.exit(1);
  }

  try {
    await dstPrisma.$queryRawUnsafe('SELECT 1;');
    console.log('✅ Connected to Local PostgreSQL successfully.');
  } catch (err: any) {
    console.error('❌ Failed to connect to Local PostgreSQL:', err.message);
    process.exit(1);
  }

  // Synchronize all enum values from RDS to local
  console.log('Checking Enum definitions from RDS...');
  try {
    const rdsEnums = await srcPrisma.$queryRawUnsafe<Array<{ typname: string; enumlabel: string }>>(`
      SELECT t.typname, e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid;
    `);

    for (const { typname, enumlabel } of rdsEnums) {
      try {
        await dstPrisma.$executeRawUnsafe(`ALTER TYPE "${typname}" ADD VALUE IF NOT EXISTS '${enumlabel}';`);
      } catch (_) {}
    }
    console.log('✅ Enums synchronized.');
  } catch (err: any) {
    console.log('⚠️ Could not sync enums:', err.message);
  }

  // Fetch all base tables in local database
  const localTables = await dstPrisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      AND table_name != '_prisma_migrations'
    ORDER BY table_name;
  `);

  const tables = localTables.map((t) => t.table_name);
  console.log(`Found ${tables.length} tables to synchronize.\n`);

  // Disable FK constraints on destination during sync
  await dstPrisma.$executeRawUnsafe("SET session_replication_role = 'replica';");

  try {
    // Truncate all tables first
    console.log('Cleaning local tables...');
    for (const table of tables) {
      await dstPrisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
    console.log('✅ Local tables cleared.\nCopying live data from AWS RDS:');

    // Sync each table
    for (const table of tables) {
      await syncTable(table);
    }

    // Preserve/ensure test retailer login (9109965802)
    console.log('\nEnsuring test login account (9109965802)...');
    const testPhone = '9109965802';
    const testPasswordHash = await bcrypt.hash(testPhone, 10);
    const mfr = await dstPrisma.manufacturer.findFirst();

    if (mfr) {
      const existingStore = await dstPrisma.store.findFirst({
        where: { ownerPhone: testPhone },
      });

      if (!existingStore) {
        const store = await dstPrisma.store.create({
          data: {
            manufacturerId: mfr.id,
            name: `AT Retailer (${testPhone})`,
            slug: `store-${testPhone}`,
            ownerPhone: testPhone,
            phone: testPhone,
            passwordHash: testPasswordHash,
            registrationStatus: 'APPROVED',
            isActive: true,
            city: 'Raipur',
            addressStreet: 'Main Road',
            addressCity: 'Raipur',
            addressState: 'Chhattisgarh',
            addressPincode: '492001',
          },
        });

        const branch = await dstPrisma.branch.create({
          data: {
            retailerId: store.id,
            name: 'Main Branch',
            phone: testPhone,
            isActive: true,
          },
        });

        await dstPrisma.branchManager.create({
          data: {
            branchId: branch.id,
            name: store.name,
            phone: testPhone,
            passwordHash: testPasswordHash,
            isActive: true,
          },
        });
        console.log(`✅ Test retailer (${testPhone}) created.`);
      } else {
        await dstPrisma.store.update({
          where: { id: existingStore.id },
          data: {
            passwordHash: testPasswordHash,
            registrationStatus: 'APPROVED',
            isActive: true,
          },
        });
        console.log(`✅ Test retailer (${testPhone}) credentials updated.`);
      }
    }
  } finally {
    // Re-enable FK constraints
    await dstPrisma.$executeRawUnsafe("SET session_replication_role = 'origin';");
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n====================================================');
  console.log(`🎉 Database sync completed successfully in ${elapsed}s!`);
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('\n❌ Sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await srcPrisma.$disconnect();
    await dstPrisma.$disconnect();
  });
