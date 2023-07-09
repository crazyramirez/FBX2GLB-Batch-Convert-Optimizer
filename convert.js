const fs = require('fs');
const path = require('path');
const convert = require('fbx2gltf');

function convertFBXFiles(inputDir, outputDir) {
  fs.readdirSync(inputDir).forEach(file => {
    const filePath = path.join(inputDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && path.extname(file) === '.fbx') {
      const outputFile = path.join(outputDir, file.replace('.fbx', '.glb'));

      console.log(`Converting file: ${filePath}`);

      convert(filePath, outputFile, ['--khr-materials-unlit']).then(
        destPath => {
          console.log(`File converted: ${destPath}`);
        },
        error => {
          console.error(`Error converting file: ${filePath}`);
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
