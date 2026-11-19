// Token Radar: a program that turns a sealed DefiLlama snapshot into a ranked
// board of pre-token protocols, a dashboard, and the dossier the judge reads.
//
//   node main.ts --input <snapshot.json|directory> [--output <dir>]
//
// It reads the snapshot at /input/snapshot.json (or --input), scores every
// pre-token protocol with the peer-calibrated model in lib/model.ts, writes
// the ranked board to /output/board.json and the dashboard's data to
// /output/data.js, copies dashboard/ to /output/dashboard, and writes the
// screenshots to /output/screenshots. Last it writes /output/dossier.json
// with the vendored make.fun library. The program is deterministic: two runs
// on the same input write the same bytes.
//
// Screenshots travel in the repository as base64 text (*.png.b64), because a
// binary file cannot be pushed through every Git client; main.ts decodes them
// back to whole PNG files here, and copies a real PNG or JPEG when one is
// present instead. The bytes written are the screenshots themselves.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));

/**
 * The screenshots: a real PNG or JPEG is copied whole; a *.png.b64 or
 * *.jpg.b64 file is base64 text of one, decoded here to the same name without
 * the .b64 tail. The decoded bytes must open as a whole PNG or JPEG, else the
 * run refuses rather than handing in a broken image.
 */
function writeScreenshots(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const written: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    if (name.endsWith('.b64')) {
      const target = name.slice(0, -4);
      if (!IMAGE_NAME.test(target)) {
        process.stderr.write(`token radar: screenshots/${target}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
        process.exit(1);
      }
      const text = readFileSync(path, 'utf8').replace(/\s+/g, '');
      const bytes = Buffer.from(text, 'base64');
      const isPng = bytes.subarray(0, 8).equals(PNG_MAGIC);
      const isJpeg = bytes.subarray(0, 3).equals(JPEG_MAGIC);
      if (!isPng && !isJpeg) {
        process.stderr.write(`token radar: screenshots/${name}: decoded bytes are not a whole PNG or JPEG\n`);
        process.exit(1);
      }
      writeFileSync(join(to, target), bytes);
      written.push(target);
    } else {
      if (!IMAGE_NAME.test(name)) {
        process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
        process.exit(1);
      }
      copyFileSync(path, join(to, name));
      written.push(name);
    }
  }
  return written;
}

const shots = writeScreenshots(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
