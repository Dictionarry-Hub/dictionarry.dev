import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileNumber } from './ops.js';

/** In-memory database with the schema ops applied and no entity content. */
export function createDatabase(schemaOpsDir: string): Database.Database {
	const db = new Database(':memory:');
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	executeOpsInOrder(db, schemaOpsDir);

	return db;
}

export function compileDatabase(schemaOpsDir: string, baseOpsDir: string): Database.Database {
	const db = createDatabase(schemaOpsDir);
	executeOpsInOrder(db, baseOpsDir);
	return db;
}

export function executeOpsInOrder(db: Database.Database, opsDir: string): void {
	const files = readdirSync(opsDir)
		.filter((f) => f.endsWith('.sql'))
		.sort((a, b) => fileNumber(a) - fileNumber(b));

	for (const file of files) {
		const sql = readFileSync(join(opsDir, file), 'utf-8');
		db.exec(sql);
	}
}
