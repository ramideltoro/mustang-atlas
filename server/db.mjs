import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
export const DEFAULT_DATA_DIR = process.env.DATA_DIR || path.resolve('data');
export function openDb({ dataDir = DEFAULT_DATA_DIR, readOnly = false } = {}) {
  if (!readOnly) fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'atlas.sqlite'), { readOnly });
  db.exec('PRAGMA busy_timeout=5000;');
  if (!readOnly) db.exec(`PRAGMA journal_mode=DELETE;
    CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,title TEXT NOT NULL,system_id TEXT NOT NULL,section_code TEXT,section_title TEXT,kind TEXT NOT NULL,engines TEXT NOT NULL,summary TEXT,source_hash TEXT NOT NULL,blocks TEXT NOT NULL,media TEXT NOT NULL,related TEXT NOT NULL,source TEXT NOT NULL,text TEXT NOT NULL,pdf_file TEXT,source_path TEXT);
    CREATE INDEX IF NOT EXISTS documents_system ON documents(system_id,kind);
    CREATE VIRTUAL TABLE IF NOT EXISTS document_search USING fts5(id UNINDEXED,title,section,text, tokenize='unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
  return db;
}
export function getMeta(db, key, fallback = null) { const row = db.prepare('SELECT value FROM metadata WHERE key=?').get(key); try { return row ? JSON.parse(row.value) : fallback; } catch { return fallback; } }
export function setMeta(db,key,value) { db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)').run(key,JSON.stringify(value)); }
export function decodeDocument(row) {
  if (!row) return null;
  return { id:row.id,title:row.title,systemId:row.system_id,section:{code:row.section_code,title:row.section_title},kind:row.kind,engines:JSON.parse(row.engines),summary:row.summary,sourceHash:row.source_hash,blocks:JSON.parse(row.blocks),media:JSON.parse(row.media),related:JSON.parse(row.related),source:JSON.parse(row.source),teachingStatus:'source' };
}
