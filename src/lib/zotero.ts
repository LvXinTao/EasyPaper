import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ZoteroCollection } from '@/types';

interface ZoteroSettings {
  zoteroDataDir?: string;
  [key: string]: string | undefined;
}

/**
 * Resolves the Zotero database path from settings.
 * @param settings - Settings object with optional zoteroDataDir
 * @returns Full path to zotero.sqlite
 */
export function getZoteroDbPath(settings: ZoteroSettings): string {
  const zoteroDir = settings.zoteroDataDir
    ? settings.zoteroDataDir.replace(/^~/, os.homedir())
    : path.join(os.homedir(), 'Zotero');
  return path.join(zoteroDir, 'zotero.sqlite');
}

/**
 * Opens a read-only connection to the Zotero database.
 */
function openDb(dbPath: string): Database.Database {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Zotero database not found at ${dbPath}`);
  }
  return new Database(dbPath, { readonly: true });
}

/**
 * Builds a tree structure from flat collection rows.
 */
function buildCollectionTree(
  rows: Array<{ collectionID: number; collectionName: string; parentCollectionID: number | null }>
): ZoteroCollection[] {
  const map = new Map<number | null, ZoteroCollection[]>();
  const allCollections: ZoteroCollection[] = [];

  // First pass: create all collections
  for (const row of rows) {
    const collection: ZoteroCollection = {
      id: row.collectionID,
      name: row.collectionName,
      parentId: row.parentCollectionID,
      children: [],
    };
    allCollections.push(collection);
    if (!map.has(row.parentCollectionID)) {
      map.set(row.parentCollectionID, []);
    }
    map.get(row.parentCollectionID)!.push(collection);
  }

  // Second pass: build tree
  const rootCollections: ZoteroCollection[] = [];
  for (const collection of allCollections) {
    const children = map.get(collection.id) || [];
    collection.children = children;
    if (collection.parentId === null) {
      rootCollections.push(collection);
    }
  }

  // Sort by name
  const sortByName = (arr: ZoteroCollection[]): ZoteroCollection[] => {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    for (const c of arr) {
      sortByName(c.children);
    }
    return arr;
  };

  return sortByName(rootCollections);
}

/**
 * Returns all collections as a tree with total paper count.
 * @param dbPath - Path to zotero.sqlite
 */
export function getCollections(
  dbPath: string
): { collections: ZoteroCollection[]; totalPapers: number } {
  if (!fs.existsSync(dbPath)) {
    return { collections: [], totalPapers: 0 };
  }

  const db = openDb(dbPath);
  try {
    const rows = db
      .prepare(
        `
      SELECT collectionID, collectionName, parentCollectionID
      FROM collections
      ORDER BY collectionName
    `
      )
      .all() as Array<{
      collectionID: number;
      collectionName: string;
      parentCollectionID: number | null;
    }>;

    const { count } = db
      .prepare(
        `
      SELECT COUNT(DISTINCT ia.parentItemID) as count
      FROM itemAttachments ia
      WHERE ia.contentType = 'application/pdf'
        AND ia.parentItemID IS NOT NULL
    `
      )
      .get() as { count: number };

    return { collections: buildCollectionTree(rows), totalPapers: count };
  } finally {
    db.close();
  }
}

/**
 * Extracts filename from attachment path (format: storage:filename)
 */
function extractFilename(pdfPath: string | null): string {
  if (!pdfPath) return '';
  const match = pdfPath.match(/^storage:(.+)$/);
  return match ? match[1] : pdfPath;
}

/**
 * Returns items with PDF attachments.
 * @param dbPath - Path to zotero.sqlite
 * @param collectionId - Optional collection ID to filter by
 */
export function getItems(
  dbPath: string,
  collectionId?: number
): Array<{ key: string; title: string; attachmentKey: string; pdfFilename: string }> {
  if (!fs.existsSync(dbPath)) {
    return [];
  }

  const db = openDb(dbPath);
  try {
    let query: string;
    let params: unknown[];

    if (collectionId !== undefined) {
      query = `
        SELECT
          parentItem.key as key,
          idv.value as title,
          attItem.key as attachmentKey,
          ia.path as pdfPath
        FROM itemAttachments ia
        JOIN items attItem ON attItem.itemID = ia.itemID
        JOIN items parentItem ON parentItem.itemID = ia.parentItemID
        JOIN itemData id ON id.itemID = ia.parentItemID
        JOIN itemDataValues idv ON idv.valueID = id.valueID
        JOIN fields f ON f.fieldID = id.fieldID
        JOIN collectionItems ci ON ci.itemID = ia.parentItemID
        WHERE ia.contentType = 'application/pdf'
          AND ia.parentItemID IS NOT NULL
          AND f.fieldName = 'title'
          AND ci.collectionID = ?
        ORDER BY idv.value
      `;
      params = [collectionId];
    } else {
      query = `
        SELECT
          parentItem.key as key,
          idv.value as title,
          attItem.key as attachmentKey,
          ia.path as pdfPath
        FROM itemAttachments ia
        JOIN items attItem ON attItem.itemID = ia.itemID
        JOIN items parentItem ON parentItem.itemID = ia.parentItemID
        JOIN itemData id ON id.itemID = ia.parentItemID
        JOIN itemDataValues idv ON idv.valueID = id.valueID
        JOIN fields f ON f.fieldID = id.fieldID
        WHERE ia.contentType = 'application/pdf'
          AND ia.parentItemID IS NOT NULL
          AND f.fieldName = 'title'
        ORDER BY idv.value
      `;
      params = [];
    }

    const rows = db.prepare(query).all(...params) as Array<{
      key: string;
      title: string;
      attachmentKey: string;
      pdfPath: string | null;
    }>;

    return rows.map((row) => ({
      key: row.key,
      title: row.title || 'Untitled',
      attachmentKey: row.attachmentKey,
      pdfFilename: extractFilename(row.pdfPath),
    }));
  } finally {
    db.close();
  }
}

/**
 * Resolves the full path to a Zotero PDF file.
 * @param zoteroDataDir - Path to Zotero data directory (e.g., ~/Zotero)
 * @param attachmentKey - Zotero attachment key
 * @param pdfFilename - PDF filename
 * @returns Full path to the PDF file
 */
export function resolveZoteroPdfPath(
  zoteroDataDir: string,
  attachmentKey: string,
  pdfFilename: string
): string {
  const dir = zoteroDataDir.replace(/^~/, os.homedir());
  return path.join(dir, 'storage', attachmentKey, pdfFilename);
}

/**
 * Gets the file size of a PDF in Zotero storage.
 * @param zoteroDataDir - Path to Zotero data directory
 * @param attachmentKey - Zotero attachment key
 * @param pdfFilename - PDF filename
 * @returns File size in bytes, or 0 if not found
 */
export function getPdfFileSize(
  zoteroDataDir: string,
  attachmentKey: string,
  pdfFilename: string
): number {
  const pdfPath = resolveZoteroPdfPath(zoteroDataDir, attachmentKey, pdfFilename);
  try {
    if (fs.existsSync(pdfPath)) {
      const stat = fs.statSync(pdfPath);
      return stat.size;
    }
  } catch {
    // Ignore errors, return 0
  }
  return 0;
}