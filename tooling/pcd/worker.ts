// Worker thread body: compile one database and report back. Spawned by
// index.ts, one per database. better-sqlite3 is synchronous, so threads are
// the only way to compile databases at the same time.

import { parentPort, workerData } from 'node:worker_threads';
import { compileEntry, type CompileOptions } from './compile.js';
import type { DatabaseEntry } from './types.js';

const { entry, options } = workerData as { entry: DatabaseEntry; options: CompileOptions };

if (!parentPort) throw new Error('worker.ts must run as a worker thread');

parentPort.postMessage(compileEntry(entry, options));
