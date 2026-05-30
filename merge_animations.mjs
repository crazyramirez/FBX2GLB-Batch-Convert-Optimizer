#!/usr/bin/env node

/**
 * GLB Animation Merger & Optimizer
 * 
 * Combines animations from an animations GLB file into a character GLB file.
 * Maps animation channels to character bones using name matching (Mixamo ↔ UE/Unity).
 * Strips redundant meshes, skins, and nodes from the animation source.
 * 
 * Mode 'character': Keeps character skeleton, retargets rotation keyframes via
 *   world-space change-of-basis so the coordinate-system difference between
 *   the animation skeleton and the character skeleton is corrected automatically.
 */

import fs from 'fs-extra';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, unpartition, draco as dracoCompress, quantize, resample } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

// ============================================================================
// CONFIGURATION
// ============================================================================
const SKELETON_SOURCE = 'character';

// Discard scale channels on all bones (prevents stretching)
const IGNORE_SCALE = true;
// Discard translation on non-root bones (prevents limb stretching)
const IGNORE_NON_ROOT_TRANSLATION = true;

// ── EASY POSTURE ADJUSTMENTS ───────────────────────────────────────────────
// Adjust these simple variables to spread/adjust limbs without manually editing POSE_OFFSETS.
const ARM_SPREAD_ANGLE = -5;  // Positive value spreads arms away from the body (degrees)
const LEG_SPREAD_ANGLE = 5;   // Positive value spreads legs outward (degrees)

// Per-bone rotation offsets applied AFTER retargeting (in degrees: [pitch, yaw, roll]).
// Use this for custom per-bone tweaks. Values are added on top of ARM_SPREAD_ANGLE / LEG_SPREAD_ANGLE.
// Bone names must be LOWERCASE and match the CHARACTER skeleton (Mixamo names).
const POSE_OFFSETS = {
  // e.g., 'mixamorig:leftshoulder': [0, 0, 0]
};

// Compress the output with Draco + Resample (reduces file size significantly)
const COMPRESS_OUTPUT = true;
// ============================================================================

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let charPath = '', animPath = '', outputPath = '';
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '-c' || args[i] === '--character') && args[i + 1]) { charPath = args[++i]; }
  else if ((args[i] === '-a' || args[i] === '--animations') && args[i + 1]) { animPath = args[++i]; }
  else if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) { outputPath = args[++i]; }
}
charPath = charPath || '_input/character.glb';
animPath = animPath || '_input/animations.glb';
outputPath = outputPath || '_output/character_combined.glb';

