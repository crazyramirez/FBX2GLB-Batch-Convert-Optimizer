import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { resample, prune, dedup, draco, textureCompress, meshopt } from '@gltf-transform/functions';
import sharp from 'sharp';
import { ensureDirSync } from 'fs-extra';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const inputDir = '_output';
const outputDir = '_optimized';

// Variables
const imageFormat = 'webp'; // jpeg or png
const imageSize = 512; // 512 or 256

// Configure I/O.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

// Create the '_optimized' directory if it doesn't exist
ensureDirSync(outputDir);

// Function to process the files recursively
async function processFiles(directory) {
  const files = readdirSync(directory);

  for (const file of files) {
    const filePath = join(directory, file);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      const subOutputDir = join(outputDir, relative(inputDir, directory), file);
      ensureDirSync(subOutputDir);
      await processFiles(filePath); // Recursive call for subdirectories
    } else if (stats.isFile() && file.endsWith('.glb')) {
      const outputFile = join(outputDir, relative(inputDir, directory), file);

      try {
        // Read the glTF document from file
        const document = await io.read(filePath);

        // Apply transformations
        await document.transform(
          // Losslessly resample animation frames.
          resample(),
          // Remove unused nodes, textures, or other data.
          prune(),
          // Remove duplicate vertex or texture data, if any.
          dedup(),
          // Compress mesh geometry with Draco.
          draco(),
          // Convert textures to WebP (Requires glTF Transform v3 and Node.js).
          textureCompress({
            encoder: sharp,
            targetFormat: imageFormat,
            resize: [imageSize, imageSize],
          }),
          // Custom transform.
          backfaceCulling({ cull: true })
        );

        // Save the optimized glTF document to the output file
        await io.write(outputFile, document);
        console.log(`Processed file: ${filePath}`);
      } catch (error) {
        console.error(`Error processing file: ${filePath}`);
        console.error(error);
      }
    }
  }
}

// Custom transform: enable/disable backface culling.
function backfaceCulling(options) {
  return (document) => {
    for (const material of document.getRoot().listMaterials()) {
      material.setDoubleSided(!options.cull);
    }
  };
}

// Call the asynchronous function to process files starting from the '_output' directory
processFiles(inputDir)
  .then(() => {
    console.log('Files processed successfully.');
  })
  .catch((error) => {
    console.error('Error processing files:', error);
  });
