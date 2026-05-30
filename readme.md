<a href="https://www.viseni.com" target="_blank"><img src="https://www.viseni.com/_demos_/viseni-logo-white.webp" style="width: 200px; margin-bottom: 50px"></a>
<br>
<br>

NodeJS APP to Batch Convert fbx files to glb and Fast Optimization (Draco -- Texture Compression).
<br>
<br>

<b><span>&#10003;</span>
Setup NodeJS</b>

- Install NodeJS from https://nodejs.org/en
- Download or Clone this Repository
- Open a Terminal (Usign for example VSCode) 
- RUN: <b>npm install</b> (To Install NPM Libraries)
<br>

<b><span>&#10003;</span>
Setup Your FBX Files</b>
- Copy your FBX Files in "_input" directory, also you can use subdirectories

<br>

<b><span>&#10003;</span>
Convert FBX to GLB</b>
- RUN: <b>node convert.js</b>
- Your Files will be converted in "_output" directory using the same structure
- View the log and wait till finished

<br>

<b><span>&#10003;</span>
Optimize GLB Files</b>
- RUN: <b>node optimize.mjs</b>
- Your files located in "_output" directory will be optimized to "_optimized" folder
- You can tweak optimize.mjs code to adapt it to your needs (ie. const imageFormat = 'webp'; const imageSize = 512;)
- View the log and wait till finished

<br>

<b><span>&#10003;</span>
Merge GLB Animations</b>
- Combines animations from a source animation GLB file into a target character GLB file.
- Retargets rotation keyframes using world-space change-of-basis (Mixamo ↔ UE/Unity compatibility).
- Automatically maps bone names via normalization rules and custom dictionaries.
- Discards scale channels and non-root translation channels to avoid limb stretching.
- Supports posture adjustments (arm and leg spreads, custom per-bone offsets) directly in the configuration section of the script.
- Cleans up and prunes redundant animation meshes/skins, compresses the output using Draco + resampling, and generates a text file listing all merged animations.
- RUN: <b>node merge_animations.mjs --character <character_path> --animations <animations_path> --output <output_path></b>
  - Command line flags:
    - `-c` or `--character`: Target character GLB path (default: `_input/character.glb`)
    - `-a` or `--animations`: Source animation GLB path (default: `_input/animations.glb`)
    - `-o` or `--output`: Output GLB path (default: `_output/character_combined.glb`)
  - Output files:
    - Combined GLB file: `_output/character_combined.glb`
    - Animation list text file: `_output/character_combined_animations.txt`

<br>

This APP uses FBX2GLTF Library:
https://www.npmjs.com/package/fbx2gltf

and GLTF-Transform:
https://gltf-transform.dev/
