import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { XRButton } from "three/examples/jsm/webxr/XRButton.js";
import { OculusHandModel } from "three/examples/jsm/webxr/OculusHandModel.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js"; // Correct import of FontLoader
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js"; // Correct import of TextGeometry
import ThreeMeshUI from "three-mesh-ui";
import FontJSON from "three-mesh-ui/examples/assets/Roboto-msdf.json";
import FontImage from "three-mesh-ui/examples/assets/Roboto-msdf.png";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import ConditionalNode from "three/src/nodes/math/ConditionalNode.js";
import { Water } from "three/addons/objects/Water2.js";
import { textureLoad } from "three/tsl";
import { remove } from "three/examples/jsm/libs/tween.module.js";

//**
// Initialization
//  */

// Setup canvas, scene, and camera
const canvas = document.querySelector("canvas.webGL");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 2, 3);

// Setup renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

// SetUp XR Session
const sessionInit = {
  requiredFeatures: ["hand-tracking"],
};
const xrButton = XRButton.createButton(renderer, sessionInit);

// Start Remove the main menu container
document.body.appendChild(xrButton);

renderer.xr.addEventListener("sessionstart", () => {
  console.log("XR session started");

  // Remove the main menu if it's visible
  if (mainMenuContainer) {
    scene.remove(mainMenuContainer);
    mainMenuContainer = null;
  }
  // Start the simulation directly
  simulationStart(); //
});
// End main menu container

// Disable the XR button initially until models are loaded
xrButton.disabled = true;
xrButton.style.opacity = "0.5";
xrButton.style.cursor = "not-allowed";
xrButton.style.pointerEvents = "none";
xrButton.style.filter = "grayscale(1)";

document.body.appendChild(xrButton);

// Add lighting
const light = new THREE.AmbientLight(0xffffff, 1);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(0, 5, 0.5);
scene.add(directionalLight);

// Create separate bounding boxes for drape deployment areas
const fullDrapeDeploymentBoxGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.6);
const fullDrapeDeploymentBoxMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true,
});
const fullDrapeDeploymentBox = new THREE.Mesh(
  fullDrapeDeploymentBoxGeometry,
  fullDrapeDeploymentBoxMaterial
);
fullDrapeDeploymentBox.position.set(1.25, 0.85, 0.15); // Under patient (lower)
scene.add(fullDrapeDeploymentBox);
fullDrapeDeploymentBox.visible = false;

const fenestratedDrapeDeploymentBoxGeometry = new THREE.BoxGeometry(
  0.4,
  0.3,
  0.4
);
const fenestratedDrapeDeploymentBoxMaterial = new THREE.MeshBasicMaterial({
  color: 0x0000ff,
  wireframe: true,
});
const fenestratedDrapeDeploymentBox = new THREE.Mesh(
  fenestratedDrapeDeploymentBoxGeometry,
  fenestratedDrapeDeploymentBoxMaterial
);
fenestratedDrapeDeploymentBox.position.set(1.25, 1.15, 0.25); // Over patient (higher)
scene.add(fenestratedDrapeDeploymentBox);
fenestratedDrapeDeploymentBox.visible = false;

// Keep the original deployment box for backward compatibility (will use full drape zone)
const deploymentBox = fullDrapeDeploymentBox;

const offsetValue = 1.25;

/**
 * UI
 */
const instructions = {
  // '0': "Unwrap the foley kit.",
  // '1': "Wear the sterile gloves inside the kit.",
  // '2': "Put the full drape under the patient's perinium and the fenestrated drape over the patient's perinium.",
  // '3': "Lubricate the catheter then set it down to the tray.",
  // '4': "Take the saline syringe and urine bag then attach them to the catheter.",
  // '5': "Take the swabs to clean the opening",
  // '6': "Pick up the catheter and insert it to the urethral opening",
  // '7': "Inflate the balloon.",
  // '8': "Remove the saline syringe.",
  // '9': "Remove the drapes and dispose properly.",
  // '10': "GREAT JOB! \nYou have completed the procedure."

  0: "Unwrap the foley kit.",
  1: "Wear the sterile gloves inside the kit.",
  2: "Put the full drape under the patient's perinium and the fenestrated drape over the patient's perinium.",
  3: "Take the swabs to clean the opening",
  4: "Lubricate the catheter.",
  5: "Take the saline syringe and urine bag then attach them to the catheter.",
  6: "Insert catheter to the urethral opening",
  7: "Inflate the balloon.",
  8: "Remove the saline syringe.",
  9: "Remove the drapes and dispose properly.",
  10: "GREAT JOB! \nYou have completed the procedure.",
};

const objsToTest = [];
let selectState = false;
let instructionNumber = 0;
let currentTextPanel = null;
let currentOutputPanel = null;
let message = "";
let isError = false;
let lubricated = false;
let videoEnd = false;
let unwrapContainer = null; // Store the unwrap button UI container
const instructionsLength = Object.keys(instructions).length; // determine the number of instructions

// Arrow indicator system for pointing to tools
let arrowIndicators = []; // Store all arrow indicators
let toolArrowMap = new Map(); // Map tools to their arrows

// Define which tools are needed for each instruction step
const stepRequiredTools = {
  0: [], // Unwrap button (special case)
  1: ["GLTF/catheterKit/11. Sterile Gloves_Closed.glb"], // Sterile gloves
  2: [
    "GLTF/catheterKit/12. Full Drape.glb",
    "GLTF/catheterKit/13. Fenestrated Drape.glb",
  ], // Drapes
  3: [
    "GLTF/catheterKit/5. Swabsticks1.glb",
    "GLTF/catheterKit/6. Swabsticks2.glb",
    "GLTF/catheterKit/7. Swabsticks3.glb",
  ], // Swabsticks
  4: ["GLTF/catheterKit/4. Lubricant.glb", "GLTF/catheterKit/10. Catheter.glb"], // Lubricant and catheter
  5: [
    "GLTF/catheterKit/3. Saline Syringe.glb",
    "GLTF/catheterKit/9. Urine Collection Bag.glb",
    "GLTF/catheterKit/10. Catheter.glb",
  ], // Syringe, urine bag, catheter
  6: ["combined_catheter"], // Special case for combined catheter
  7: ["deployed_deflated_catheter"], // Special case for deployed deflated catheter with syringe
  8: ["deployed_inflated_catheter"], // Special case for deployed inflated catheter with syringe
  9: ["deployed_drapes"], // Special case for deployed drapes
  10: [], // End
};

//create a bounding box for spawning the unwrap button
const kitBoundingGeometry = new THREE.BoxGeometry(1, 0.3, 1);
const kitBoundingMaterial = new THREE.MeshBasicMaterial({
  color: 0x0000ff,
  wireframe: true,
});
const kitBounding = new THREE.Mesh(kitBoundingGeometry, kitBoundingMaterial);
kitBounding.position.set(0, 1.1, 1.13);
kitBounding.visible = false;
scene.add(kitBounding);

const kitboundingBox = new THREE.Box3().setFromObject(kitBounding);

// Call the UI Creation functions
let currentVideo = null;
let currentPlane = null;
let mainMenuContainer = null; // Store the main menu UI container

// let unwrapContainer = null; // Store the UI container
let nextActive = false;
let time = 0; // Track time for smooth animation

/*** start of loading meshes ***/

// Loaders
const loader = new GLTFLoader();
let kit = [],
  envMaterials = [],
  deployedInstruments = [];
let water; //for lubricant
let catheterWithSyringeModel = null; // Combined catheter + syringe
let catheterWithSyringeAndBagModel = null; // Combined catheter + syringe + urine bag
let currentCombinedCatheter = null; // Track which combined model is currently attached
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./draco/");
loader.setDRACOLoader(dracoLoader);

// Loading Management System
let loadingManager = {
  totalLoaders: 0,
  completedLoaders: 0,
  isMainMenuLoaded: false,

  registerLoader: function () {
    this.totalLoaders++;
    console.log(`Registered loader ${this.totalLoaders}`);
  },

  completeLoader: function (loaderName) {
    this.completedLoaders++;
    console.log(
      `Completed loader: ${loaderName} (${this.completedLoaders}/${this.totalLoaders})`
    );

    if (this.completedLoaders >= this.totalLoaders && !this.isMainMenuLoaded) {
      this.hideLoadingIndicator();
    }
  },

  hideLoadingIndicator: function () {
    this.isMainMenuLoaded = true;
    console.log("All main models loaded! Hiding loading indicator...");

    const loadingOverlay = document.getElementById("loading-overlay");
    if (loadingOverlay) {
      // Update loading text to indicate completion
      const loadingText = loadingOverlay.querySelector(".loading-text");
      const loadingSubtext = loadingOverlay.querySelector(".loading-subtext");
      if (loadingText && loadingSubtext) {
        loadingText.textContent = "Loading Complete!";
        loadingSubtext.textContent = "VR experience is ready to start";
      }

      // Wait a moment to show the completion message, then hide
      setTimeout(() => {
        loadingOverlay.classList.add("hidden");

        // Remove the loading overlay completely after transition
        setTimeout(() => {
          if (loadingOverlay.parentNode) {
            loadingOverlay.remove();
          }
        }, 500); // Match the CSS transition duration
      }, 1000); // Show completion message for 1 second
    }

    // Enable the XR button now that all models are loaded
    if (xrButton) {
      xrButton.disabled = false;
      xrButton.style.opacity = "1";
      xrButton.style.cursor = "pointer";
      xrButton.style.pointerEvents = "auto";
      xrButton.style.filter = "none"; // Remove grayscale filter
      console.log("XR button enabled - ready to start VR experience!");
    }
  },
};

let tipBox = null;

// Load Catheter Model
// // Create a bounding box for the detachment of syringe
// const syringeDetachmentBoxGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
// const syringeDetachmentBoxMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
// const syringeDetachmentBox = new THREE.Mesh(syringeDetachmentBoxGeometry, syringeDetachmentBoxMaterial);
// // scene.add(syringeBox);
// // syringeBox.add(syringeDetachmentBox);
// syringeDetachmentBox.position.set(offsetValue, 0.95, 0.5);
// syringeDetachmentBox.visible = true;

// OLD CATHETER MODEL LOADING REMOVED - Now using individual kit components + combined models

// Create insertionBox outside the function
const insertionBoxGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.03); //(0.01, 0.01, 0.03)
const insertionBoxMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const insertionBox = new THREE.Mesh(insertionBoxGeometry, insertionBoxMaterial);

// Create a red sphere indicator at the insertionBox
const sphereGeometry = new THREE.SphereGeometry(0.01, 32, 32);
const sphereMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5,
});
const sphereIndicator = new THREE.Mesh(sphereGeometry, sphereMaterial);

sphereIndicator.visible = false; // Initially hide the sphere indicator
scene.add(sphereIndicator);

// Set a default position (adjust as needed)
insertionBox.visible = false; // Make sure it's not visible

// Add to the scene initially (optional)
scene.add(insertionBox);

//loading environment (nongrabbable)
const environment = [
  { path: "GLTF/environment/Table.glb" },
  // { path: "GLTF/environment/FemalePatient.glb" },
  { path: "GLTF/environment/Patient_Upper.glb" },
  { path: "GLTF/environment/Patient_Lower.glb" },
  { path: "GLTF/environment/Delivery Bed.glb" },
  { path: "GLTF/environment/Medical Trashcan.glb" },
  { path: "GLTF/environment/1. Foley Pack_Whole.glb" },
];

let mixer; // Declare this globally or somewhere accessible

function loadEnvironment() {
  loadingManager.registerLoader();

  let loadedCount = 0;
  const totalItems = environment.length;

  environment.forEach(({ path }) => {
    loader.load(
      path,
      (gltf) => {
        const newObject = gltf.scene;
        envMaterials.push(newObject);
        scene.add(newObject);
        newObject.position.x += offsetValue;

        // Disable grabbing
        newObject.userData.grabbable = false;
        newObject.userData.path = path;

        // Set visibility to false for all environment objects
        newObject.visible = false;

        if (path === "GLTF/environment/Patient_Lower.glb") {
          // Set specific position for Patient_Lower
          newObject.position.set(1.25, 0.01, 0.2); // change these values as needed

          // Play animation if available
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(newObject);
            gltf.animations.forEach((clip) => {
              const action = mixer.clipAction(clip);
              action.play();
            });
          }

          // Position helper objects
          insertionBox.position.copy(newObject.position);
          insertionBox.position.y += 0.99;
          insertionBox.position.z += -0.15;

          sphereIndicator.position.set(1.25, 0.995, 0.19);
        } else if (path === "GLTF/environment/Patient_Upper.glb") {
          // Set specific position for Patient_Upper
          newObject.position.set(1.25, 0.01, 0.2); // change these values as needed
        }

        loadedCount++;
        if (loadedCount === totalItems) {
          loadingManager.completeLoader("Environment");
        }
      },
      undefined,
      (error) => console.error("Error loading assets", error)
    );
  });
}

let deflatedCatheter, inflatedCatheter, noSyringeCatheter, urineCatheter;
let urineBagMixer;

// Define lubricant animation state variables
let lubricantObject = null,
  deployedLubricant = null;

// Create a bounding box for swabs collision
const swabsBoundingGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
const swabsBoundingMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  wireframe: true,
});
const swabsBounding = new THREE.Mesh(
  swabsBoundingGeometry,
  swabsBoundingMaterial
);
swabsBounding.position.set(1.25, 1, 0.176); // Adjust position as needed
swabsBounding.visible = false; // Set to false if you don't want it visible
scene.add(swabsBounding);

