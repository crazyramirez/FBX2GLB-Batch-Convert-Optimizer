<a href="https://www.viseni.com" target="_blank"><img src="https://www.viseni.com/viseni_logo_2.png" style="width: 200px; margin-bottom: 50px"></a>
<br>
<br>

NodeJS APP to Batch Convert fbx files to glb and Fast Optimization (Draco -- Texture Compression).
<br>
<br>

Easy to Setup and Easy to Use:

- Install NodeJS from https://nodejs.org/en
- Download or Clone this Repository
- Open a Terminal (Usign for example VSCode) 
- RUN: <b>npm install</b> (To Install NPM Libraries)
<br>

<b>Setup Your FBX Files</b>
- Copy your FBX Files in "_input" directory, also you can use subdirectories

<br>

<b>Convert FBX to GLB</b>
- RUN: <b>node convert.js</b>
- Your Files will be converted in "_output" directory using the same structure
- View the log and wait till finished

<br>

<b>Optimize GLB Files</b>
- RUN: <b>node optimize.mjs</b>
- Your files located in "_output" directory will be optimized to "_optimized" folder
- You can tweak optimize.mjs code to adapt it to your needs (ie. const imageFormat = 'webp'; const imageSize = 512;)
- View the log and wait till finished

<br>

This APP uses FBX2GLTF Library:
https://www.npmjs.com/package/fbx2gltf

and GLTF-Transform:
https://gltf-transform.dev/
