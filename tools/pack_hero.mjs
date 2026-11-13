#!/usr/bin/env node
/**
 * Pack tools/hero-frames/*.png into a Phaser JSON-hash atlas
 * (public/assets/hero.png + public/assets/hero.json) via free-tex-packer-cli.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frameDir = path.join(root, 'tools/hero-frames');
const outDir = path.join(root, 'public/assets');
const projectPath = path.join(root, 'tools/hero.ftpp');

const images = fs.readdirSync(frameDir)
  .filter((f) => f.endsWith('.png'))
  .sort()
  .map((f) => ({ name: f, path: path.join(frameDir, f) }));

if (!images.length) {
  console.error('No frames in', frameDir, '- run python3 tools/make_hero.py first');
  process.exit(1);
}

const project = {
  savePath: outDir,
  images,
  folders: [],
  packOptions: {
    textureName: 'hero',
    width: 1024,
    height: 1024,
    fixedSize: false,
    powerOfTwo: false,
    padding: 2,
    extrude: 1,
    allowRotation: false,
    detectIdentical: false,
    allowTrim: false,
    removeFileExtension: true,
    prependFolderName: false,
    textureFormat: 'png',
    exporter: 'Phaser (hash)',
    packer: 'MaxRectsBin',
    packerMethod: 'BestShortSideFit',
    filter: 'none',
  },
};

fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));
execSync(`free-tex-packer-cli --project "${projectPath}" --output "${outDir}"`, { stdio: 'inherit' });

const jsonPath = path.join(outDir, 'hero.json');
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const frames = Object.keys(json.frames || json.textures?.[0]?.frames || {});
console.log('packed', frames.length, 'frames:', frames.sort().join(', '));