const swabsBoundingBox = new THREE.Box3().setFromObject(swabsBounding);

let swab1Collided = false;
let swab2Collided = false;
let swab3Collided = false;
let catheterInsertionSoundPlayed = false;

let fulldrapeDisposed = false;
let fenestratedDrapeDisposed = false;
let swab1Disposed = false,
  swab2Disposed = false,
  swab3Disposed = false;
let glovesDisposed = false,
  lubricantDisposed = false;

// Drape deployment feedback states
let fullDrapeInZone = false;
let fenestratedDrapeInZone = false;
let fullDrapeOriginalMaterials = null;
let fenestratedDrapeOriginalMaterials = null;

// const glovesOpen = kit.find(obj => obj.userData.path === "GLTF/deployed/Open Gloves_New1.glb");
// const lubricant = deployedInstruments.find(obj => obj?.userData?.path === "GLTF/deployed/4. Lubricant.glb");
// console.log("glovesOpen", glovesOpen);
// console.log("lubricant", lubricant);
// if (!glovesDisposed && glovesOpen.intersectBox(trashcanBox)) {
//     playSFX('public/sfx/trashcan_sfx.wav');
//     glovesOpen.visible = false;
//     scene.remove(glovesOpen);
// }

// if (!lubricantDisposed && lubricant.intersectBox(trashcanBox)) {
//     playSFX('public/sfx/trashcan_sfx.wav');
//     lubricant.visible = false;
//     scene.remove(lubricant);
// }

// Check collision for swabsticks
const swab1 = kit.find(
  (obj) => obj.userData.path === "GLTF/catheterKit/5. Swabsticks1.glb"
);
const swab2 = kit.find(
  (obj) => obj.userData.path === "GLTF/catheterKit/6. Swabsticks2.glb"
);
const swab3 = kit.find(
  (obj) => obj.userData.path === "GLTF/catheterKit/7. Swabsticks3.glb"
);

// Hand Controllers
const hand1 = renderer.xr.getHand(0);
hand1.add(new OculusHandModel(hand1));
scene.add(hand1);

const hand2 = renderer.xr.getHand(1);
hand2.add(new OculusHandModel(hand2));
scene.add(hand2);

// Raycaster for interaction
const raycaster = new THREE.Raycaster();
const grabbedObjects = new Map();

// PointerLockControls setup (for controlling models using hands)
let controls = new PointerLockControls(camera, canvas);
scene.add(controls.object); // Use controls.object instead of getObject()

// Event listener to make hand tracking functional
const mouse = new THREE.Vector2();

// Set up controllers
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
scene.add(controller1);
scene.add(controller2);

// Controller helper spheres removed - now using laser fingertip indicators instead

// Add controller grips
const controllerGrip1 = renderer.xr.getControllerGrip(0);
const controllerGrip2 = renderer.xr.getControllerGrip(1);
scene.add(controllerGrip1);
scene.add(controllerGrip2);

// Handle controller interactions
setupController(controller1);
setupController(controller2);

const clock = new THREE.Clock();

// Functions

// Debug function to toggle deployment box visibility (for development use only)
function toggleDeploymentBoxVisibility() {
  fullDrapeDeploymentBox.visible = !fullDrapeDeploymentBox.visible;
  fenestratedDrapeDeploymentBox.visible =
    !fenestratedDrapeDeploymentBox.visible;
  console.log(
    "Debug: Deployment boxes visibility:",
    fullDrapeDeploymentBox.visible
  );
}

// Keep deployment boxes hidden during normal gameplay
function showDeploymentBoxForDebugging() {
  // Boxes remain hidden for clean gameplay experience
  // Uncomment lines below if debugging is needed:
  // if (instructionNumber === 2) {
  //     fullDrapeDeploymentBox.visible = true;
  //     fenestratedDrapeDeploymentBox.visible = true;
  //     console.log("Deployment boxes made visible for debugging");
  // }
}

function playVideo(vidName) {
  const video = document.getElementById(vidName);
  videoEnd = false;

  // Wait 4 seconds before playing
  setTimeout(() => {
    video.play().catch((error) => {
      console.error("Error attempting to play the video:", error);
    });
  }, 4000);

  // video.play().catch(error => {
  //     console.error('Error attempting to play the video:', error);
  // });

  const videoTexture = new THREE.VideoTexture(video);
  const geometry = new THREE.PlaneGeometry(1.2, 0.672);
  const material = new THREE.MeshBasicMaterial({ map: videoTexture });
  const plane = new THREE.Mesh(geometry, material);
  plane.position.set(-1.3, 1.5, 1.1);
  plane.rotation.y = Math.PI - Math.PI / 4;
  scene.add(plane);

  currentVideo = video;
  currentPlane = plane;

  video.addEventListener("ended", () => {
    stopVideo();
  });
}

function stopVideo() {
  if (currentVideo && currentPlane) {
    currentVideo.pause();
    currentVideo.currentTime = 0;

    scene.remove(currentPlane);
    currentPlane.geometry.dispose();
    currentPlane.material.map.dispose();
    currentPlane.material.dispose();

    console.log("video stopped and plane removed");

    currentVideo = null;
    currentPlane = null;
    videoEnd = true;
  }
}

function makePanel() {
  // Create the a next and previous button panel
  const container = new ThreeMeshUI.Block({
    justifyContent: "center",
    contentDirection: "row-reverse",
    fontFamily: FontJSON,
    fontTexture: FontImage,
    fontSize: 0.07,
    padding: 0.02,
    borderRadius: 0.11,
  });
  // container.position.set( 0, 0.6, -1);    // to change
  container.rotation.x = 0.55;
  container.position.set(0, 1, 1.5);
  container.rotation.y = Math.PI;
  scene.add(container);

  // BUTTONS
  const buttonOptions = {
    width: 0.4,
    height: 0.15,
    justifyContent: "center",
    offset: 0.05,
    margin: 0.02,
    borderRadius: 0.075,
  };

  // Options for component.setupState().
  // It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

  const hoveredStateAttributes = {
    state: "hovered",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x999999),
      backgroundOpacity: 1,
      fontColor: new THREE.Color(0xffffff),
    },
  };

  const idleStateAttributes = {
    state: "idle",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x666666),
      backgroundOpacity: 0.3,
      fontColor: new THREE.Color(0xffffff),
    },
  };

  // Create states for the buttons.
  const selectedAttributes = {
    offset: 0.02,
    backgroundColor: new THREE.Color(0x777777),
    fontColor: new THREE.Color(0x222222),
  };

  const buttonNext = new ThreeMeshUI.Block(buttonOptions);
  buttonNext.add(new ThreeMeshUI.Text({ content: "NEXT" }));

  // buttonPrevious.setupState( {
  // 	state: 'selected',
  // 	attributes: selectedAttributes,
  // 	onSet: () => {  // when PREVIOUS button is clicked
  //         if (instructionNumber > 0) {
  //             instructionNumber += -1;
  //             makeTextPanel(instructionNumber);
  //         }else{
  //             console.log("this is the first instruction");
  //         }

  // 	}
  // } );
  // buttonPrevious.setupState( hoveredStateAttributes );
  // buttonPrevious.setupState( idleStateAttributes );

  //

  buttonNext.setupState({
    state: "selected",
    attributes: selectedAttributes,
    onSet: () => {
      //next button pressed
      stopVO(); // Stop any playing voiceover
      stopVideo();

      if (nextActive || instructionNumber === 10) {
        if (instructionNumber < instructionsLength - 1) {
          instructionNumber += 1;
          makeTextPanel(instructionNumber);
          nextActive = false;
        } else {
          // Final step - exit XR and refresh page
          if (renderer.xr.isPresenting) {
            // Try to end XR session
            try {
              renderer.xr.getSession().end();
            } catch (err) {
              // If XR ending fails, just refresh anyway
            }
            // Wait briefly then refresh
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } else {
            // Not in XR, refresh immediately
            window.location.reload();
          }
        }
      }
    },
  });

  [buttonNext].forEach((button) => {
    button.setupState(hoveredStateAttributes);
    button.setupState(idleStateAttributes);
  });

  container.add(buttonNext);
  objsToTest.push(buttonNext);

  if (instructionNumber === 1) {
    const buttonSkip = new ThreeMeshUI.Block(buttonOptions);
    buttonSkip.add(new ThreeMeshUI.Text({ content: "SKIP" }));

    buttonSkip.setupState({
      state: "selected",
      attributes: selectedAttributes,
      onSet: () => {
        stopVO(); // Stop any playing voiceover
        stopVideo();
        if (instructionNumber < instructionsLength - 1) {
          instructionNumber += 1; // Skip to next instruction
          makeTextPanel(instructionNumber);
        }
        // scene.remove(container); // Optional: remove panel after skip
      },
    });

    buttonSkip.setupState(hoveredStateAttributes);
    buttonSkip.setupState(idleStateAttributes);

    container.add(buttonSkip);
    objsToTest.push(buttonSkip);
  }
}

function inflateButton() {
  // Create the a next and previous button panel
  const container = new ThreeMeshUI.Block({
    justifyContent: "center",
    contentDirection: "row-reverse",
    fontFamily: FontJSON,
    fontTexture: FontImage,
    fontSize: 0.07,
    padding: 0.02,
    borderRadius: 0.11,
    backgroundOpacity: 0,
  });
  // container.position.set( 0, 0.6, -1);    // to change
  // container.rotation.x = -0.55;
  container.position.set(1.3, 0.87, 0.5);
  container.rotation.y = -Math.PI / 2;
  scene.add(container);

  // BUTTONS
  const buttonOptions = {
    width: 0.5,
    height: 0.15,
    justifyContent: "center",
    offset: 0.05,
    margin: 0.02,
    borderRadius: 0.075,
  };

  // Options for component.setupState().
  // It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

  const hoveredStateAttributes = {
    state: "hovered",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x999999),
      backgroundOpacity: 0,
      fontColor: new THREE.Color(0xffffff),
      fontOpacity: 0,
    },
  };

  const idleStateAttributes = {
    state: "idle",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x666666),
      backgroundOpacity: 0,
      fontColor: new THREE.Color(0xffffff),
      fontOpacity: 0,
    },
  };

  // Buttons creation, with the options objects passed in parameters.

  const buttonPrevious = new ThreeMeshUI.Block(buttonOptions);
  const buttonNext = new ThreeMeshUI.Block(buttonOptions);

  buttonNext.add(new ThreeMeshUI.Text({ content: "INFLATE" }));

  // Create states for the buttons.
  const selectedAttributes = {
    offset: 0.02,
    backgroundColor: new THREE.Color(0x777777),
    fontColor: new THREE.Color(0x222222),
  };

  buttonNext.setupState({
    state: "selected",
    attributes: selectedAttributes,
    onSet: () => {
      //next button pressed
      //INSERT CODE FOR INFLATION
      if (instructionNumber == 7) {
        if (!nextActive) {
          console.log("syringe inflated");
          deflatedCatheter.visible = false;
          scene.remove(deflatedCatheter);
          inflatedCatheter.visible = true;

          // SHOW URINE BAG ANIMATION AFTER CLICKED THE INFLATED BUTTON
          // showUrineBagAnimation();

          nextActive = true;
          outputPanel("Balloon successfully inflated.", false);
          playSFX("/sfx/pop-sfx.mp3");
        }
      } else if (instructionNumber == 8) {
        if (!nextActive) {
          removeSyringeFromCatheter();
          nextActive = true;
          scene.remove(container);
          playSFX("/sfx/pop-sfx.mp3");
        }
      }
    },
  });
  buttonNext.setupState(hoveredStateAttributes);
  buttonNext.setupState(idleStateAttributes);

  //

  container.add(buttonNext);
  objsToTest.push(buttonNext);
}

function makeTextPanel(instructionNumber) {
  // Create a GUI for instruction display
  console.log(instructionNumber);

  // Remove the last text panel if it exists
  if (currentTextPanel) {
    scene.remove(currentTextPanel);
    currentTextPanel = null;
  }
  if (instructionNumber == 1) {
    playVideo("Boy Vo Sterile Glove");
  }
  //swabs video
  if (instructionNumber == 3) {
    playVideo("Basic Anatomy Without Caption");
  }
  //parts ng catheter
  if (instructionNumber == 6) {
    playVideo("Foley Catheter And Drainage");
  }
  if (instructionNumber == 6) {
    sphereIndicator.visible = true;
    catheterInsertionSoundPlayed = false; // Reset the sound flag for catheter insertion
  }

  // SHOW URINE BAG ANIMATION BEFORE CLICKED THE INFLATED BUTTON
  // if (instructionNumber == 7) {
  //     showUrineBagAnimation();
  // }

  const container = new ThreeMeshUI.Block({
    width: 1.2,
    height: 0.5,
    padding: 0.05,
    fontFamily: FontJSON,
    fontTexture: FontImage,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 0.08,
  });

  container.position.set(0, 1.6, 1.5);
  container.rotation.y = Math.PI;
  scene.add(container);

  // Store reference to the current text panel
  currentTextPanel = container;

  const displayContent = instructions[instructionNumber];
  container.add(
    new ThreeMeshUI.Text({
      content: displayContent,
    })
  );

  // Play the corresponding audio file
  playVO(instructionNumber + 1);

  // Show deployment box for debugging during step 2
  showDeploymentBoxForDebugging();

  // Show arrows for the current step
  showArrowsForStep(instructionNumber);

  // For step 10 (completion), automatically enable the next button
  if (instructionNumber === 10) {
    nextActive = true;
    console.log(
      "Step 10 reached - Next button enabled for simulation completion"
    );
  }
}