// ── Bone name mapping ───────────────────────────────────────────────────────
const BONE_MAP = {
  'pelvis': ['hips', 'mixamorig:hips'],
  'spine_01': ['spine', 'mixamorig:spine'],
  'spine_02': ['spine1', 'mixamorig:spine1'],
  'spine_03': ['spine2', 'mixamorig:spine2'],
  'neck_01': ['neck', 'mixamorig:neck'],
  'head': ['head', 'mixamorig:head'],
  'clavicle_l': ['leftshoulder', 'mixamorig:leftshoulder'],
  'upperarm_l': ['leftarm', 'mixamorig:leftarm'],
  'lowerarm_l': ['leftforearm', 'mixamorig:leftforearm'],
  'hand_l': ['lefthand', 'mixamorig:lefthand'],
  'clavicle_r': ['rightshoulder', 'mixamorig:rightshoulder'],
  'upperarm_r': ['rightarm', 'mixamorig:rightarm'],
  'lowerarm_r': ['rightforearm', 'mixamorig:rightforearm'],
  'hand_r': ['righthand', 'mixamorig:righthand'],
  'thigh_l': ['leftupleg', 'mixamorig:leftupleg'],
  'calf_l': ['leftleg', 'mixamorig:leftleg'],
  'foot_l': ['leftfoot', 'mixamorig:leftfoot'],
  'toe_l': ['lefttoebase', 'mixamorig:lefttoebase'],
  'ball_l': ['lefttoebase', 'mixamorig:lefttoebase'],
  'thigh_r': ['rightupleg', 'mixamorig:rightupleg'],
  'calf_r': ['rightleg', 'mixamorig:rightleg'],
  'foot_r': ['rightfoot', 'mixamorig:rightfoot'],
  'toe_r': ['righttoebase', 'mixamorig:righttoebase'],
  'ball_r': ['righttoebase', 'mixamorig:righttoebase'],
  'thumb_01_l': ['lefthandthumb1', 'mixamorig:lefthandthumb1'],
  'thumb_02_l': ['lefthandthumb2', 'mixamorig:lefthandthumb2'],
  'thumb_03_l': ['lefthandthumb3', 'mixamorig:lefthandthumb3'],
  'index_01_l': ['lefthandindex1', 'mixamorig:lefthandindex1'],
  'index_02_l': ['lefthandindex2', 'mixamorig:lefthandindex2'],
  'index_03_l': ['lefthandindex3', 'mixamorig:lefthandindex3'],
  'middle_01_l': ['lefthandmiddle1', 'mixamorig:lefthandmiddle1'],
  'middle_02_l': ['lefthandmiddle2', 'mixamorig:lefthandmiddle2'],
  'middle_03_l': ['lefthandmiddle3', 'mixamorig:lefthandmiddle3'],
  'ring_01_l': ['lefthandring1', 'mixamorig:lefthandring1'],
  'ring_02_l': ['lefthandring2', 'mixamorig:lefthandring2'],
  'ring_03_l': ['lefthandring3', 'mixamorig:lefthandring3'],
  'pinky_01_l': ['lefthandpinky1', 'mixamorig:lefthandpinky1'],
  'pinky_02_l': ['lefthandpinky2', 'mixamorig:lefthandpinky2'],
  'pinky_03_l': ['lefthandpinky3', 'mixamorig:lefthandpinky3'],
  'thumb_01_r': ['righthandthumb1', 'mixamorig:righthandthumb1'],
  'thumb_02_r': ['righthandthumb2', 'mixamorig:righthandthumb2'],
  'thumb_03_r': ['righthandthumb3', 'mixamorig:righthandthumb3'],
  'index_01_r': ['righthandindex1', 'mixamorig:righthandindex1'],
  'index_02_r': ['righthandindex2', 'mixamorig:righthandindex2'],
  'index_03_r': ['righthandindex3', 'mixamorig:righthandindex3'],
  'middle_01_r': ['righthandmiddle1', 'mixamorig:righthandmiddle1'],
  'middle_02_r': ['righthandmiddle2', 'mixamorig:righthandmiddle2'],
  'middle_03_r': ['righthandmiddle3', 'mixamorig:righthandmiddle3'],
  'ring_01_r': ['righthandring1', 'mixamorig:righthandring1'],
  'ring_02_r': ['righthandring2', 'mixamorig:righthandring2'],
  'ring_03_r': ['righthandring3', 'mixamorig:righthandring3'],
  'pinky_01_r': ['righthandpinky1', 'mixamorig:righthandpinky1'],
  'pinky_02_r': ['righthandpinky2', 'mixamorig:righthandpinky2'],
  'pinky_03_r': ['righthandpinky3', 'mixamorig:righthandpinky3'],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Strip common prefixes and separators to produce a canonical bone id. */
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/^(mixamorig\d*|armature|char|bi|bip\d*|biped)\b[:_]/i, '')
    .replace(/[:_\-\s]/g, '');
}

// Quaternion helpers
function qInvert([x, y, z, w]) { return [-x, -y, -z, w]; }
function qMul([x1, y1, z1, w1], [x2, y2, z2, w2]) {
  return [
    x1 * w2 + w1 * x2 + y1 * z2 - z1 * y2,
    y1 * w2 + w1 * y2 + z1 * x2 - x1 * z2,
    z1 * w2 + w1 * z2 + x1 * y2 - y1 * x2,
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
  ];
}
/** Convert Euler angles [pitch, yaw, roll] in degrees to a quaternion. */
function eulerToQuat(pitch, yaw, roll) {
  const p = (pitch * Math.PI / 180) / 2;
  const y = (yaw * Math.PI / 180) / 2;
  const r = (roll * Math.PI / 180) / 2;
  const sp = Math.sin(p), cp = Math.cos(p);
  const sy = Math.sin(y), cy = Math.cos(y);
  const sr = Math.sin(r), cr = Math.cos(r);
  return [
    sp * cy * cr + cp * sy * sr,
    cp * sy * cr - sp * cy * sr,
    cp * cy * sr + sp * sy * cr,
    cp * cy * cr - sp * sy * sr,
  ];
}

/** Build child→parent map using forward references (safe in gltf-transform). */
function buildParentMap(doc) {
  const map = new Map();
  for (const node of doc.getRoot().listNodes()) {
    for (const child of node.listChildren()) {
      map.set(child, node);
    }
  }
  return map;
}

