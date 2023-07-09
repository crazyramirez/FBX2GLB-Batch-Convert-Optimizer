NodeJS APP to Batch Convert fbx files to glb and Fast Optimization.
<br>
Easy to Setup and Easy to Use:

- Install NodeJS from https://nodejs.org/en
- Download or Clone this Repository
- Open a Terminal (Usign for example VSCode) 
- RUN: npm install (To Install NPM Libraries)
<br>
<br>

<b>Setup Your FBX Files</b>
- Copy your FBX Files in "_input" directory, also you can use subdirectories

<br>
<br>

<b>Convert FBX to GLB</b>
- RUN: node convert.js
- View the log and wait till finished
- Your Files will be converted in "_output" directory using the same structure
- View the log and wait till finished

<br>
<br>

<b>Optimize GLB Files</b>
- RUN: node optimize.mjs
- Your files located in "_output" directory will be optimized to "_optimized" folder
- View the log and wait till finished
- You can tweak optimize.mjs code (ie. const imageFormat = 'webp'; const imageSize = 512;)

<br>
<br>

This APP uses FBX2GLTF Library:
https://www.npmjs.com/package/fbx2gltf

and GLTF-Transform:
https://gltf-transform.dev/