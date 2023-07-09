// Files Iteration on _input Folder Convert
const fs = require('fs');
const path = require('path');
const convert = require('fbx2gltf');

function convertFBXFiles(inputDir, outputDir) {
  fs.readdirSync(inputDir).forEach(file => {
    const filePath = path.join(inputDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && path.extname(file) === '.fbx') {
      const outputFile = path.join(outputDir, file.replace('.fbx', '.glb'));

      convert(filePath, outputFile, ['--khr-materials-unlit']).then(
        destPath => {
          console.log(`File Converted: ${destPath}`);
        },
        error => {
          console.error(`Error Converting File: ${filePath}`);
          console.error(error);
        }
      );
    } else if (stats.isDirectory()) {
      const newInputDir = path.join(inputDir, file);
      const newOutputDir = path.join(outputDir, file);
      fs.mkdirSync(newOutputDir, { recursive: true });
      convertFBXFiles(newInputDir, newOutputDir);
    }
  });
}

// Convert Files Function
convertFBXFiles('_input', '_output');