function playVO(instructionNumber) {
  const audioPath = `voiceOvers/step_${instructionNumber}.mp3`;

  if (window.currentAudio) {
    window.currentAudio.pause();
    window.currentAudio.currentTime = 0;
  }

  const audio = new Audio(audioPath);
  audio.play();

  window.currentAudio = audio;
}

function playSFX(audioPath) {
  if (window.currentAudio) {
    window.currentAudio.pause();
    window.currentAudio.currentTime = 0;
  }

  const audio = new Audio(audioPath);
  audio.play().catch((error) => {
    console.error("Error attempting to play the audio:", error);
  });

  window.currentAudio = audio;
}

// Arrow Indicator Functions
function createArrowIndicator() {
  // Create a more stylized arrow shape like the reference image
  const arrowGroup = new THREE.Group();

  // Create arrow head (larger triangular part)
  const headGeometry = new THREE.ConeGeometry(0.008, 0.02, 6); // Much smaller
  const arrowMaterial = new THREE.MeshLambertMaterial({
    color: 0x030081, // New color as requested (#030081)
    transparent: true,
    opacity: 0.95,
    emissive: 0x030081, // Subtle glow with same color
  });
  const arrowHead = new THREE.Mesh(headGeometry, arrowMaterial);
  arrowHead.rotation.z = Math.PI; // Point down
  arrowHead.position.y = 0.01; // Position at bottom

  // Create arrow shaft (rectangular body)
  const shaftGeometry = new THREE.BoxGeometry(0.004, 0.025, 0.004); // Much smaller shaft
  const shaftMaterial = new THREE.MeshLambertMaterial({
    color: 0x030081, // New color as requested (#030081)
    transparent: true,
    opacity: 0.95,
    emissive: 0x030081, // Subtle glow with same color
  });
  const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
  shaft.position.y = 0.03; // Position above the head

  // Add both parts to the group
  arrowGroup.add(arrowHead);
  arrowGroup.add(shaft);

  // Add some initial animation properties
  arrowGroup.userData.originalY = 0;
  arrowGroup.userData.animationOffset = Math.random() * Math.PI * 2; // Random offset for animation

  return arrowGroup;
}

function positionArrowAboveTool(arrow, tool) {
  const toolBox = new THREE.Box3().setFromObject(tool);
  const center = toolBox.getCenter(new THREE.Vector3());
  const size = toolBox.getSize(new THREE.Vector3());

  // Position arrow above the tool (much closer since it's much smaller)
  arrow.position.copy(center);
  arrow.position.y = toolBox.max.y + 0.04; // 4cm above the tool (reduced from 8cm)
  arrow.userData.originalY = arrow.position.y;
}

function showArrowsForStep(stepNumber) {
  if (!arrowIndicators) {
    arrowIndicators = [];
    toolArrowMap = new Map();
  }

  hideAllArrows(); // First hide all existing arrows

  // Handle special case for step 0 - unwrap button
  if (stepNumber === 0 && unwrapContainer) {
    const arrow = createArrowIndicator();
    // Position arrow above the unwrap button
    arrow.position.copy(unwrapContainer.position);
    arrow.position.y += 0.04; // 4cm above (reduced for much smaller arrow)
    arrow.userData.originalY = arrow.position.y;
    scene.add(arrow);
    arrowIndicators.push(arrow);
    return;
  }

  const requiredToolPaths = stepRequiredTools[stepNumber.toString()] || [];

  requiredToolPaths.forEach((toolPath) => {
    let targetTool = null;

    // Handle special cases
    if (
      toolPath === "combined_catheter" &&
      currentCombinedCatheter &&
      currentCombinedCatheter.visible
    ) {
      targetTool = currentCombinedCatheter;
    } else if (
      toolPath === "deployed_deflated_catheter" &&
      deflatedCatheter &&
      deflatedCatheter.visible
    ) {
      // Handle deployed deflated catheter (step 7 - inflate balloon)
      targetTool = deflatedCatheter;
    } else if (
      toolPath === "deployed_inflated_catheter" &&
      inflatedCatheter &&
      inflatedCatheter.visible
    ) {
      // Handle deployed inflated catheter (step 8 - remove syringe)
      targetTool = inflatedCatheter;
    } else if (toolPath === "deployed_drapes") {
      // Handle deployed drapes
      const fullDrape = deployedInstruments.find(
        (obj) => obj.userData.path === "GLTF/deployed/FullDrape.glb"
      );
      const fenestratedDrape = deployedInstruments.find(
        (obj) => obj.userData.path === "GLTF/deployed/FenestratedDrape.glb"
      );

      if (fullDrape && fullDrape.visible) {
        const arrow = createArrowIndicator();
        positionArrowAboveTool(arrow, fullDrape);
        scene.add(arrow);
        arrowIndicators.push(arrow);
        toolArrowMap.set(fullDrape, arrow);
      }

      if (fenestratedDrape && fenestratedDrape.visible) {
        const arrow = createArrowIndicator();
        positionArrowAboveTool(arrow, fenestratedDrape);
        scene.add(arrow);
        arrowIndicators.push(arrow);
        toolArrowMap.set(fenestratedDrape, arrow);
      }
      return; // Skip the normal tool finding logic
    } else {
      // Find tool in kit array
      targetTool = kit.find((obj) => obj.userData.path === toolPath);
    }

    if (targetTool && targetTool.visible) {
      const arrow = createArrowIndicator();
      positionArrowAboveTool(arrow, targetTool);

      // Apply manual offset adjustments for special deployed catheter models
      if (toolPath === "deployed_deflated_catheter") {
        // Manual offset for deflated catheter (step 7) - adjust to point at syringe
        arrow.position.x += 0.13; // Adjust X offset as needed
        arrow.position.y -= 0.1; // Adjust Y offset as needed
        arrow.position.z -= 0.0; // Adjust Z offset as needed
        console.log(
          "Applied manual offset for deployed deflated catheter arrow"
        );
      } else if (toolPath === "deployed_inflated_catheter") {
        // Manual offset for inflated catheter (step 8) - adjust to point at syringe
        arrow.position.x += 0.13; // Adjust X offset as needed
        arrow.position.y -= 0.1; // Adjust Y offset as needed
        arrow.position.z -= 0.0; // Adjust Z offset as needed
        console.log(
          "Applied manual offset for deployed inflated catheter arrow"
        );
      }

      scene.add(arrow);
      arrowIndicators.push(arrow);
      toolArrowMap.set(targetTool, arrow);
    }
  });
}

function hideAllArrows() {
  if (!arrowIndicators) return;

  arrowIndicators.forEach((arrow) => {
    scene.remove(arrow);
    // Dispose of group children (geometries and materials)
    arrow.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  });
  arrowIndicators = [];
  if (toolArrowMap) toolArrowMap.clear();
}

function hideArrowForTool(tool) {
  if (!toolArrowMap || !arrowIndicators) return;

  // Find the top-level parent that might have an arrow
  let parentTool = tool;
  while (
    parentTool.parent &&
    !toolArrowMap.has(parentTool) &&
    parentTool.parent !== scene
  ) {
    parentTool = parentTool.parent;
  }

  if (toolArrowMap.has(parentTool)) {
    const arrow = toolArrowMap.get(parentTool);
    scene.remove(arrow);
    // Dispose of group children (geometries and materials)
    arrow.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });

    // Remove from arrays
    const index = arrowIndicators.indexOf(arrow);
    if (index > -1) {
      arrowIndicators.splice(index, 1);
    }
    toolArrowMap.delete(parentTool);
  }
}

function animateArrows() {
  if (!arrowIndicators) return;

  const time = Date.now() * 0.004; // Animation speed

  arrowIndicators.forEach((arrow) => {
    if (arrow.userData && arrow.userData.originalY !== undefined) {
      // Create bouncing animation with smaller movement for the compact arrow
      const bounce = Math.sin(time + arrow.userData.animationOffset) * 0.015; // 1.5cm bounce (reduced)
      arrow.position.y = arrow.userData.originalY + bounce;

      // Add slight rotation for more dynamic effect
      arrow.rotation.y =
        Math.sin(time * 2 + arrow.userData.animationOffset) * 0.1;

      // Add pulsing opacity effect to all children in the group
      const pulseOpacity =
        0.8 + Math.sin(time * 3 + arrow.userData.animationOffset) * 0.2;
      arrow.children.forEach((child) => {
        if (child.material) {
          child.material.opacity = pulseOpacity;
        }
      });
    }
  });
}

// FUNCTION TO TRIGGERED URINE BAG ANIMATION

// function showUrineBagAnimation() {
//     if (urineCatheter) {
//         urineCatheter.visible = true;

//         if (urineBagMixer && urineBagMixer._actions.length > 0) {
//             urineBagMixer._actions.forEach(action => {
//                 action.reset().play();
// //             });
// //         }
// //     }
// }

// let unwrapContainer = null; // Store the UI container

// Function to create the unwrap button
function unwrapButton() {
  unwrapContainer = new ThreeMeshUI.Block({
    justifyContent: "center",
    contentDirection: "row-reverse",
    fontFamily: FontJSON,
    fontTexture: FontImage,
    fontSize: 0.06,
    padding: 0.02,
    borderRadius: 0.11,
    backgroundOpacity: 0,
    backgroundColor: new THREE.Color(0x222222), // Darker background
  });

  unwrapContainer.position.set(0, 0.9, 1.1);
  unwrapContainer.rotation.y = Math.PI;
  unwrapContainer.rotation.x = 0.7;
  scene.add(unwrapContainer);

  const buttonOptions = {
    width: 0.4,
    height: 0.13,
    justifyContent: "center",
    offset: 0.05,
    margin: 0.02,
    borderRadius: 0.075,
    backgroundColor: new THREE.Color(0xffa500), // Orange color to make it pop
    backgroundOpacity: 1,
  };

  const hoveredStateAttributes = {
    state: "hovered",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0xffcc00), // Bright yellow on hover
      backgroundOpacity: 0.8,
      fontColor: new THREE.Color(0x000000),
      fontOpacity: 0.8,
    },
  };

  const idleStateAttributes = {
    state: "idle",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0xffa500),
      backgroundOpacity: 0,
      fontColor: new THREE.Color(0xffffff),
      fontOpacity: 0, // Makes the text disappear
    },
  };
  const buttonUnwrap = new ThreeMeshUI.Block(buttonOptions);

  buttonUnwrap.add(
    new ThreeMeshUI.Text({
      content: "UNWRAP",
      fontColor: new THREE.Color(0xffffff),
    })
  );

  buttonUnwrap.setupState({
    state: "selected",
    attributes: {
      offset: 0.02,
      backgroundColor: new THREE.Color(0xff6600), // Darker orange when clicked
      fontColor: new THREE.Color(0x000000),
    },
    onSet: () => {
      //unwrap Button pressed
      const foleyPack = envMaterials.find(
        (obj) =>
          obj.userData.path === "GLTF/environment/1. Foley Pack_Whole.glb"
      );
      if (foleyPack) {
        scene.remove(foleyPack);
        scene.remove(unwrapContainer);

        // Hide arrows when unwrap button is clicked
        hideAllArrows();

        unwrapContainer = null;
        envMaterials = envMaterials.filter((obj) => obj !== foleyPack);
        showKit(); // Make kit visible instead of loading it
        makePanel();
      } else {
        // console.log("Foley Pack not found.");
      }
      if (instructionNumber == 0) {
        nextActive = true;
      }
      // removeUnwrapButton();
    },
  });

  buttonUnwrap.setupState(hoveredStateAttributes);
  buttonUnwrap.setupState(idleStateAttributes);

  unwrapContainer.add(buttonUnwrap);
  objsToTest.push(buttonUnwrap);
}

//wear/remove gloves
function toggleHandColor(hand) {
  if (!hand) return;

  hand.traverse((child) => {
    if (child.isMesh) {
      if (child.material.color.getHex() === 0x0000ff) {
        // Change back to default color (assuming white)
        child.material.color.set(0xffffff);
      } else {
        // Change to blue
        child.material.color.set(0x98ff98);
      }
    }
  });
}

function outputPanel(message, isError) {
  // Create a GUI for Output feedback
  // Remove the last text panel if it exists
  if (currentOutputPanel) {
    scene.remove(currentOutputPanel);
    currentOutputPanel = null;
  }

  const container = new ThreeMeshUI.Block({
    ref: "container",
    padding: 0.025,
    fontFamily: FontJSON,
    fontTexture: FontImage,
    fontColor: new THREE.Color(0xffffff),
    backgroundOpacity: 0,
  });

  container.position.set(1.75, 1.5, 0.25);
  container.rotation.y = -0.5 * Math.PI;
  scene.add(container);

  //
  // Store reference to the current text panel
  currentOutputPanel = container;

  const info = new ThreeMeshUI.Block({
    height: 0.2,
    width: 1.5,
    margin: 0.025,
    justifyContent: "center",
    fontSize: 0.035,
  });

  if (isError) {
    // adding a red ! if error

    const imageBlock = new ThreeMeshUI.Block({
      height: 0.5,
      width: 0.5,
    });

    container.add(imageBlock);

    const loader = new THREE.TextureLoader();

    loader.load("/warningSign.png", (texture) => {
      imageBlock.set({ backgroundTexture: texture });
    });

    info.add(
      new ThreeMeshUI.Text({
        content: "ERROR OCCURED\n",
        fontSize: 0.05,
      })
    );
  }

  info.add(
    new ThreeMeshUI.Text({
      content: message,
    })
  );
  container.add(info);

  // Add a timeout to remove the panel after 3 seconds
  setTimeout(() => {
    if (currentOutputPanel === container) {
      scene.remove(container);
      currentOutputPanel = null;
    }
  }, 3000);
}

