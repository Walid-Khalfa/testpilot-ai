import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../schemas";

function dataDir(): string {
  return path.resolve(process.cwd(), loadEnv().DATA_DIR || ".data");
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as { code?: string })?.code === "ENOENT") return null;
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

export interface ProjectRepository {
  list(): Promise<import("../schemas").Project[]>;
  get(id: string): Promise<import("../schemas").Project | null>;
  save(p: import("../schemas").Project): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface RunRepository {
  list(): Promise<import("../schemas").Run[]>;
  get(id: string): Promise<import("../schemas").Run | null>;
  save(r: import("../schemas").Run): Promise<void>;
  delete(id: string): Promise<void>;
}

class FileProjectRepository implements ProjectRepository {
  private dir() { return path.join(dataDir(), "projects"); }
  private file(id: string) { return path.join(this.dir(), `${id}.json`); }
  async list(): Promise<import("../schemas").Project[]> {
    await ensureDir(this.dir());
    const entries = await fs.readdir(this.dir());
    const out: import("../schemas").Project[] = [];
    for (const e of entries) {
      if (!e.endsWith(".json")) continue;
      const v = await readJson<import("../schemas").Project>(path.join(this.dir(), e));
      if (v) out.push(v);
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string) { return readJson<import("../schemas").Project>(this.file(id)); }
  async save(p: import("../schemas").Project) { await writeJson(this.file(p.id), p); }
  async delete(id: string) {
    try { await fs.unlink(this.file(id)); } catch (e) { if ((e as { code?: string })?.code !== "ENOENT") throw e; }
  }
}

class FileRunRepository implements RunRepository {
  private dir() { return path.join(dataDir(), "runs"); }
  private file(id: string) { return path.join(this.dir(), `${id}.json`); }
  async list(): Promise<import("../schemas").Run[]> {
    await ensureDir(this.dir());
    const entries = await fs.readdir(this.dir());
    const out: import("../schemas").Run[] = [];
    for (const e of entries) {
      if (!e.endsWith(".json")) continue;
      const v = await readJson<import("../schemas").Run>(path.join(this.dir(), e));
      if (v) out.push(v);
    }
    return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async get(id: string) { return readJson<import("../schemas").Run>(this.file(id)); }
  async save(r: import("../schemas").Run) { await writeJson(this.file(r.id), r); }
  async delete(id: string) {
    try { await fs.unlink(this.file(id)); } catch (e) { if ((e as { code?: string })?.code !== "ENOENT") throw e; }
  }
}

export const projectRepo: ProjectRepository = new FileProjectRepository();
export const runRepo: RunRepository = new FileRunRepository();