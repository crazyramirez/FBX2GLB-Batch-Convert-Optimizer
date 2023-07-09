// Single File Convert
// const convert = require('fbx2gltf');
// convert('F_Crouch_Strafe_Left.fbx', 'F_Crouch_Strafe_Left.glb', ['--khr-materials-unlit']).then(
//   destPath => {
//     // yay, do what we will with our shiny new GLB file!
//   },
//   error => {
//     // ack, conversion failed: inspect 'error' for details
//   }
// );


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
          console.log(`Archivo convertido: ${destPath}`);
        },
        error => {
          console.error(`Error al convertir el archivo: ${filePath}`);
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

convertFBXFiles('_input', '_output');