function updateButtons() {
  let intersect;

  if (renderer.xr.isPresenting) {
    // Check both controllers for interaction
    [controller1, controller2].forEach((controller) => {
      if (!controller) return;

      const tempMatrix = new THREE.Matrix4();
      tempMatrix.identity().extractRotation(controller.matrixWorld);

      const origin = new THREE.Vector3();
      controller.getWorldPosition(origin);

      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyMatrix4(tempMatrix);

      raycaster.set(origin, direction);

      const localIntersect = raycast();

      if (
        localIntersect &&
        (!intersect || localIntersect.distance < intersect.distance)
      ) {
        intersect = localIntersect;
      }
    });
  } else if (mouse.x !== null && mouse.y !== null) {
    raycaster.setFromCamera(mouse, camera);
    intersect = raycast();
  }

  // Update targeted button state (if any)
  if (intersect && intersect.object.isUI) {
    if (selectState) {
      intersect.object.setState("selected");
    } else {
      intersect.object.setState("hovered");
    }
  }

  // Update non-targeted buttons state
  objsToTest.forEach((obj) => {
    if ((!intersect || obj !== intersect.object) && obj.isUI) {
      obj.setState("idle");
    }
  });
}

function updateLaserColors() {
  // Update laser color based on intersections with interactive objects
  [controller1, controller2].forEach((controller) => {
    if (!controller) return;

    // Find the laser mesh in the controller's children
    const laser = controller.children.find(
      (child) =>
        child.type === "Mesh" && child.geometry.type === "CylinderGeometry"
    );

    if (!laser) return;

    // Get intersections for this controller
    const intersections = getIntersections(controller);

    // Check if we're pointing at any interactive object
    const hasValidTarget = intersections.length > 0;

    // Update laser and base sphere colors
    if (hasValidTarget) {
      // Green when targeting interactive objects
      laser.material.color.setHex(0x00ff00);
      // Update base sphere color too
      const baseSphere = controller.children.find(
        (child) =>
          child.type === "Mesh" && child.geometry.type === "SphereGeometry"
      );
      if (baseSphere) {
        baseSphere.material.color.setHex(0x00ff00);
      }
    } else {
      // Red when not pointing at anything interactive
      laser.material.color.setHex(0xff0000);
      // Update base sphere color too
      const baseSphere = controller.children.find(
        (child) =>
          child.type === "Mesh" && child.geometry.type === "SphereGeometry"
      );
      if (baseSphere) {
        baseSphere.material.color.setHex(0xff0000);
      }
    }
  });
}

function raycast() {
  return objsToTest.reduce((closestIntersection, obj) => {
    const intersection = raycaster.intersectObject(obj, true);
    if (!intersection[0]) return closestIntersection;

    if (
      !closestIntersection ||
      intersection[0].distance < closestIntersection.distance
    ) {
      intersection[0].object = obj;
      return intersection[0];
    }
    return closestIntersection;
  }, null);
}

/*** end of UI */

/**
 * start of loading meshes
 */

// INSERT loading meshes stationary meshes
//loading environment ( initially nongrabbable )
function loadDeployed() {
  loadingManager.registerLoader();

  const deployedName = [
    { path: "GLTF/deployed/FenestratedDrape.glb" },
    { path: "GLTF/deployed/FullDrape.glb" },
    { path: "GLTF/deployed/4. Lubricant.glb" },
  ];

  let loadedCount = 0;
  const totalItems = deployedName.length;

  deployedName.forEach(({ path }) => {
    loader.load(
      path,
      (gltf) => {
        const newObject = gltf.scene;
        deployedInstruments.push(newObject);
        scene.add(newObject);
        newObject.position.x += offsetValue;

        newObject.userData.path = path;
        newObject.visible = false;

        // Customize based on which file is loaded
        if (path === "GLTF/deployed/4. Lubricant.glb") {
          newObject.position.set(1, -0.02, -0.05);
          newObject.scale.set(0.02, 0.02, 0.02); // example scale
        } else if (path === "GLTF/deployed/FenestratedDrape.glb") {
          newObject.position.set(1.25, 0, -0.1); // adjust as needed (X,Y,Z)
          newObject.scale.set(1, 1, 1); // adjust as needed
        } else if (path === "GLTF/deployed/FullDrape.glb") {
          newObject.position.set(1.25, 0, 0); // adjust as needed
          newObject.scale.set(1, 1, 1); // adjust as needed
        }

        console.log(
          `${path} loaded at`,
          newObject.position,
          "scale:",
          newObject.scale
        );

        loadedCount++;
        if (loadedCount === totalItems) {
          loadingManager.completeLoader("Deployed");
        }
      },
      undefined,
      (error) => console.error(`Error loading ${path}`, error)
    );
  });
}

// Load Combined Catheter Models for Step 5
// Note: Using these GLB files:
// 1. 'GLTF/deployed/Catheter_With_Syringe.glb' - Combined catheter + syringe model
// 2. 'GLTF/deployed/Catheter_with_Syringe_and_Bag.glb' - Combined catheter + syringe + urine bag model
function loadCombinedCatheterModels() {
  loadingManager.registerLoader();

  console.log("Loading combined catheter models...");

  let loadedCount = 0;
  const totalItems = 2;

  // Load catheter with syringe model
  loader.load(
    "GLTF/deployed/Catheter_With_Syringe.glb",
    (gltf) => {
      // Extract the main mesh from the scene
      catheterWithSyringeModel = gltf.scene;
      catheterWithSyringeModel.userData.path =
        "GLTF/deployed/Catheter_With_Syringe.glb";
      catheterWithSyringeModel.visible = false; // Initially hidden
      catheterWithSyringeModel.position.x += offsetValue; // Apply offset like other models

      // Set layer 0 for grabbing and ensure all children are also on layer 0
      catheterWithSyringeModel.traverse((child) => {
        child.layers.set(0);
        // Make sure materials are properly set up
        if (child.isMesh) {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                mat.needsUpdate = true;
              });
            } else {
              child.material.needsUpdate = true;
            }
          }
        }
      });

      scene.add(catheterWithSyringeModel);
      console.log("Catheter with syringe model loaded successfully");

      loadedCount++;
      if (loadedCount === totalItems) {
        loadingManager.completeLoader("CombinedCatheter");
      }
    },
    (progress) => {
      console.log("Loading progress for Catheter_With_Syringe.glb:", progress);
    },
    (error) => {
      console.error("Error loading catheter with syringe model:", error);
    }
  );

  // Load catheter with syringe and urine bag model
  loader.load(
    "GLTF/deployed/Catheter_with_Syringe_and_Bag.glb",
    (gltf) => {
      // Extract the main mesh from the scene
      catheterWithSyringeAndBagModel = gltf.scene;
      catheterWithSyringeAndBagModel.userData.path =
        "GLTF/deployed/Catheter_with_Syringe_and_Bag.glb";
      catheterWithSyringeAndBagModel.visible = false; // Initially hidden
      catheterWithSyringeAndBagModel.position.x += offsetValue; // Apply offset like other models

      // Set layer 0 for grabbing and ensure all children are also on layer 0
      catheterWithSyringeAndBagModel.traverse((child) => {
        child.layers.set(0);
        // Make sure materials are properly set up
        if (child.isMesh) {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                mat.needsUpdate = true;
              });
            } else {
              child.material.needsUpdate = true;
            }
          }
        }
      });

      scene.add(catheterWithSyringeAndBagModel);
      console.log("Catheter with syringe and bag model loaded successfully");

      loadedCount++;
      if (loadedCount === totalItems) {
        loadingManager.completeLoader("CombinedCatheter");
      }
    },
    (progress) => {
      console.log(
        "Loading progress for Catheter_with_Syringe_and_Bag.glb:",
        progress
      );
    },
    (error) => {
      console.error(
        "Error loading catheter with syringe and bag model:",
        error
      );
    }
  );
}

// function for loading catheter kit
function loadKit() {
  loadingManager.registerLoader();

  const catheterKit = [
    { path: "GLTF/catheterKit/2. Empty Pack.glb" },
    { path: "GLTF/catheterKit/3. Saline Syringe.glb" },
    { path: "GLTF/catheterKit/4. Lubricant.glb" },
    { path: "GLTF/catheterKit/5. Swabsticks1.glb" },
    { path: "GLTF/catheterKit/6. Swabsticks2.glb" },
    { path: "GLTF/catheterKit/7. Swabsticks3.glb" },
    { path: "GLTF/catheterKit/8. Povidone Iodine Solution.glb" },
    { path: "GLTF/catheterKit/9. Urine Collection Bag.glb" },
    { path: "GLTF/catheterKit/10. Catheter.glb" },
    { path: "GLTF/catheterKit/11. Sterile Gloves_Closed.glb" },
    { path: "GLTF/catheterKit/12. Full Drape.glb" },
    { path: "GLTF/catheterKit/13. Fenestrated Drape.glb" },
  ];

  let loadedCount = 0;
  const totalItems = catheterKit.length;

  catheterKit.forEach(({ path }) => {
    loader.load(
      path,
      (gltf) => {
        const newObject = gltf.scene;
        newObject.position.x += offsetValue;
        newObject.userData.path = path;

        // Set layer 0 for grabbable kit objects and their children
        // Empty pack should not be grabbable
        if (path !== "GLTF/catheterKit/2. Empty Pack.glb") {
          newObject.traverse((child) => child.layers.set(0));
        } else {
          // Empty pack is not grabbable - keep on default layer
          newObject.userData.grabbable = false;
        }

        // Set visibility to false initially
        newObject.visible = false;

        // Add all kit objects including the empty pack to the kit array
        kit.push(newObject);
        scene.add(newObject);

        loadedCount++;
        // When all kit items are loaded, complete the loader
        if (loadedCount === totalItems) {
          loadingManager.completeLoader("Kit");
        }
      },
      undefined,
      (error) => console.error(`Error loading ${path}`, error)
    );
  });
}

// Function to make kit items visible (called when unwrap button is pressed)
function showKit() {
  kit.forEach((obj) => {
    if (obj) {
      obj.visible = true;
    }
  });

  // Show arrows for current step when kit becomes visible
  setTimeout(() => {
    showArrowsForStep(instructionNumber);
  }, 100); // Small delay to ensure everything is ready
}

function loadInsertedCatheter() {
  loader.load("GLTF/deployed/Catheter Deployed_Deflated.glb", (gltf) => {
    deflatedCatheter = gltf.scene;
    deflatedCatheter.userData.path =
      "GLTF/deployed/Catheter Deployed_Deflated.glb"; // Save path data
    deflatedCatheter.position.x += offsetValue;
    scene.add(deflatedCatheter);
    deflatedCatheter.visible = true;
    // kit.push(deflatedCatheter); // Add to kit array for collision detection
  });

  loader.load("GLTF/deployed/Catheter Deployed_Inflated.glb", (gltf) => {
    inflatedCatheter = gltf.scene;
    inflatedCatheter.userData.path =
      "GLTF/deployed/Catheter Deployed_Inflated.glb"; // Save path data
    inflatedCatheter.position.x += offsetValue;
    scene.add(inflatedCatheter);
    inflatedCatheter.visible = false; // Initially hide the inflated catheter
    // kit.push(inflatedCatheter); // Add to kit array for collision detection
  });

  loader.load("GLTF/deployed/Urine Stage 1.glb", (gltf) => {
    urineCatheter = gltf.scene;
    urineCatheter.userData.path = "GLTF/deployed/Urine Stage 1.glb"; // Save path data
    urineCatheter.position.x += offsetValue;
    scene.add(urineCatheter);
    urineCatheter.visible = true; // Initially hide the urine catheter
    // kit.push(inflatedCatheter); // Add to kit array for collision detection

    // Setup AnimationMixer and play animation
    urineBagMixer = new THREE.AnimationMixer(urineCatheter);

    if (gltf.animations && gltf.animations.length > 0) {
      gltf.animations.forEach((clip) => {
        const action = urineBagMixer.clipAction(clip);
        action.play();
      });
    } else {
      console.warn("No animations found in Urine Stage 1.glb");
    }
  });

  loader.load("GLTF/deployed/Catheter Deployed_No Syringe.glb", (gltf) => {
    noSyringeCatheter = gltf.scene;
    noSyringeCatheter.userData.path =
      "GLTF/deployed/Catheter Deployed_No Syringe.glb"; // Save path data
    noSyringeCatheter.position.x += offsetValue;
    scene.add(noSyringeCatheter);
    noSyringeCatheter.visible = false;
    // kit.push(noSyringeCatheter);
  });
}

// function inflateCatheter() {
//     inflatedCatheter.visible = true;
//     deflatedCatheter.visible = false;
// }

/**** end of loading meshes */

