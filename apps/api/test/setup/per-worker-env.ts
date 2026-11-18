import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs in every test worker before any test file loads. Each worker gets its own upload temp folder:
 * with one shared folder, a suite counting "no temp file left behind" saw other suites' uploads come
 * and go when everything ran in parallel (upload-limits failed only in the full run).
 */
process.env.UPLOAD_TMP_DIR = join(tmpdir(), `myhoodora-uploads-test-${process.env.JEST_WORKER_ID ?? "0"}`);