function rotateVec3([x, y, z], [qx, qy, qz, qw]) {
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

/** Compute world-space quaternion rotation for every node. */
function computeWorldRotations(doc) {
  const parentMap = buildParentMap(doc);
  const cache = new Map();
  function get(node) {
    if (cache.has(node)) return cache.get(node);
    const local = node.getRotation() || [0, 0, 0, 1];
    const parent = parentMap.get(node);
    const world = parent ? qMul(get(parent), local) : local;
    cache.set(node, world);
    return world;
  }
  for (const node of doc.getRoot().listNodes()) get(node);
  return cache;
}

/** Find a character bone that corresponds to an animation bone. */
function findMatchingBone(animNode, charByName, charByNorm) {
  const src = animNode.getName();
  if (!src) return null;
  const lo = src.toLowerCase();

  // 1. Exact / lowercase
  let hit = charByName.get(src) || charByName.get(lo);
  if (hit) return hit;

  // 2. BONE_MAP forward (anim→char)
  const mapEntry = BONE_MAP[lo];
  if (mapEntry) {
    for (const alt of mapEntry) {
      hit = charByName.get(alt) || charByName.get(alt.toLowerCase());
      if (hit) return hit;
    }
  }

  // 3. BONE_MAP reverse (char→anim names might be Mixamo)
  for (const [key, alts] of Object.entries(BONE_MAP)) {
    if (alts.includes(lo)) {
      hit = charByName.get(key) || charByName.get(key.toLowerCase());
      if (hit) return hit;
    }
  }

  // 4. Normalized
  const norm = normalizeName(src);
  hit = charByNorm.get(norm);
  if (hit) return hit;

  // 5. Suffix / contains
  for (const [n, node] of charByNorm) {
    if (norm.endsWith(n) || n.endsWith(norm)) return node;
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('==================================================');
  console.log('       GLB ANIMATION MERGER & OPTIMIZER           ');
  console.log('==================================================');
  console.log(`Character:  ${charPath}`);
  console.log(`Animations: ${animPath}`);
  console.log(`Output:     ${outputPath}`);
  console.log(`Mode:       ${SKELETON_SOURCE.toUpperCase()}`);
  console.log('--------------------------------------------------');

  if (!(await fs.pathExists(charPath))) { console.error(`Missing: ${charPath}`); process.exit(1); }
  if (!(await fs.pathExists(animPath))) { console.error(`Missing: ${animPath}`); process.exit(1); }
  await fs.ensureDir(path.dirname(outputPath));

  // I/O setup
  const dracoLib = draco3d.createDecoderModule ? draco3d : (draco3d.default || draco3d);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await dracoLib.createDecoderModule(),
      'draco3d.encoder': await dracoLib.createEncoderModule(),
    });

  console.log('Loading documents...');
  const charDoc = await io.read(charPath);
  const animDoc = await io.read(animPath);

  // ── Pre-merge analysis ──────────────────────────────────────────────────
  // Compute world-space rest rotations for BOTH skeletons (before merge changes parents)
  const charWorldRots = computeWorldRotations(charDoc);
  const animWorldRots = computeWorldRotations(animDoc);

  // Index character rest rotations by lowercase name
  const charRestByName = new Map(); // lowercase → local quat
  const charWorldByName = new Map(); // lowercase → world quat
  for (const node of charDoc.getRoot().listNodes()) {
    const name = node.getName();
    if (name) {
      charRestByName.set(name.toLowerCase(), node.getRotation() || [0, 0, 0, 1]);
      charWorldByName.set(name.toLowerCase(), charWorldRots.get(node) || [0, 0, 0, 1]);
    }
  }

  // Index anim rest rotations by lowercase name
  const animRestByName = new Map();
  const animWorldByName = new Map();
  const animParentNameMap = new Map(); // child-name → parent-name (for post-merge lookup)
  for (const node of animDoc.getRoot().listNodes()) {
    const name = node.getName();
    if (name) {
      animRestByName.set(name.toLowerCase(), node.getRotation() || [0, 0, 0, 1]);
      animWorldByName.set(name.toLowerCase(), animWorldRots.get(node) || [0, 0, 0, 1]);
    }
    for (const child of node.listChildren()) {
      const cn = child.getName()?.toLowerCase();
      const pn = node.getName()?.toLowerCase();
      if (cn && pn) animParentNameMap.set(cn, pn);
    }
  }

  // Snapshot original assets before merge
  const origNodes = new Set(charDoc.getRoot().listNodes());
  const origScenes = new Set(charDoc.getRoot().listScenes());
  const origMeshes = new Set(charDoc.getRoot().listMeshes());
  const origSkins = new Set(charDoc.getRoot().listSkins());
  const origAnims = new Set(charDoc.getRoot().listAnimations());

  // Build character bone lookup tables
  const charByName = new Map();
  const charByNorm = new Map();
  for (const node of charDoc.getRoot().listNodes()) {
    const name = node.getName();
    if (name) {
      charByName.set(name, node);
      charByName.set(name.toLowerCase(), node);
      const n = normalizeName(name);
      if (n) charByNorm.set(n, node);
    }
  }

  console.log(`Character: ${origNodes.size} nodes, ${origMeshes.size} meshes, ${origAnims.size} anims, ${origSkins.size} skins`);

  // ── Merge ───────────────────────────────────────────────────────────────
  console.log('Merging animation document...');
  charDoc.merge(animDoc);

  // Eliminar cualquier animación llamada exactamente "mixamo.com",
  // venga de character.glb o de animations.glb
  let removedMixamo = 0;

  for (const anim of [...charDoc.getRoot().listAnimations()]) {
    if (anim.getName() === 'mixamo.com') {
      console.log('Removing animation: mixamo.com');
      anim.dispose();
      removedMixamo++;
    }
    if (anim.getName() === 'A_TPose') {
      console.log('Renaming animation: A_TPose');
      anim.setName('TPose');
    }
  }

  // Recalcular animaciones importadas restantes
  const importedAnims = charDoc.getRoot().listAnimations().filter(a => !origAnims.has(a));

  console.log(`Imported ${importedAnims.length} animations. Removed ${removedMixamo} "mixamo.com" animations.`);

  // ── MODE: character ──────────────────────────────────────────────────────
  if (SKELETON_SOURCE === 'character') {
    console.log('Retargeting animation channels to character skeleton...');
    let bound = 0, disposed = 0, unmatched = 0;
    const charParentMap = buildParentMap(charDoc); // built once after merge

    for (const anim of importedAnims) {
      console.log(`  "${anim.getName() || '?'}"...`);
      for (const ch of anim.listChannels()) {
        const path = ch.getTargetPath();
        const src = ch.getTargetNode();
        if (!src || !src.getName()) { ch.dispose(); disposed++; continue; }

        // Discard scale channels
        if (path === 'scale' && IGNORE_SCALE) { ch.dispose(); disposed++; continue; }

        const target = findMatchingBone(src, charByName, charByNorm);
        if (!target) { ch.dispose(); disposed++; unmatched++; continue; }

        const tgtName = target.getName().toLowerCase();
        const srcName = src.getName().toLowerCase();
        const isRoot = tgtName.includes('hips') || tgtName.includes('pelvis') || tgtName === '__root__';

        // Discard non-root translation
        if (path === 'translation' && !isRoot && IGNORE_NON_ROOT_TRANSLATION) {
          ch.dispose(); disposed++; continue;
        }

        // ── Retarget rotation keyframes via change-of-basis ──
        if (path === 'rotation') {
          const rAnim = animRestByName.get(srcName) || [0, 0, 0, 1];
          const rChar = charRestByName.get(tgtName) || [0, 0, 0, 1];
          const Wanim = animWorldByName.get(srcName) || [0, 0, 0, 1];
          const Wchar = charWorldByName.get(tgtName) || [0, 0, 0, 1];

          // Change-of-basis: C = Wchar⁻¹ · Wanim
          const C = qMul(qInvert(Wchar), Wanim);
          const Cinv = qInvert(C);
          const rAnimInv = qInvert(rAnim);

          const sampler = ch.getSampler();
          if (sampler) {
            const output = sampler.getOutput();
            if (output) {
              const arr = output.getArray();
              if (arr) {
                const out = new Float32Array(arr.length);
                for (let j = 0; j < arr.length; j += 4) {
                  const qKey = [arr[j], arr[j + 1], arr[j + 2], arr[j + 3]];
                  // delta = rAnim⁻¹ · qKeyframe  (animation-local delta)
                  const delta = qMul(rAnimInv, qKey);
                  // rotate delta into character space: C · delta · C⁻¹
                  const rotated = qMul(qMul(C, delta), Cinv);
                  // apply on top of character rest: rChar · rotated
                  let final = qMul(rChar, rotated);
                  // apply user-defined pose offset and dynamic spread adjustments if any
                  let pOffset = [0, 0, 0];
                  if (POSE_OFFSETS[tgtName]) {
                    pOffset = [...POSE_OFFSETS[tgtName]];
                  }

                  // Auto-apply ARM_SPREAD_ANGLE to shoulders/arms (Y-up / Z-roll spread)
                  if (tgtName.includes('leftshoulder') || tgtName.includes('leftarm')) {
                    pOffset[1] += ARM_SPREAD_ANGLE; // Positive roll spreads left arm out
                  } else if (tgtName.includes('rightshoulder') || tgtName.includes('rightarm')) {
                    pOffset[1] -= ARM_SPREAD_ANGLE; // Negative roll spreads right arm out
                  }

                  // Auto-apply LEG_SPREAD_ANGLE to upper legs
                  if (tgtName.includes('leftupleg') || tgtName.includes('leftthigh')) {
                    pOffset[1] -= LEG_SPREAD_ANGLE; // Negative roll spreads left leg out
                  } else if (tgtName.includes('rightupleg') || tgtName.includes('rightthigh')) {
                    pOffset[1] += LEG_SPREAD_ANGLE; // Positive roll spreads right leg out
                  }

                  if (pOffset[0] !== 0 || pOffset[1] !== 0 || pOffset[2] !== 0) {
                    final = qMul(final, eulerToQuat(pOffset[0], pOffset[1], pOffset[2]));
                  }
                  out[j] = final[0]; out[j + 1] = final[1]; out[j + 2] = final[2]; out[j + 3] = final[3];
                }
                output.setArray(out);
              }
            }
          }
        }

        // ── Retarget root translation ──────────────────────────────────────
        // animations.glb has root node Rx(-90°) — bone translations are in Z-up space.
        // character.glb has identity root — bones are in Y-up space.
        // Cp converts Z-up→Y-up. We rotate both keyframe AND animRest by Cp before
        // computing delta, so the delta is in world space and applies correctly.
        if (path === 'translation' && isRoot) {
          const srcParentName = animParentNameMap.get(srcName);
          const WanimP = srcParentName ? (animWorldByName.get(srcParentName) || [0, 0, 0, 1]) : [0, 0, 0, 1];
          const charParent = charParentMap.get(target);
          const WcharP = charParent ? (charWorldByName.get(charParent.getName()?.toLowerCase()) || [0, 0, 0, 1]) : [0, 0, 0, 1];
          const Cp = qMul(qInvert(WcharP), WanimP);

          const animRestLocal = src.getTranslation() || [0, 0, 0];
          const charRest = target.getTranslation() || [0, 0, 0];
          const animRestWorld = rotateVec3(animRestLocal, Cp);

          const output = ch.getSampler()?.getOutput();
          const arr = output?.getArray();
          if (arr) {
            const out = new Float32Array(arr.length);
            for (let j = 0; j < arr.length; j += 3) {
              const kw = rotateVec3([arr[j], arr[j + 1], arr[j + 2]], Cp);
              out[j]     = charRest[0] + kw[0] - animRestWorld[0];
              out[j + 1] = charRest[1] + kw[1] - animRestWorld[1];
              out[j + 2] = charRest[2] + kw[2] - animRestWorld[2];
            }
            output.setArray(out);
          }
        }

        ch.setTargetNode(target);
        bound++;
      }
    }
    console.log(`Retargeting done: ${bound} bound, ${disposed} disposed, ${unmatched} unmatched.`);

    // Dispose all imported nodes/meshes/skins (character keeps its own)
    for (const node of charDoc.getRoot().listNodes()) {
      if (!origNodes.has(node)) node.dispose();
    }
    for (const mesh of charDoc.getRoot().listMeshes()) {
      if (!origMeshes.has(mesh)) mesh.dispose();
    }
    for (const skin of charDoc.getRoot().listSkins()) {
      if (!origSkins.has(skin)) skin.dispose();
    }
  }

  // Dispose imported scenes
  for (const scene of charDoc.getRoot().listScenes()) {
    if (!origScenes.has(scene)) scene.dispose();
  }

  // Prune & consolidate
  console.log('Pruning unused data...');
  await charDoc.transform(prune());
  console.log('Consolidating buffers...');
  await charDoc.transform(unpartition());

  // Compress
  if (COMPRESS_OUTPUT) {
    console.log('Applying animation resampling and Draco mesh compression...');
    await charDoc.transform(
      resample(),
      dracoCompress(),
    );
  }

  // Write
  console.log(`Writing: ${outputPath}...`);
  const buf = await io.writeBinary(charDoc);
  await fs.writeFile(outputPath, buf);


  // Generar listado de animaciones
  const animationNames = charDoc
    .getRoot()
    .listAnimations()
    .map(anim => anim.getName() || 'UnnamedAnimation')
    .filter(name => name.trim() !== '');

  const txtPath = outputPath.replace(/\.glb$/i, '_animations.txt');

  await fs.writeFile(
    txtPath,
    animationNames.join('\n'),
    'utf8'
  );

  console.log(`Animation list saved: ${txtPath}`);


  console.log('==================================================');
  console.log(` 🎉 DONE! Output: ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);
  console.log('==================================================');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