// load open gloves model
function loadGlovesOpen() {
  const sterileGlovesClosed = kit.find(
    (obj) =>
      obj.userData.path === "GLTF/catheterKit/11. Sterile Gloves_Closed.glb"
  );
  loader.load("GLTF/deployed/Open Gloves_New1.glb", (gltf) => {
    const glovesOpen = gltf.scene;
    glovesOpen.position.x += offsetValue; // Adjust position as needed
    glovesOpen.userData.path = "GLTF/deployed/Open Gloves_New1.glb";
    // glovesOpen.position.set(-0.3, 0.82, 1.1);
    kit.push(glovesOpen);
    scene.add(glovesOpen);
  });
  if (sterileGlovesClosed) {
    scene.remove(sterileGlovesClosed);
    sterileGlovesClosed.visible = false; // Hide the closed gloves
    kit = kit.filter((obj) => obj !== sterileGlovesClosed);
  }
}

// Start the lubricant animation
function animateLubricant() {
  lubricantObject = kit.find(
    (obj) => obj?.userData?.path === "GLTF/catheterKit/4. Lubricant.glb"
  );
  deployedLubricant = deployedInstruments.find(
    (obj) => obj?.userData?.path === "GLTF/deployed/4. Lubricant.glb"
  );
  if (!lubricantObject || !deployedLubricant) {
    console.error("Lubricant object or deployed lubricant not found");
    return;
  }
  lubricantObject.visible = false;
  deployedLubricant.visible = true;
  playSFX("/sfx/ping-sfx.mp3");
}

//lubricant deployed
// function lubricantVisible(){
//     const params = {
//         color: '#ffffff',
//         scale: 1,
//         flowX: 0,
//         flowY: 0
//     };
//     const waterGeometry = new THREE.PlaneGeometry( 0.143 , 0.047 );

//     water = new Water( waterGeometry, {
//         color: params.color,
//         scale: params.scale,
//         flowDirection: new THREE.Vector2( params.flowX, params.flowY ),
//         textureWidth: 1024,
//         textureHeight: 1024
//     } );

//     water.position.set (-0.102, 0.855, 1.145);
//     water.rotation.x = Math.PI * - 0.5;
//     scene.add( water );
// }

// function checkCatheterCollisionWithWater() {
//     const catheter = kit.find(obj => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb");
//     if (!catheter) return false;

//     // Create bounding boxes for both the catheter and water
//     const catheterBox = new THREE.Box3().setFromObject(catheter);

//     // Check if the bounding boxes intersect
//     return catheterBox.intersectsBox(kitboundingBox);
// }

function checkCatheterCollisionWithSyringe() {
  const catheter = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb"
  );
  const syringe = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/3. Saline Syringe.glb"
  );

  if (!catheter || !syringe) {
    // Don't spam console with missing object messages
    return false;
  }

  // Only check collision if both objects are visible
  if (!catheter.visible || !syringe.visible) {
    return false;
  }

  // Create bounding boxes for both the catheter and syringe
  const catheterBox = new THREE.Box3().setFromObject(catheter);
  const syringeBox = new THREE.Box3().setFromObject(syringe);

  // Expand the collision boxes slightly to make attachment easier
  catheterBox.expandByScalar(0.02);
  syringeBox.expandByScalar(0.02);

  const isColliding = catheterBox.intersectsBox(syringeBox);

  if (isColliding) {
    console.log(
      "Catheter and syringe are colliding! Calling attachSyringeToCatheter..."
    );
  }

  return isColliding;
}
function checkCatheterCollisionWithUrineBag() {
  const urineBag = kit.find(
    (obj) =>
      obj.userData.path === "GLTF/catheterKit/9. Urine Collection Bag.glb"
  );

  // Check collision with the current combined catheter (should be catheter+syringe at this point)
  if (
    !urineBag ||
    !currentCombinedCatheter ||
    !currentCombinedCatheter.visible
  ) {
    return false;
  }

  // Create bounding boxes for both the urine bag and current combined catheter
  const urineBagBox = new THREE.Box3().setFromObject(urineBag);
  const combinedCatheterBox = new THREE.Box3().setFromObject(
    currentCombinedCatheter
  );

  // Expand the collision boxes slightly to make attachment easier
  urineBagBox.expandByScalar(0.02);
  combinedCatheterBox.expandByScalar(0.02);

  // Check if the bounding boxes intersect
  const isColliding = urineBagBox.intersectsBox(combinedCatheterBox);

  if (isColliding) {
    console.log("Urine bag and combined catheter are colliding!");
  }

  return isColliding;
}
function attachSyringeToCatheter() {
  console.log("=== REPLACING CATHETER + SYRINGE ===");

  const syringe = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/3. Saline Syringe.glb"
  );
  const catheter = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb"
  );

  console.log("Found syringe:", !!syringe);
  console.log("Found catheter:", !!catheter);
  console.log("Found catheterWithSyringeModel:", !!catheterWithSyringeModel);

  if (!syringe || !catheter || !catheterWithSyringeModel) {
    console.error(
      "Missing objects - Syringe:",
      !!syringe,
      "Catheter:",
      !!catheter,
      "Combined model:",
      !!catheterWithSyringeModel
    );
    return;
  }

  // Find which controller is holding either object
  let activeController = null;
  let detachmentActions = [];

  grabbedObjects.forEach((object, controller) => {
    if (object === catheter) {
      activeController = controller;
      detachmentActions.push(() => {
        console.log("Detaching catheter from controller");
        scene.attach(catheter);
        grabbedObjects.delete(controller);
      });
    }
    if (object === syringe) {
      if (!activeController) activeController = controller; // Use syringe controller if no catheter controller
      detachmentActions.push(() => {
        console.log("Detaching syringe from controller");
        scene.attach(syringe);
        grabbedObjects.delete(controller);
      });
    }
  });

  // Execute all detachments
  detachmentActions.forEach((action) => action());

  // Hide/remove the original objects
  catheter.visible = false;
  syringe.visible = false;
  console.log("Hidden original catheter and syringe");

  // Position the combined model at the catheter's position
  if (catheter.parent) {
    const catheterWorldPos = new THREE.Vector3();
    const catheterWorldQuat = new THREE.Quaternion();
    catheter.getWorldPosition(catheterWorldPos);
    catheter.getWorldQuaternion(catheterWorldQuat);

    catheterWithSyringeModel.position.copy(catheterWorldPos);
    catheterWithSyringeModel.quaternion.copy(catheterWorldQuat);
  }

  // Show the combined model
  catheterWithSyringeModel.visible = true;
  currentCombinedCatheter = catheterWithSyringeModel;
  console.log("Made combined catheter+syringe visible");

  // Attach combined model to the active controller
  if (activeController) {
    // Store the desired world transform before attachment
    const targetWorldPos = new THREE.Vector3();
    const targetWorldQuat = new THREE.Quaternion();
    catheterWithSyringeModel.getWorldPosition(targetWorldPos);
    catheterWithSyringeModel.getWorldQuaternion(targetWorldQuat);

    // Attach to controller first (this will change the coordinate system)
    activeController.attach(catheterWithSyringeModel);

    // Calculate the local transform needed to achieve the target world transform
    const controllerWorldMatrix = new THREE.Matrix4();
    controllerWorldMatrix.copy(activeController.matrixWorld);

    // Get the inverse of the controller's world matrix
    const controllerInverseMatrix = new THREE.Matrix4();
    controllerInverseMatrix.copy(controllerWorldMatrix).invert();

    // Create a matrix for the target world transform
    const targetWorldMatrix = new THREE.Matrix4();
    targetWorldMatrix.compose(
      targetWorldPos,
      targetWorldQuat,
      new THREE.Vector3(1, 1, 1)
    );

    // Calculate the local matrix relative to the controller
    const localMatrix = new THREE.Matrix4();
    localMatrix.multiplyMatrices(controllerInverseMatrix, targetWorldMatrix);

    // Extract position, rotation, and scale from the local matrix
    const localPos = new THREE.Vector3();
    const localQuat = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    localMatrix.decompose(localPos, localQuat, localScale);

    // Apply the calculated local transform
    catheterWithSyringeModel.position.copy(localPos);
    catheterWithSyringeModel.quaternion.copy(localQuat);
    catheterWithSyringeModel.scale.copy(localScale);

    // Apply additional offset for better ergonomics (in local space)
    catheterWithSyringeModel.position.x += 0.25; // Reduced offset for better positioning
    catheterWithSyringeModel.position.y -= 0.21;

    grabbedObjects.set(activeController, catheterWithSyringeModel);

    console.log(
      "Combined catheter+syringe attached to controller with proper rotation"
    );
    outputPanel("Catheter and syringe combined!", false);
  } else {
    // If no controller was holding either, just position it at the catheter's location
    scene.attach(catheterWithSyringeModel);
    console.log(
      "No controller found, positioned combined catheter at original location"
    );
    outputPanel("Catheter and syringe combined!", false);
  }

  // Hide arrows for the individual components
  hideArrowForTool(catheter);
  hideArrowForTool(syringe);
}
function attachUrineBagToCatheter() {
  console.log("=== REPLACING CATHETER+SYRINGE + URINE BAG ===");

  const urineBag = kit.find(
    (obj) =>
      obj.userData.path === "GLTF/catheterKit/9. Urine Collection Bag.glb"
  );

  console.log("Found urine bag:", !!urineBag);
  console.log(
    "Found catheterWithSyringeAndBagModel:",
    !!catheterWithSyringeAndBagModel
  );
  console.log("Current combined catheter:", !!currentCombinedCatheter);

  if (
    !urineBag ||
    !catheterWithSyringeAndBagModel ||
    !currentCombinedCatheter
  ) {
    console.error(
      "Missing objects - Urine bag:",
      !!urineBag,
      "Full combined model:",
      !!catheterWithSyringeAndBagModel,
      "Current combined:",
      !!currentCombinedCatheter
    );
    return;
  }

  // Find which controller is holding either object
  let activeController = null;
  let detachmentActions = [];

  grabbedObjects.forEach((object, controller) => {
    if (object === currentCombinedCatheter) {
      activeController = controller;
      detachmentActions.push(() => {
        console.log("Detaching combined catheter+syringe from controller");
        scene.attach(currentCombinedCatheter);
        grabbedObjects.delete(controller);
      });
    }
    if (object === urineBag) {
      if (!activeController) activeController = controller; // Use urine bag controller if no combined controller
      detachmentActions.push(() => {
        console.log("Detaching urine bag from controller");
        scene.attach(urineBag);
        grabbedObjects.delete(controller);
      });
    }
  });

  // Execute all detachments
  detachmentActions.forEach((action) => action());

  // Store the position and rotation of the current combined model
  const currentPos = new THREE.Vector3();
  const currentQuat = new THREE.Quaternion();

  if (currentCombinedCatheter) {
    currentCombinedCatheter.getWorldPosition(currentPos);
    currentCombinedCatheter.getWorldQuaternion(currentQuat);
    currentCombinedCatheter.visible = false;
  }

  urineBag.visible = false;
  console.log("Hidden previous combined catheter and urine bag");

  // Apply the position and rotation to the new combined model
  catheterWithSyringeAndBagModel.position.copy(currentPos);
  catheterWithSyringeAndBagModel.quaternion.copy(currentQuat);

  // Show the fully combined model
  catheterWithSyringeAndBagModel.visible = true;
  currentCombinedCatheter = catheterWithSyringeAndBagModel;
  console.log("Made combined catheter+syringe+bag visible");

  // Attach fully combined model to the active controller
  if (activeController) {
    // Store the desired world transform before attachment
    const targetWorldPos = new THREE.Vector3();
    const targetWorldQuat = new THREE.Quaternion();
    catheterWithSyringeAndBagModel.getWorldPosition(targetWorldPos);
    catheterWithSyringeAndBagModel.getWorldQuaternion(targetWorldQuat);

    // Attach to controller first (this will change the coordinate system)
    activeController.attach(catheterWithSyringeAndBagModel);

    // Calculate the local transform needed to achieve the target world transform
    const controllerWorldMatrix = new THREE.Matrix4();
    controllerWorldMatrix.copy(activeController.matrixWorld);

    // Get the inverse of the controller's world matrix
    const controllerInverseMatrix = new THREE.Matrix4();
    controllerInverseMatrix.copy(controllerWorldMatrix).invert();

    // Create a matrix for the target world transform
    const targetWorldMatrix = new THREE.Matrix4();
    targetWorldMatrix.compose(
      targetWorldPos,
      targetWorldQuat,
      new THREE.Vector3(1, 1, 1)
    );

    // Calculate the local matrix relative to the controller
    const localMatrix = new THREE.Matrix4();
    localMatrix.multiplyMatrices(controllerInverseMatrix, targetWorldMatrix);

    // Extract position, rotation, and scale from the local matrix
    const localPos = new THREE.Vector3();
    const localQuat = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    localMatrix.decompose(localPos, localQuat, localScale);

    // Apply the calculated local transform
    catheterWithSyringeAndBagModel.position.copy(localPos);
    catheterWithSyringeAndBagModel.quaternion.copy(localQuat);
    catheterWithSyringeAndBagModel.scale.copy(localScale);

    // Apply additional offset for better ergonomics (in local space)
    catheterWithSyringeAndBagModel.position.x += 0.02; // Consistent offset
    catheterWithSyringeAndBagModel.position.y -= 0.05;

    grabbedObjects.set(activeController, catheterWithSyringeAndBagModel);

    console.log(
      "Combined catheter+syringe+bag attached to controller with proper rotation"
    );
    outputPanel("Urine bag attached! Ready to insert.", false);
  } else {
    // If no controller was holding either, position it appropriately
    scene.attach(catheterWithSyringeAndBagModel);
    console.log(
      "No controller found, positioned combined catheter+syringe+bag at original location"
    );
    outputPanel("Urine bag attached! Ready to insert.", false);
  }

  // Hide arrows for the individual components
  hideArrowForTool(urineBag);
  if (currentCombinedCatheter) hideArrowForTool(currentCombinedCatheter);
}
// Function to check if the combined catheter intersects with insertionBox
function checkCollisionWithInsertionBox() {
  if (
    !currentCombinedCatheter ||
    !insertionBox ||
    !currentCombinedCatheter.visible
  )
    return false;

  // Create bounding boxes for both the combined catheter and insertionBox
  const combinedCatheterBounds = new THREE.Box3().setFromObject(
    currentCombinedCatheter
  );
  const insertionBoxBounds = new THREE.Box3().setFromObject(insertionBox);

  // Check if the bounding boxes intersect
  const isColliding = combinedCatheterBounds.intersectsBox(insertionBoxBounds);

  // Only play sound effect when there's an actual collision and it hasn't been played yet
  if (isColliding && !catheterInsertionSoundPlayed) {
    playSFX("/sfx/ping-sfx.mp3");
    catheterInsertionSoundPlayed = true;
  }

  return isColliding;
}

function checkSwabsCollision() {
  const swab1 = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/5. Swabsticks1.glb"
  );
  const swab2 = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/6. Swabsticks2.glb"
  );
  const swab3 = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/7. Swabsticks3.glb"
  );

  if (swab1 && !swab1Collided) {
    // Only check if not already collided
    const swab1Box = new THREE.Box3().setFromObject(swab1);
    if (swab1Box.intersectsBox(swabsBoundingBox)) {
      swab1Collided = true;
      console.log("Swab 1 collided with the swabs bounding box");
      outputPanel("Swabsticks is successfully used.", false);
      playSFX("/sfx/ping-sfx.mp3");
    }
  }

  if (swab2 && !swab2Collided) {
    // Only check if not already collided
    const swab2Box = new THREE.Box3().setFromObject(swab2);
    if (swab2Box.intersectsBox(swabsBoundingBox)) {
      swab2Collided = true;
      console.log("Swab 2 collided with the swabs bounding box");
      outputPanel("Swabsticks is successfully used.", false);
      playSFX("/sfx/ping-sfx.mp3");
    }
  }

  if (swab3 && !swab3Collided) {
    // Only check if not already collided
    const swab3Box = new THREE.Box3().setFromObject(swab3);
    if (swab3Box.intersectsBox(swabsBoundingBox)) {
      swab3Collided = true;
      console.log("Swab 3 collided with the swabs bounding box");
      outputPanel("Swabsticks is successfully used.", false);
      playSFX("/sfx/ping-sfx.mp3");
    }
  }

  if (swab1Collided && swab2Collided && swab3Collided) {
    console.log("All swabs collided with the swabs bounding box");
    console.log("Cleaned the perineal area with the swabs");
    nextActive = true; // Allow progression to the next step
    outputPanel("Swabsticks is successfully used.", false);
  }
}

// Remove syringe from deployed Catheter
function removeSyringeFromCatheter() {
  if (inflatedCatheter.visible) {
    inflatedCatheter.visible = false;
    noSyringeCatheter.visible = true;
  }
}

//
function checkDrapesCollisionWithTrashcan() {
  const deployedFullDrape = deployedInstruments.find(
    (obj) => obj.userData.path === "GLTF/deployed/FullDrape.glb"
  );
  const deployedFenestratedDrape = deployedInstruments.find(
    (obj) => obj.userData.path === "GLTF/deployed/FenestratedDrape.glb"
  );
  const trashcan = envMaterials.find(
    (obj) => obj.userData.path === "GLTF/environment/Medical Trashcan.glb"
  );

  if (!deployedFullDrape || !deployedFenestratedDrape || !trashcan) {
    console.error("One or more objects (drapes or trashcan) are missing");
    return false;
  }

  // Create bounding boxes for the drapes and trashcan
  const fullDrapeBox = new THREE.Box3().setFromObject(deployedFullDrape);
  const fenestratedDrapeBox = new THREE.Box3().setFromObject(
    deployedFenestratedDrape
  );
  const trashcanBox = new THREE.Box3().setFromObject(trashcan);

  // Check if either drape intersects with the trashcan
  const fullDrapeCollides = fullDrapeBox.intersectsBox(trashcanBox);
  const fenestratedDrapeCollides =
    fenestratedDrapeBox.intersectsBox(trashcanBox);

  if (!fulldrapeDisposed) {
    if (fullDrapeCollides) {
      console.log("Deployed Full Drape collided with the trashcan");
      playSFX("/sfx/trashcan_sfx.wav");
      deployedFullDrape.visible = false; // Hide the full drape
      scene.remove(deployedFullDrape);

      // Hide arrow for this drape
      hideArrowForTool(deployedFullDrape);

      fulldrapeDisposed = true;
    }
  }

  if (!fenestratedDrapeDisposed) {
    if (fenestratedDrapeCollides) {
      console.log("Deployed Fenestrated Drape collided with the trashcan");
      playSFX("/sfx/trashcan_sfx.wav");
      deployedFenestratedDrape.visible = false; // Hide the fenestrated drape
      deployedFenestratedDrape.position.set(4, 4, 4);
      scene.remove(deployedFenestratedDrape);

      // Hide arrow for this drape
      hideArrowForTool(deployedFenestratedDrape);

      fenestratedDrapeDisposed = true;
    }
  }

  if (fulldrapeDisposed && fenestratedDrapeDisposed) {
    nextActive = true; // Allow progression to the next step
  }

  // Find swab objects in kit array (same pattern as drapes above)
  const swab1 = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/5. Swabsticks1.glb"
  );
  const swab2 = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/6. Swabsticks2.glb"
  );
  const swab3 = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/7. Swabsticks3.glb"
  );

  if (swab1 && !swab1Disposed) {
    const swab1Box = new THREE.Box3().setFromObject(swab1);
    swab1Box.expandByScalar(0.05); // Expand bounding box to make disposal easier
    if (swab1Box.intersectsBox(trashcanBox)) {
      console.log("Swabsticks1 collided with the trashcan");
      playSFX("/sfx/trashcan_sfx.wav");
      swab1.visible = false; // Hide swabsticks1
      scene.remove(swab1);

      // Hide arrow for this swab
      hideArrowForTool(swab1);

      swab1Disposed = true;
    }
  }

  if (swab2 && !swab2Disposed) {
    const swab2Box = new THREE.Box3().setFromObject(swab2);
    swab2Box.expandByScalar(0.05); // Expand bounding box to make disposal easier
    if (swab2Box.intersectsBox(trashcanBox)) {
      console.log("Swabsticks2 collided with the trashcan");
      playSFX("/sfx/trashcan_sfx.wav");
      swab2.visible = false; // Hide swabsticks2
      scene.remove(swab2);

      // Hide arrow for this swab
      hideArrowForTool(swab2);

      swab2Disposed = true;
    }
  }

  if (swab3 && !swab3Disposed) {
    const swab3Box = new THREE.Box3().setFromObject(swab3);
    swab3Box.expandByScalar(0.05); // Expand bounding box to make disposal easier
    if (swab3Box.intersectsBox(trashcanBox)) {
      console.log("Swabsticks3 collided with the trashcan");
      playSFX("/sfx/trashcan_sfx.wav");
      swab3.visible = false; // Hide swabsticks3
      scene.remove(swab3);

      // Hide arrow for this swab
      hideArrowForTool(swab3);

      swab3Disposed = true;
    }
  }

  return fullDrapeCollides || fenestratedDrapeCollides;
}

// Function to apply green glow effect to deployed drapes
function applyGreenGlow(drapeObject) {
  if (!drapeObject) return;

  drapeObject.traverse((child) => {
    if (child.isMesh && child.material) {
      // Store original materials if not already stored
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material.clone();
      }

      // Create clean neon green material instead of trying to modify existing material
      const neonGreenMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Pure neon green
        transparent: true,
        opacity: 0.8, // Adjustable translucent effect
        emissive: 0x004400, // Slight emissive boost for extra pop
        emissiveIntensity: 0.5,
      });

      child.material = neonGreenMaterial;
    }
  });
}

// Function to remove green glow effect from deployed drapes
function removeGreenGlow(drapeObject) {
  if (!drapeObject) return;

  drapeObject.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });
}

// Function to check drape collision while being dragged
function checkDrapeCollisionWhileDragging() {
  if (instructionNumber !== 2) return;

  const fullDrape = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/12. Full Drape.glb"
  );
  const deployedFullDrape = deployedInstruments.find(
    (obj) => obj.userData.path === "GLTF/deployed/FullDrape.glb"
  );
  const fenestratedDrape = kit.find(
    (obj) => obj.userData.path === "GLTF/catheterKit/13. Fenestrated Drape.glb"
  );
  const deployedFenestratedDrape = deployedInstruments.find(
    (obj) => obj.userData.path === "GLTF/deployed/FenestratedDrape.glb"
  );

  // Only require deployed versions to exist (original drapes may be undefined if already deployed)
  if (!deployedFullDrape || !deployedFenestratedDrape) {
    console.log(
      "Missing deployed objects - Deployed full drape:",
      !!deployedFullDrape,
      "Deployed fenestrated drape:",
      !!deployedFenestratedDrape
    );
    return;
  }

  // Optional debug logging (commented out for clean gameplay)
  // if (!window.drapeStateLastLogTime) window.drapeStateLastLogTime = 0;
  // const now = Date.now();
  // if (now - window.drapeStateLastLogTime > 3000) {
  //     console.log("🔍 Drape states - Full drape exists:", !!fullDrape, "Fenestrated drape exists:", !!fenestratedDrape);
  //     window.drapeStateLastLogTime = now;
  // }

  // Use separate deployment zones for each drape
  const fullDrapeZoneBounds = new THREE.Box3().setFromObject(
    fullDrapeDeploymentBox
  );
  const fenestratedDrapeZoneBounds = new THREE.Box3().setFromObject(
    fenestratedDrapeDeploymentBox
  );

  // Check if full drape is being grabbed and is in ITS SPECIFIC deployment zone
  const fullDrapeGrabbed = fullDrape
    ? Array.from(grabbedObjects.values()).includes(fullDrape)
    : false;

  if (fullDrape && fullDrapeGrabbed && fullDrape.visible) {
    const fullDrapeBox = new THREE.Box3().setFromObject(fullDrape);
    const fullDrapeInZoneNow = fullDrapeBox.intersectsBox(fullDrapeZoneBounds);

    // Optional debug logging (commented out for clean gameplay)
    // if (!window.fullDrapeLastLogTime) window.fullDrapeLastLogTime = 0;
    // const now = Date.now();
    // if (now - window.fullDrapeLastLogTime > 1500) {
    //     console.log("Full drape debug - Box min:", fullDrapeBox.min, "max:", fullDrapeBox.max);
    //     console.log("Full drape zone - Box min:", fullDrapeZoneBounds.min, "max:", fullDrapeZoneBounds.max);
    //     console.log("Full drape collision result:", fullDrapeInZoneNow);
    //     window.fullDrapeLastLogTime = now;
    // }

    if (fullDrapeInZoneNow && !fullDrapeInZone) {
      // Entered zone - show green glow
      fullDrapeInZone = true;
      deployedFullDrape.visible = true;
      applyGreenGlow(deployedFullDrape);
      console.log(
        "Full drape entered ITS deployment zone (under patient) - showing green glow"
      );
    } else if (!fullDrapeInZoneNow && fullDrapeInZone) {
      // Left zone - hide deployed drape
      fullDrapeInZone = false;
      deployedFullDrape.visible = false;
      removeGreenGlow(deployedFullDrape);
      console.log(
        "Full drape left ITS deployment zone - hiding deployed drape"
      );
    }
  }

  // Check if fenestrated drape is being grabbed and is in ITS SPECIFIC deployment zone
  const fenestratedDrapeGrabbed = fenestratedDrape
    ? Array.from(grabbedObjects.values()).includes(fenestratedDrape)
    : false;
  if (fenestratedDrape && fenestratedDrapeGrabbed && fenestratedDrape.visible) {
    const fenestratedDrapeBox = new THREE.Box3().setFromObject(
      fenestratedDrape
    );
    const fenestratedDrapeInZoneNow = fenestratedDrapeBox.intersectsBox(
      fenestratedDrapeZoneBounds
    );

    // Optional debug logging (commented out for clean gameplay)
    // if (!window.fenestratedDrapeLastLogTime) window.fenestratedDrapeLastLogTime = 0;
    // const now2 = Date.now();
    // if (now2 - window.fenestratedDrapeLastLogTime > 1500) {
    //     console.log("Fenestrated drape debug - Box min:", fenestratedDrapeBox.min, "max:", fenestratedDrapeBox.max);
    //     console.log("Fenestrated drape zone - Box min:", fenestratedDrapeZoneBounds.min, "max:", fenestratedDrapeZoneBounds.max);
    //     console.log("Fenestrated drape collision result:", fenestratedDrapeInZoneNow);
    //     window.fenestratedDrapeLastLogTime = now2;
    // }

    if (fenestratedDrapeInZoneNow && !fenestratedDrapeInZone) {
      // Entered zone - show green glow
      fenestratedDrapeInZone = true;
      deployedFenestratedDrape.visible = true;
      applyGreenGlow(deployedFenestratedDrape);
      console.log(
        "Fenestrated drape entered ITS deployment zone (over patient) - showing green glow"
      );
    } else if (!fenestratedDrapeInZoneNow && fenestratedDrapeInZone) {
      // Left zone - hide deployed drape
      fenestratedDrapeInZone = false;
      deployedFenestratedDrape.visible = false;
      removeGreenGlow(deployedFenestratedDrape);
      console.log(
        "Fenestrated drape left ITS deployment zone - hiding deployed drape"
      );
    }
  }
}

function setupController(controller) {
  if (!controller) {
    console.error("Controller is not properly initialized.");
    return;
  }
  controller.addEventListener("selectstart", onSelectStart);
  controller.addEventListener("selectend", onSelectEnd);

  // Create improved laser beam using cylinder geometry for better visibility (shortened)
  const laserGeometry = new THREE.CylinderGeometry(0.002, 0.002, 0.03, 8); // Shortened from 0.05 to 0.03 (3cm)
  const laserMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000, // Red color (default state)
    opacity: 0.5, // 50% transparency for subtlety
    transparent: true, // Enable transparency
  });
  const laser = new THREE.Mesh(laserGeometry, laserMaterial);

  // Position and orient the laser to point forward
  laser.position.z = -0.015; // Center the shorter cylinder at half its length (0.03/2 = 0.015)
  laser.rotation.x = Math.PI / 2; // Rotate to point forward along Z-axis

  // Create base sphere indicator at the controller origin (much larger)
  const baseSphereGeometry = new THREE.SphereGeometry(0.008, 8, 6);
  const baseSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000, // Red color (matches laser)
    opacity: 0.6, // 60% transparency
    transparent: true, // Enable transparency
  });
  const baseSphere = new THREE.Mesh(baseSphereGeometry, baseSphereMaterial);

  // Position base sphere at the origin (base) of the laser
  baseSphere.position.set(0, 0, 0); // At controller origin

  // Add both laser and base sphere to the controller
  controller.add(laser);
  controller.add(baseSphere);
}

// Laser setup moved to after controller definition

function onSelectStart(event) {
  selectState = true;
  const controller = event.target;
  const intersections = getIntersections(controller);
  if (intersections.length > 0) {
    const object = intersections[0].object;

    // Find the top-level parent object that's in the kit or combined catheter
    let parentObject = object;
    while (
      parentObject.parent &&
      !kit.includes(parentObject) &&
      parentObject !== currentCombinedCatheter &&
      parentObject.parent !== scene
    ) {
      parentObject = parentObject.parent;
    }

    // If we still haven't found a valid parent, use the immediate parent or the object itself
    if (
      !kit.includes(parentObject) &&
      parentObject !== currentCombinedCatheter
    ) {
      parentObject = object.parent || object;
    }

    controller.attach(parentObject);
    grabbedObjects.set(controller, parentObject);

    // Debug logging for drapes
    if (instructionNumber === 2) {
      if (
        parentObject.userData.path === "GLTF/catheterKit/12. Full Drape.glb"
      ) {
        console.log("GRABBED: Full Drape");
      } else if (
        parentObject.userData.path ===
        "GLTF/catheterKit/13. Fenestrated Drape.glb"
      ) {
        console.log("GRABBED: Fenestrated Drape");
      }
    }

    // Hide arrow for this tool when grabbed
    hideArrowForTool(parentObject);

    if (instructionNumber === 1) {
      const sterileGloves = kit.find(
        (obj) =>
          obj.userData.path === "GLTF/catheterKit/11. Sterile Gloves_Closed.glb"
      );
      if (object === sterileGloves || parentObject === sterileGloves) {
        // Execute this code when you to finish video
        // if (videoEnd) {
        // toggleHandColor(hand1);
        // toggleHandColor(hand2);
        // loadGlovesOpen();
        // nextActive = true;
        // }

        toggleHandColor(hand1);
        toggleHandColor(hand2);
        loadGlovesOpen();
        nextActive = true;
      }
    }

    // else if ( instructionNumber === 6 ) { // step 6 - inflate the balloon
    //     // if (object === syringeDetachmentBox || parentObject === syringeDetachmentBox) {
    //     //     console.log("syringe box clicked");
    //     //     deflatedCatheter.visible = false;
    //     //     inflatedCatheter.visible = true;
    //     //     nextActive = true;
    //     //     outputPanel("Balloon successfully inflated.", false);
    //     // }
    // }

    // if ( instructionNumber == 7 ) { // step 7 - remove the saline syringe
    //     if (object === syringeDetachmentBox || parentObject === syringeDetachmentBox) {
    //         console.log("Syringe Detachment Box clicked.");
    //         removeSyringeFromCatheter();
    //     }
    // }
  }
}

// function onSelectStart(event) {
//     // for ui
//     selectState = true;
//     const controller = event.target;
//     const intersections = getIntersections(controller);
//     // attachSyringeToCatheter(); // Attach syringe to catheter after loading

//     if (intersections.length > 0) {
//         const object = intersections[0].object;
//         const parentObject = object.parent || object; // This will get the parent of the object
//         controller.attach(parentObject);
//         grabbedObjects.set(controller, parentObject);
//     }
//     // Check if the user clicked on the sterile gloves in instruction step 1
//     if (instructionNumber == 1) {
//         const intersectedObjects = controller.intersectedObjects || [];
//         const sterileGloves = kit.find(obj => obj.userData.path === "GLTF/catheterKit/11. Sterile Gloves_Closed.glb");
//         if (sterileGloves) {
//             console.log("Sterile gloves selected");
//             toggleHandColor(hand1);
//             toggleHandColor(hand2);
//             loadGlovesOpen();
//             nextActive = true; // Proceed to the next step
//         }
//     } else if (instructionNumber == 3) {
//         const intersectedObjects = controller.intersectedObjects || [];
//         const lubricant = kit.find(obj => obj.userData.path === "GLTF/catheterKit/4. Lubricant.glb");
//         if (lubricant){
//             console.log("Lubricant selected");
//             animateLubricant();
//             // lubricantVisible(); //just to test
//         }
//     } else if (instructionNumber === 7) { // step 7
//         const intersectedObjects = controller.intersectedObjects || [];
//         const deflatedCatheter = kit.find(obj => obj.userData.path === "GLTF/deployed/Catheter Deployed_Deflated.glb");
//         const inflatedCatheter = kit.find(obj => obj.userData.path === "GLTF/deployed/Catheter Deployed_Inflated.glb");

//         if (deflatedCatheter) {
//             deflatedCatheter.visible = false; // Hide the deflated catheter
//             inflatedCatheter.visible = true;  // Show the inflated catheter
//             nextActive = true; // Allow progression to the next step
//         }
//     }
// }
function onSelectEnd(event) {
  // for UI
  selectState = false;
  const controller = event.target;

  let releasedObject = null;
  if (grabbedObjects.has(controller)) {
    // for grabbing functionality
    releasedObject = grabbedObjects.get(controller);

    // Debug logging for drapes
    if (instructionNumber === 2 && releasedObject) {
      if (
        releasedObject.userData.path === "GLTF/catheterKit/12. Full Drape.glb"
      ) {
        console.log("RELEASED: Full Drape");
      } else if (
        releasedObject.userData.path ===
        "GLTF/catheterKit/13. Fenestrated Drape.glb"
      ) {
        console.log("RELEASED: Fenestrated Drape");
      }
    }

    scene.attach(releasedObject); // Release the object from the controller
    grabbedObjects.delete(controller);
  }

  // Handle drape state reset when released outside deployment zone
  if (instructionNumber === 2 && releasedObject) {
    const fullDrape = kit.find(
      (obj) => obj.userData.path === "GLTF/catheterKit/12. Full Drape.glb"
    );
    const deployedFullDrape = deployedInstruments.find(
      (obj) => obj.userData.path === "GLTF/deployed/FullDrape.glb"
    );
    const fenestratedDrape = kit.find(
      (obj) =>
        obj.userData.path === "GLTF/catheterKit/13. Fenestrated Drape.glb"
    );
    const deployedFenestratedDrape = deployedInstruments.find(
      (obj) => obj.userData.path === "GLTF/deployed/FenestratedDrape.glb"
    );

    // Reset full drape state if it was released outside its zone
    if (fullDrape && releasedObject === fullDrape && fullDrapeInZone) {
      const fullDrapeZoneBounds = new THREE.Box3().setFromObject(
        fullDrapeDeploymentBox
      );
      const fullDrapeBox = new THREE.Box3().setFromObject(fullDrape);

      // Only reset if it's actually outside the zone
      if (!fullDrapeBox.intersectsBox(fullDrapeZoneBounds)) {
        fullDrapeInZone = false;
        if (deployedFullDrape) {
          deployedFullDrape.visible = false;
          removeGreenGlow(deployedFullDrape);
          console.log("Full drape released outside zone - resetting state");
        }
      }
    }

    // Reset fenestrated drape state if it was released outside its zone
    if (
      fenestratedDrape &&
      releasedObject === fenestratedDrape &&
      fenestratedDrapeInZone
    ) {
      const fenestratedDrapeZoneBounds = new THREE.Box3().setFromObject(
        fenestratedDrapeDeploymentBox
      );
      const fenestratedDrapeBox = new THREE.Box3().setFromObject(
        fenestratedDrape
      );

      // Only reset if it's actually outside the zone
      if (!fenestratedDrapeBox.intersectsBox(fenestratedDrapeZoneBounds)) {
        fenestratedDrapeInZone = false;
        if (deployedFenestratedDrape) {
          deployedFenestratedDrape.visible = false;
          removeGreenGlow(deployedFenestratedDrape);
          console.log(
            "Fenestrated drape released outside zone - resetting state"
          );
        }
      }
    }
  }

  // for putting on drapes
  if (instructionNumber == 2) {
    // step 2
    const fullDrape = kit.find(
      (obj) => obj.userData.path === "GLTF/catheterKit/12. Full Drape.glb"
    );
    const deployedFullDrape = deployedInstruments.find(
      (obj) => obj.userData.path === "GLTF/deployed/FullDrape.glb"
    );
    const fenestratedDrape = kit.find(
      (obj) =>
        obj.userData.path === "GLTF/catheterKit/13. Fenestrated Drape.glb"
    );
    const deployedFenestratedDrape = deployedInstruments.find(
      (obj) => obj.userData.path === "GLTF/deployed/FenestratedDrape.glb"
    );

    // Use separate deployment zones for each drape
    const fullDrapeZoneBounds = new THREE.Box3().setFromObject(
      fullDrapeDeploymentBox
    );
    const fenestratedDrapeZoneBounds = new THREE.Box3().setFromObject(
      fenestratedDrapeDeploymentBox
    );

    // Track which drapes got deployed this release
    let fullDrapeDeployed = false;
    let fenestratedDrapeDeployed = false;

    if (fullDrape && fullDrape.visible) {
      const fullDrapeBox = new THREE.Box3().setFromObject(fullDrape);
      if (fullDrapeBox.intersectsBox(fullDrapeZoneBounds)) {
        scene.remove(fullDrape);
        kit = kit.filter((obj) => obj !== fullDrape); // Remove from kit array
        deployedFullDrape.visible = true;
        removeGreenGlow(deployedFullDrape); // Remove green glow and show normal colors
        fullDrapeInZone = false; // Reset state
        fullDrapeDeployed = true;
        console.log(
          "Full drape deployed successfully in ITS zone (under patient)"
        );

        // Hide arrow for this drape
        hideArrowForTool(fullDrape);
      }
    }

    if (fenestratedDrape && fenestratedDrape.visible) {
      const fenestratedDrapeBox = new THREE.Box3().setFromObject(
        fenestratedDrape
      );
      if (fenestratedDrapeBox.intersectsBox(fenestratedDrapeZoneBounds)) {
        scene.remove(fenestratedDrape);
        kit = kit.filter((obj) => obj !== fenestratedDrape); // Remove from kit array
        deployedFenestratedDrape.visible = true;
        removeGreenGlow(deployedFenestratedDrape); // Remove green glow and show normal colors
        fenestratedDrapeInZone = false; // Reset state
        fenestratedDrapeDeployed = true;
        console.log(
          "Fenestrated drape deployed successfully in ITS zone (over patient)"
        );

        // Hide arrow for this drape
        hideArrowForTool(fenestratedDrape);
      }
    }

    // Check if both drapes are deployed (don't exist in kit anymore)
    const fullDrapeStillExists = kit.find(
      (obj) => obj.userData.path === "GLTF/catheterKit/12. Full Drape.glb"
    );
    const fenestratedDrapeStillExists = kit.find(
      (obj) =>
        obj.userData.path === "GLTF/catheterKit/13. Fenestrated Drape.glb"
    );

    if (!fullDrapeStillExists && !fenestratedDrapeStillExists) {
      nextActive = true;
      // Hide deployment boxes when step is complete
      fullDrapeDeploymentBox.visible = false;
      fenestratedDrapeDeploymentBox.visible = false;
      console.log("Both drapes deployed - ready for next step");
    }
  } else if (instructionNumber === 4) {
    // step 3
    const lubricant = kit.find(
      (obj) => obj.userData.path === "GLTF/catheterKit/4. Lubricant.glb"
    );
    const lubricantBox = new THREE.Box3().setFromObject(lubricant);
    const catheter = kit.find(
      (obj) => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb"
    );
    const catheterBox = new THREE.Box3().setFromObject(catheter);
    if (!lubricated) {
      if (
        lubricantBox.intersectsBox(kitboundingBox) &&
        catheterBox.intersectsBox(kitboundingBox)
      ) {
        animateLubricant();
        lubricated = true;
        nextActive = true;
      }
    }
  } else if (instructionNumber === 5) {
    //step 5
    console.log("Step 5: Checking collisions...");

    // First collision: Catheter + Syringe → Combined Catheter+Syringe
    if (checkCatheterCollisionWithSyringe() && !currentCombinedCatheter) {
      console.log("Step 5: Catheter-syringe collision detected!");
      attachSyringeToCatheter();

      // Play success sound effect
      playSFX("/sfx/attach_sound.wav");
    }

    // Second collision: Combined Catheter+Syringe + Urine Bag → Fully Combined
    if (
      checkCatheterCollisionWithUrineBag() &&
      currentCombinedCatheter === catheterWithSyringeModel
    ) {
      console.log("Step 5: Catheter-urine bag collision detected!");
      attachUrineBagToCatheter();
      nextActive = true;

      // Play success sound effect
      playSFX("/sfx/attach_sound.wav");

      // Show guidance message
      outputPanel("Great! Now you can proceed to the next step.", false);
    }
  } else if (instructionNumber === 3) {
    checkDrapesCollisionWithTrashcan();
  } else if (instructionNumber === 6) {
    // step 6
    // Check if the collision box is colliding
    if (!nextActive) {
      if (checkCollisionWithInsertionBox()) {
        isError = false;
        message = "Great Job!";
        sphereIndicator.visible = false;
        outputPanel(message, isError);

        // Hide the combined catheter model and release it from controller
        if (currentCombinedCatheter) {
          currentCombinedCatheter.visible = false;

          // Find which controller was holding the combined catheter and release it
          grabbedObjects.forEach((object, controller) => {
            if (object === currentCombinedCatheter) {
              scene.attach(object);
              grabbedObjects.delete(controller);
            }
          });

          // Hide arrow for the combined catheter when it's inserted
          hideArrowForTool(currentCombinedCatheter);
        }

        loadInsertedCatheter(); //Deploying inserted Catheter
        nextActive = true;
        inflateButton();
      } else {
        isError = true;
        message = "Reinsert the catheter into the urethral opening";
        outputPanel(message, isError);
      }
    }
  } else if (instructionNumber === 9) {
    if (checkDrapesCollisionWithTrashcan()) {
      console.log("Drapes has been disposed.");
      // nextActive is already set in checkDrapesCollisionWithTrashcan function
    }
  }
}

// // Function to check intersections for a controller
// function getIntersections(controller, controllerID) {
//     if (!catheterModel && kit.length === 0) {
//         return [];
//     }

//     const tempMatrix = new THREE.Matrix4();
//     tempMatrix.identity().extractRotation(controller.matrixWorld);

//     raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
//     raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

//     const isIntersecting = raycaster.ray.intersectsBox(kitboundingBox);

//     if (instructionNumber == 10){
//         return raycaster.intersectObjects([catheterModel, ...kit, ...deployedInstruments], true);
//     } else {
//     return raycaster.intersectObjects([catheterModel, ...kit], true);
//     }
// }

function getIntersections(controller) {
  if (kit.length === 0 && !currentCombinedCatheter) {
    return [];
  }

  // Only raycast against layer 0 (grabbable objects)
  raycaster.layers.set(0);

  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  // Build targets array with combined catheter models, excluding non-grabbable objects
  let targets = kit.filter((obj) => {
    // Exclude objects that are explicitly marked as non-grabbable
    return obj.userData.grabbable !== false;
  });

  if (currentCombinedCatheter && currentCombinedCatheter.visible)
    targets.push(currentCombinedCatheter);

  if (instructionNumber === 9) {
    // Only add grabbable deployed instruments
    const grabbableDeployed = deployedInstruments.filter((obj) => {
      return obj.userData.grabbable !== false;
    });
    targets = [...targets, ...grabbableDeployed];
  }

  return raycaster.intersectObjects(targets, true);
}

// Animation loop
function animate() {
  // requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  if (urineBagMixer) {
    urineBagMixer.update(delta); // update the animation
  }

  // UI updates
  ThreeMeshUI.update();

  // Force button position after UI update (backup solution for main menu button positioning)
  if (mainMenuContainer && objsToTest.length > 0) {
    const startButton = objsToTest.find(
      (obj) =>
        obj.children &&
        obj.children.some(
          (child) => child.content && child.content.includes("START SIMULATION")
        )
    );
    if (startButton) {
      startButton.position.set(0, -0.3, 0.01); //change this for the position of the start button in the main menu
    }
  }

  updateButtons();

  // Update laser pointer colors for VR controllers
  if (renderer.xr.isPresenting) {
    updateLaserColors();
  }

  // Animate arrow indicators
  animateArrows();

  // Check drape collision while dragging (for green glow feedback)
  checkDrapeCollisionWhileDragging();

  // // Lubricant animation handling
  // if (isAnimatingLubricant && lubricantObject) {
  //     const elapsed = performance.now() - lubricantStartTime;
  //     const progress = Math.min(elapsed / lubricantDuration, 1);
  //     lubricantObject.position.x = lubricantStartX + (lubricantTargetX - lubricantStartX) * progress;

  //     if (progress >= 1) {
  //         isAnimatingLubricant = false;

  //         setTimeout(() => {
  //             lubricantObject.position.set(1, -0.02, 0.1);
  //             // lubricantObject.rotation.z = 0.02;
  //             lubricantVisible();
  //         }, 500);
  //     }
  // }

  // Render for VR or regular
  if (renderer.xr.isPresenting) {
    renderer.render(scene, renderer.xr.getCamera(camera));
    // requestAnimationFrame(animate);

    if (instructionNumber === 3) {
      checkSwabsCollision();
      checkDrapesCollisionWithTrashcan(); // Also check for swab disposal in step 3
    }

    if (instructionNumber === 9) {
      checkDrapesCollisionWithTrashcan();
    }
  } else {
    renderer.render(scene, camera);
  }
}

renderer.setAnimationLoop(animate);

// Handle window resize
window.addEventListener("resize", () => {
  if (!renderer.xr.isPresenting) {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
});

//**
// Mouse Controls
//  */

// // Controls for Pointer Lock (mouse-based control)
// window.addEventListener('click', () => {
//     if (!document.pointerLockElement) {
//         canvas.requestPointerLock();
//     }
// });

// document.addEventListener('pointerlockchange', () => {
//     if (document.pointerLockElement === canvas) {
//         controls.lock();
//     } else {
//         controls.unlock();
//     }
// });

// // Function to move the camera with mouse in pointer lock mode
// function updatePointerLock() {
//     controls.update();
// }

// // Calling pointer lock updates in animation
// function animateWithPointerLock() {
//     updatePointerLock();
//     animate();
// }

// renderer.setAnimationLoop(animateWithPointerLock);

// // Function to handle hover (mouse move)
// function onMouseMove(event) {
//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//     raycaster.setFromCamera(mouse, camera);
//     const intersects = raycaster.intersectObjects([catheterModel, anatomyModel, tableModel], true);

//     if (intersects.length > 0) {
//         document.body.style.cursor = 'pointer'; // Change cursor to pointer
//     } else {
//         document.body.style.cursor = 'default'; // Reset cursor
//     }
// }

// Function call
// Call the UI Creation functions
function simulationStart() {
  // Hide the main menu if it exists
  if (mainMenuContainer) {
    scene.remove(mainMenuContainer);
    mainMenuContainer = null;

    // Remove all main menu buttons from objsToTest to prevent accidental triggering
    // Find and remove the start button from objsToTest
    for (let i = objsToTest.length - 1; i >= 0; i--) {
      const obj = objsToTest[i];
      // Check if this object is part of the main menu (has START SIMULATION text)
      if (
        obj.children &&
        obj.children.some(
          (child) => child.content && child.content.includes("START SIMULATION")
        )
      ) {
        objsToTest.splice(i, 1);
        console.log("Removed start button from objsToTest");
      }
    }
  }

  // Make the environment visible (environment is already loaded in mainMenu)
  envMaterials.forEach((obj) => {
    if (obj && obj.userData.path) {
      obj.visible = true;
    }
  });

  // Initialize the simulation with the first instruction
  instructionNumber = 0;
  makeTextPanel(instructionNumber);
  unwrapButton();

  console.log("Simulation started!");
}

function mainMenu() {
  console.log("Creating main menu...");

  // Load glb initializations here
  loadDeployed();
  loadCombinedCatheterModels();
  loadEnvironment();
  loadKit(); // Load kit initially with visibility set to false

  // Initially hide environment objects until simulation starts
  setTimeout(() => {
    envMaterials.forEach((obj) => {
      if (obj && obj.userData.path) {
        obj.visible = false;
      }
    });
  }, 100); // Small delay to ensure objects are loaded

  // Create main menu UI container (initial size, will be adjusted when image loads)
  mainMenuContainer = new ThreeMeshUI.Block({
    width: 2.5,
    height: 1.5,
    padding: 0.1,
    fontFamily: FontJSON,
    fontTexture: FontImage,
    alignItems: "center",
    justifyContent: "center",
    backgroundOpacity: 0, // Start transparent, will be set to 1 when image loads
    backgroundColor: new THREE.Color(0x1a4c8a), // Blue background as fallback only
    flexDirection: "column",
  });

  console.log(
    "Main menu container created with initial dimensions:",
    2.5,
    "x",
    1.5
  );

  mainMenuContainer.position.set(0, 1.6, -1.5); // Negative Z to position in front of user
  mainMenuContainer.rotation.y = 0; // No rotation needed when positioned in front
  scene.add(mainMenuContainer);

  console.log(
    "Main menu container added to scene at position:",
    mainMenuContainer.position
  );

  // Load and add the background image
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    "/Main Menu 1.jpg",
    (texture) => {
      console.log("Main menu background image loaded successfully");
      console.log(
        "Image dimensions:",
        texture.image.width,
        "x",
        texture.image.height
      );

      // Calculate aspect ratio and adjust container size to match image
      const imageAspectRatio = texture.image.width / texture.image.height;
      const containerHeight = 1.5;
      const containerWidth = containerHeight * imageAspectRatio;

      console.log(
        "Adjusting container size to:",
        containerWidth,
        "x",
        containerHeight
      );

      // Update container dimensions to match image aspect ratio and remove blue background
      mainMenuContainer.set({
        width: containerWidth,
        height: containerHeight,
        backgroundTexture: texture,
        backgroundOpacity: 1,
      });

      // Force remove the background color after setting texture
      mainMenuContainer.backgroundColor = undefined;

      // Update title block width to match new container width
      titleBlock.set({
        width: containerWidth - 0.2, // Leave some margin
      });

      // Ensure texture is not stretched
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
    },
    (progress) => {
      console.log(
        "Loading main menu background:",
        (progress.loaded / progress.total) * 100 + "%"
      );
    },
    (error) => {
      console.error("Error loading main menu background image:", error);
      console.log("Using fallback blue background");
      // Show blue background only if image fails to load
      mainMenuContainer.set({
        backgroundOpacity: 1,
        backgroundColor: new THREE.Color(0x1a4c8a),
      });
    }
  );

  // Create title text (will be updated when image loads)
  const titleBlock = new ThreeMeshUI.Block({
    width: 2.2,
    height: 0.3,
    margin: 0.05,
    justifyContent: "center",
    alignItems: "center",
    backgroundOpacity: 0,
  });

  // Create start button
  const startButtonOptions = {
    width: 0.6,
    height: 0.15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1, // Adjust this to move button down
    marginLeft: 0.0,
    borderRadius: 0.075,
    backgroundColor: new THREE.Color(0x28a745), // Green color
    backgroundOpacity: 1,
  };

  const startButton = new ThreeMeshUI.Block(startButtonOptions);

  startButton.add(
    new ThreeMeshUI.Text({
      content: "START SIMULATION",
      fontSize: 0.06,
      fontColor: new THREE.Color(0xffffff),
    })
  );

  // Setup button states
  const hoveredStateAttributes = {
    state: "hovered",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x34c759), // Lighter green on hover
      backgroundOpacity: 0.9,
      fontColor: new THREE.Color(0xffffff),
    },
  };

  const idleStateAttributes = {
    state: "idle",
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x28a745), // Original green
      backgroundOpacity: 1,
      fontColor: new THREE.Color(0xffffff),
    },
  };

  startButton.setupState({
    state: "selected",
    attributes: {
      offset: 0.02,
      backgroundColor: new THREE.Color(0x1e7e34), // Darker green when clicked
      backgroundOpacity: 1,
      fontColor: new THREE.Color(0xffffff),
    },
    onSet: () => {
      // Start button pressed - begin simulation
      simulationStart();
    },
  });

  startButton.setupState(hoveredStateAttributes);
  startButton.setupState(idleStateAttributes);

  // Add elements to main menu container
  mainMenuContainer.add(titleBlock);
  mainMenuContainer.add(startButton);

  // Add start button to interactive objects
  objsToTest.push(startButton);

  // Force position the button after UI system has finished layout (Solution 3: Absolute positioning)
  setTimeout(() => {
    startButton.position.set(-0.2, 3, 0.01); // x, y, z - adjust Y to move up/down
    console.log("Button position set to:", startButton.position);
  }, 100);

  console.log("Main menu created!");
}

mainMenu();

// Add stopVO function to stop current voiceover
function stopVO() {
  if (window.currentAudio) {
    window.currentAudio.pause();
    window.currentAudio.currentTime = 0;
    window.currentAudio = null;
  }
}
