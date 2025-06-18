
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRButton } from 'three/examples/jsm/webxr/XRButton.js';
import { OculusHandModel } from 'three/examples/jsm/webxr/OculusHandModel.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'; // Correct import of FontLoader
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';  // Correct import of TextGeometry
import ThreeMeshUI from 'three-mesh-ui';
import FontJSON from 'three-mesh-ui/examples/assets/Roboto-msdf.json';
import FontImage from 'three-mesh-ui/examples/assets/Roboto-msdf.png';
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import ConditionalNode from 'three/src/nodes/math/ConditionalNode.js';
import { Water } from 'three/addons/objects/Water2.js';
import { textureLoad } from 'three/tsl';
import { remove } from 'three/examples/jsm/libs/tween.module.js';

//**
// Initialization
//  */

// Setup canvas, scene, and camera
const canvas = document.querySelector('canvas.webGL');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 3);

// Setup renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

// SetUp XR Session
const sessionInit = {
    requiredFeatures: ['hand-tracking']
};
document.body.appendChild(XRButton.createButton(renderer, sessionInit));

// Add lighting
const light = new THREE.AmbientLight(0xffffff, 1);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(0, 5, 0.5);
scene.add(directionalLight);

// Create a bounding box for deployment area
const deploymentBoxGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const deploymentBoxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
const deploymentBox = new THREE.Mesh(deploymentBoxGeometry, deploymentBoxMaterial);
deploymentBox.position.set(1.25, 1, 0.25);
scene.add(deploymentBox);
deploymentBox.visible = false;


const offsetValue = 1.25


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
    // // '9': "Gently pull the catheter out until you get a slight resistance.",
    // '9': "Remove the drapes and dispose properly.",
    // '10': "GREAT JOB! \nYou have completed the procedure."

    '0': "Unwrap the foley kit.",
    '1': "Wear the sterile gloves inside the kit.",
    '2': "Put the full drape under the patient's perinium and the fenestrated drape over the patient's perinium.",
    '3': "Take the swabs to clean the opening",
    '4': "Lubricate the catheter.",
    '5': "Take the saline syringe and urine bag then attach them to the catheter.",
    '6': "Insert catheter to the urethral opening",
    '7': "Inflate the balloon.",
    '8': "Remove the saline syringe.",
    // '9': "Gently pull the catheter out until you get a slight resistance.",
    '9': "Remove the drapes and dispose properly.",
    '10': "GREAT JOB! \nYou have completed the procedure."
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
const instructionsLength = Object.keys(instructions).length; // determine the number of instructions

//create a bounding box for spawning the unwrap button
const kitBoundingGeometry = new THREE.BoxGeometry(1, 0.3, 1);  
const kitBoundingMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true }); 
const kitBounding = new THREE.Mesh(kitBoundingGeometry, kitBoundingMaterial);
kitBounding.position.set( 0, 1.1, 1.13 );
kitBounding.visible = false;
scene.add(kitBounding);

const kitboundingBox = new THREE.Box3().setFromObject(kitBounding);


// Call the UI Creation functions
makeTextPanel(instructionNumber);

let currentVideo = null;
let currentPlane = null;
function playVideo(vidName) {
    const video = document.getElementById(vidName);
    videoEnd = false;

     // Wait 4 seconds before playing
    setTimeout(() => {
        video.play().catch(error => {
            console.error('Error attempting to play the video:', error);
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

    video.addEventListener('ended', () => {
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


function makePanel() {   // Create the a next and previous button panel
    const container = new ThreeMeshUI.Block( {
		justifyContent: 'center',
		contentDirection: 'row-reverse',
		fontFamily: FontJSON,
		fontTexture: FontImage,
		fontSize: 0.07,
		padding: 0.02,
		borderRadius: 0.11
	} );
	// container.position.set( 0, 0.6, -1);    // to change
	container.rotation.x = 0.55;
    container.position.set(0, 1, 1.5);
    container.rotation.y = Math.PI;
	scene.add( container );

	// BUTTONS
	const buttonOptions = {
		width: 0.4,
		height: 0.15,
		justifyContent: 'center',
		offset: 0.05,
		margin: 0.02,
		borderRadius: 0.075
	};

	// Options for component.setupState().
	// It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

	const hoveredStateAttributes = {
		state: 'hovered',
		attributes: {
			offset: 0.035,
			backgroundColor: new THREE.Color( 0x999999 ),
			backgroundOpacity: 1,
			fontColor: new THREE.Color( 0xffffff )
		},
	};

	const idleStateAttributes = {
		state: 'idle',
		attributes: {
			offset: 0.035,
			backgroundColor: new THREE.Color( 0x666666 ),
			backgroundOpacity: 0.3,
			fontColor: new THREE.Color( 0xffffff )
		},
	};

	// Create states for the buttons.
	const selectedAttributes = {
		offset: 0.02,
		backgroundColor: new THREE.Color( 0x777777 ),
		fontColor: new THREE.Color( 0x222222 )
	};

    const buttonNext = new ThreeMeshUI.Block(buttonOptions);
    buttonNext.add(new ThreeMeshUI.Text({ content: 'NEXT' }));

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

	buttonNext.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => { //next button pressed
        stopVideo();
            
            if (nextActive) {
                if (instructionNumber < instructionsLength - 1) {      
                    instructionNumber += 1;
                    makeTextPanel(instructionNumber);
                    nextActive = false;
                }else {
                    console.log("THIS IS THE LAST INSTRUCTION");
                } 
            }
             
		}
	} );

    [buttonNext].forEach(button => {
        button.setupState(hoveredStateAttributes);
        button.setupState(idleStateAttributes);
    });

    container.add(buttonNext);
    objsToTest.push(buttonNext);

    if (instructionNumber === 1) {
        const buttonSkip = new ThreeMeshUI.Block(buttonOptions);
        buttonSkip.add(new ThreeMeshUI.Text({ content: 'SKIP' }));
            
        buttonSkip.setupState({
            state: 'selected',
            attributes: selectedAttributes,
            onSet: () => {
                stopVideo();
                if (instructionNumber < instructionsLength - 1) {
                    instructionNumber += 1; // Skip to next instruction
                makeTextPanel(instructionNumber);
                }
                // scene.remove(container); // Optional: remove panel after skip
        }
    });

    buttonSkip.setupState(hoveredStateAttributes);
        buttonSkip.setupState(idleStateAttributes);

        container.add(buttonSkip);
        objsToTest.push(buttonSkip);
    }
}

makeTextPanel(0);


function inflateButton() {   // Create the a next and previous button panel
    const container = new ThreeMeshUI.Block( {
		justifyContent: 'center',
		contentDirection: 'row-reverse',
		fontFamily: FontJSON,
		fontTexture: FontImage,
		fontSize: 0.07,
		padding: 0.02,
		borderRadius: 0.11,
        backgroundOpacity: 0, 
	} );
	// container.position.set( 0, 0.6, -1);    // to change
	// container.rotation.x = -0.55;
    container.position.set(1.3, 0.87, 0.5);
    container.rotation.y = -Math.PI/2;
	scene.add( container );

	// BUTTONS
	const buttonOptions = {
		width: 0.5,
		height: 0.15,
		justifyContent: 'center',
		offset: 0.05,
		margin: 0.02,
		borderRadius: 0.075,
	};

	// Options for component.setupState().
	// It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

	const hoveredStateAttributes = {
		state: 'hovered',
		attributes: {
			offset: 0.035,
			backgroundColor: new THREE.Color( 0x999999 ),
			backgroundOpacity: 0,
			fontColor: new THREE.Color( 0xffffff ),
            fontOpacity:0
		},
	};

	const idleStateAttributes = {
		state: 'idle',
		attributes: {
			offset: 0.035,
			backgroundColor: new THREE.Color( 0x666666 ),
			backgroundOpacity: 0,
			fontColor: new THREE.Color( 0xffffff ),
            fontOpacity: 0
		},
	};

	// Buttons creation, with the options objects passed in parameters.

	const buttonPrevious = new ThreeMeshUI.Block( buttonOptions );
	const buttonNext = new ThreeMeshUI.Block( buttonOptions );

	buttonNext.add(
		new ThreeMeshUI.Text( { content: 'INFLATE' } )
	);


	// Create states for the buttons.
	const selectedAttributes = {
		offset: 0.02,
		backgroundColor: new THREE.Color( 0x777777 ),
		fontColor: new THREE.Color( 0x222222 )
	};

	buttonNext.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => { //next button pressed
            //INSERT CODE FOR INFLATION
            if (instructionNumber == 7){
                if (!nextActive){
                    console.log("syringe inflated");
                    deflatedCatheter.visible = false;
                    scene.remove(deflatedCatheter);
                    inflatedCatheter.visible = true;

                    // SHOW URINE BAG ANIMATION AFTER CLICKED THE INFLATED BUTTON
                    // showUrineBagAnimation();

                    nextActive = true;
                    outputPanel("Balloon successfully inflated.", false);
                }

            } else if (instructionNumber == 8){
                if (!nextActive){
                    removeSyringeFromCatheter();
                    nextActive = true;
                    scene.remove(container);
                }               
            }
		}
	} );
	buttonNext.setupState( hoveredStateAttributes );
	buttonNext.setupState( idleStateAttributes );

	//

	container.add( buttonNext );
	objsToTest.push( buttonNext );
}

function makeTextPanel(instructionNumber) { 
    // Create a GUI for instruction display
    console.log(instructionNumber);
    
    // Remove the last text panel if it exists
    if (currentTextPanel) {
        scene.remove(currentTextPanel);
        currentTextPanel = null;
    } 
    if (instructionNumber == 1){
        playVideo("Boy Vo Sterile Glove");
    } 
    //swabs video
    if (instructionNumber == 3){
        playVideo("Basic Anatomy Without Caption");
    } 
    //parts ng catheter
    if (instructionNumber == 6){
        playVideo("Foley Catheter And Drainage");
    } 
    if (instructionNumber == 6){
        sphereIndicator.visible = true;
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
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: 0.08
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
        }),
    );

    // Play the corresponding audio file
    playVO(instructionNumber + 1);
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
    
} function playSFX(audioPath) {
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioPath);
    audio.play().catch(error => {
        console.error('Error attempting to play the audio:', error);
    });

    window.currentAudio = audio;
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
let nextActive = false;
let time = 0; // Track time for smooth animation
let unwrapContainer = null;
unwrapButton();
// Function to create the unwrap button
function unwrapButton() {
    unwrapContainer = new ThreeMeshUI.Block({
        justifyContent: 'center',
        contentDirection: 'row-reverse',
        fontFamily: FontJSON,
        fontTexture: FontImage,
        fontSize: 0.06,
        padding: 0.02,
        borderRadius: 0.11,
        backgroundOpacity: 0,  
        backgroundColor: new THREE.Color(0x222222) // Darker background
    });

    unwrapContainer.position.set(0, 0.9, 1.1);
    unwrapContainer.rotation.y = Math.PI;
    unwrapContainer.rotation.x = 0.7;
    scene.add(unwrapContainer);

    const buttonOptions = {
        width: 0.4,
        height: 0.13,
        justifyContent: 'center',
        offset: 0.05,
        margin: 0.02,
        borderRadius: 0.075,
        backgroundColor: new THREE.Color(0xffa500), // Orange color to make it pop
        backgroundOpacity: 1
    };

    const hoveredStateAttributes = {
        state: 'hovered',
        attributes: {
            offset: 0.035,
            backgroundColor: new THREE.Color(0xffcc00), // Bright yellow on hover
            backgroundOpacity: 0.8,
            fontColor: new THREE.Color(0x000000),
            fontOpacity: 0.8
        },
    };

    const idleStateAttributes = {
        state: 'idle',
        attributes: {
            offset: 0.035,
            backgroundColor: new THREE.Color(0xffa500),
            backgroundOpacity: 0,
            fontColor: new THREE.Color(0xffffff),
            fontOpacity: 0, // Makes the text disappear
        },
    };
    const buttonUnwrap = new ThreeMeshUI.Block(buttonOptions);
    
    buttonUnwrap.add(new ThreeMeshUI.Text({ 
        content: 'UNWRAP', 
        fontColor: new THREE.Color(0xffffff)
    }));

    buttonUnwrap.setupState({
        state: 'selected',
        attributes: {
            offset: 0.02,
            backgroundColor: new THREE.Color(0xff6600), // Darker orange when clicked
            fontColor: new THREE.Color(0x000000)
        },
        onSet: () => { //unwrap Button pressed
            const foleyPack = envMaterials.find(obj => obj.userData.path === "GLTF/catheterKit/1. Foley Pack_Whole.glb");
            if (foleyPack) {
                scene.remove(foleyPack);
                scene.remove(unwrapContainer);
                unwrapContainer = null;
                envMaterials = envMaterials.filter(obj => obj !== foleyPack);
                loadKit();
                makePanel();
            } else {
                // console.log("Foley Pack not found.");
            }
            if (instructionNumber == 0){
            nextActive = true;
            }
            // removeUnwrapButton();
        }
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



function outputPanel(message, isError) { // Create a GUI for Output feedback
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

    container.position.set( 1.75, 1.5, 0.25 );
    container.rotation.y = -0.5*Math.PI;
    scene.add( container );

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
      
    if (isError){ // adding a red ! if error

        const imageBlock = new ThreeMeshUI.Block({
            height: 0.5,
            width: 0.5,
          });
        
        container.add(imageBlock);

        const loader = new THREE.TextureLoader();

        loader.load("/public/warningSign.png", (texture) => {
        imageBlock.set({ backgroundTexture: texture });
        });

        info.add(
            new ThreeMeshUI.Text( {
                content: "ERROR OCCURED\n", 
                fontSize: 0.05
            } ),
        );
    }

    info.add(
        new ThreeMeshUI.Text( {
            content: message,  
        } ),
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
        [controller1, controller2].forEach(controller => {
            if (!controller) return;
            
            const tempMatrix = new THREE.Matrix4();
            tempMatrix.identity().extractRotation(controller.matrixWorld);
            
            const origin = new THREE.Vector3();
            controller.getWorldPosition(origin);
            
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyMatrix4(tempMatrix);
            
            raycaster.set(origin, direction);
            
            const localIntersect = raycast();
            
            if (localIntersect && (!intersect || localIntersect.distance < intersect.distance)) {
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
            intersect.object.setState('selected');
        } else {
            intersect.object.setState('hovered');
        }
    }

    // Update non-targeted buttons state
    objsToTest.forEach((obj) => {
        if ((!intersect || obj !== intersect.object) && obj.isUI) {
            obj.setState('idle');
        }
    });
}

function raycast() {
    return objsToTest.reduce((closestIntersection, obj) => {
        const intersection = raycaster.intersectObject(obj, true);
        if (!intersection[0]) return closestIntersection;
        
        if (!closestIntersection || intersection[0].distance < closestIntersection.distance) {
            intersection[0].object = obj;
            return intersection[0];
        }
        return closestIntersection;
    }, null);
}

/** 
 * end of UI
 */

/**
 * start of loading meshes
 */

// Loaders
const loader = new GLTFLoader();
let catheterModel, kit = [], envMaterials = [], deployedInstruments = [];
let urineBagModel, syringeModel;
let water; //for lubricant
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./draco/');
loader.setDRACOLoader(dracoLoader);


let tipBox = null; 
loadDeployed();



// INSERT loading meshes stationary meshes
//loading environment ( initially nongrabbable )
function loadDeployed(){
    const deployedName = [
        { path: "GLTF/deployed/FenestratedDrape.glb" },
        { path: "GLTF/deployed/FullDrape.glb" },
        { path: "GLTF/deployed/4. Lubricant.glb" }
    ];

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
                    newObject.position.set(1.25, 0, -0.10); // adjust as needed (X,Y,Z)
                    newObject.scale.set(1, 1, 1); // adjust as needed
                } else if (path === "GLTF/deployed/FullDrape.glb") {
                    newObject.position.set(1.25, 0, 0); // adjust as needed
                    newObject.scale.set(1, 1, 1); // adjust as needed
                }

                console.log(`${path} loaded at`, newObject.position, "scale:", newObject.scale);
            },
            undefined,
            (error) => console.error(`Error loading ${path}`, error)
        );
    });
}


// Load Catheter Model
// // Create a bounding box for the detachment of syringe
// const syringeDetachmentBoxGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
// const syringeDetachmentBoxMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
// const syringeDetachmentBox = new THREE.Mesh(syringeDetachmentBoxGeometry, syringeDetachmentBoxMaterial);
// // scene.add(syringeBox);
// // syringeBox.add(syringeDetachmentBox);
// syringeDetachmentBox.position.set(offsetValue, 0.95, 0.5);
// syringeDetachmentBox.visible = true;

loader.load('GLTF/deployed/Catheter_on Table.glb', (gltf) => {
    if (!catheterModel) {
        catheterModel = gltf.scene;
        catheterModel.position.x = offsetValue; 
        scene.add(catheterModel);

        // Set layer 0 for catheterModel and all children (grabbable)
        catheterModel.traverse(child => child.layers.set(0));

        const catheterMesh = catheterModel.children[0]; 

        // Create and attach the catheter tip box (for collision)
        const tipBoxGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);  
        const tipBoxMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); 
        tipBox = new THREE.Mesh(tipBoxGeometry, tipBoxMaterial);

        tipBox.position.set(-0.99, 0.825, 1.24); // Manually positioned
        catheterModel.add(tipBox);
        tipBox.visible = false;
        catheterModel.visible = false;
        
        // syringeDetachmentBox.position.set(0, 0.95, 0.5);
        
        // catheterModel.add(syringeDetachmentBox);
        // syringeDetachmentBox.visible = true; 

        // Set layer 0 (so tipBox is also grabbable or interactable)
        tipBox.layers.set(0);

       

        // --- Load and add Saline Syringe as child (non-grabbable) ---
        loader.load('GLTF/deployed/Saline Syringe_on Table.glb', (syringeGltf) => {
            syringeModel = syringeGltf.scene;
            syringeModel.position.set(0, 0, 0);
            syringeModel.userData.path = "GLTF/deployed/Saline Syringe_on Table.glb";
            catheterModel.add(syringeModel);

            // Set syringe layer to 1 (non-grabbable)
            syringeModel.traverse(child => child.layers.set(1));
        });

        // --- Load and add Urine Collection Bag as child (non-grabbable) ---
        loader.load('GLTF/deployed/Urine Collection Bag_on Table.glb', (urineGltf) => {
            urineBagModel = urineGltf.scene;
            urineBagModel.position.set(0, 0, 0);
            urineBagModel.visible = false;
            catheterModel.add(urineBagModel);

            // Set urine bag layer to 1 (non-grabbable)
            urineBagModel.traverse(child => child.layers.set(1));
        });
    }
});



// Create insertionBox outside the function
const insertionBoxGeometry = new THREE.BoxGeometry(0.10, 0.05, 0.03); //(0.01, 0.01, 0.03)
const insertionBoxMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const insertionBox = new THREE.Mesh(insertionBoxGeometry, insertionBoxMaterial);

// Create a red sphere indicator at the insertionBox
const sphereGeometry = new THREE.SphereGeometry(0.01, 32, 32);
const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
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
    { path: "GLTF/catheterKit/1. Foley Pack_Whole.glb" },
];


let mixer; // Declare this globally or somewhere accessible

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

                // sphereIndicator.position.copy(insertionBox.position);
                // sphereIndicator.position.z += 0.02;
                // insertionBox.position.y -= 0.005;

                sphereIndicator.position.set (1.25, 0.995, 0.19);

            } else if (path === "GLTF/environment/Patient_Upper.glb") {
                // Set specific position for Patient_Upper
                newObject.position.set(1.25, 0.01, 0.2); // change these values as needed
            }
        },
        undefined,
        (error) => console.error("Error loading assets", error)
    );
});



// function for loading catheter kit
function loadKit(){
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
        { path: "GLTF/catheterKit/11. Sterile Gloves_Closed.glb"},
        { path: "GLTF/catheterKit/12. Full Drape.glb" },
        { path: "GLTF/catheterKit/13. Fenestrated Drape.glb" }
    ];
    
    
    catheterKit.forEach(({ path }) => {
        loader.load(
            path,
            (gltf) => {
                const newObject = gltf.scene;
                newObject.position.x += offsetValue;
                newObject.userData.path = path;
                if (path != "GLTF/catheterKit/2. Empty Pack.glb"){
                    kit.push(newObject);
                }
                scene.add(newObject);
            },
            undefined,
            (error) => console.error(`Error loading ${path}`, error)
        );
    });
    
}

let deflatedCatheter, inflatedCatheter, noSyringeCatheter , urineCatheter;
let urineBagMixer;

function loadInsertedCatheter() {
    loader.load('GLTF/deployed/Catheter Deployed_Deflated.glb', (gltf) => {
        deflatedCatheter = gltf.scene;
        deflatedCatheter.userData.path = 'GLTF/deployed/Catheter Deployed_Deflated.glb'; // Save path data
        deflatedCatheter.position.x += offsetValue;
        scene.add(deflatedCatheter);
        deflatedCatheter.visible = true;
        // kit.push(deflatedCatheter); // Add to kit array for collision detection
    });

    loader.load('GLTF/deployed/Catheter Deployed_Inflated.glb', (gltf) => {
        inflatedCatheter = gltf.scene;
        inflatedCatheter.userData.path = 'GLTF/deployed/Catheter Deployed_Inflated.glb'; // Save path data
        inflatedCatheter.position.x += offsetValue;
        scene.add(inflatedCatheter);
        inflatedCatheter.visible = false; // Initially hide the inflated catheter
        // kit.push(inflatedCatheter); // Add to kit array for collision detection
    });

    loader.load('GLTF/deployed/Urine Stage 1.glb', (gltf) => {
        urineCatheter = gltf.scene;
        urineCatheter.userData.path = 'GLTF/deployed/Urine Stage 1.glb'; // Save path data
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


    loader.load('GLTF/deployed/Catheter Deployed_No Syringe.glb', (gltf) => {
        noSyringeCatheter = gltf.scene;
        noSyringeCatheter.userData.path = 'GLTF/deployed/Catheter Deployed_No Syringe.glb'; // Save path data
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

/**
 * 
 * end of loading meshes
 */

// load open gloves model
function loadGlovesOpen() {   
    const sterileGlovesClosed = kit.find(obj => obj.userData.path === "GLTF/catheterKit/11. Sterile Gloves_Closed.glb");
    loader.load('GLTF/deployed/Open Gloves_New1.glb', (gltf) => {
        const glovesOpen = gltf.scene;
        glovesOpen.position.x += offsetValue; // Adjust position as needed
        glovesOpen.userData.path = 'GLTF/deployed/Open Gloves_New1.glb';
        // glovesOpen.position.set(-0.3, 0.82, 1.1);
        kit.push(glovesOpen);
        scene.add(glovesOpen);
    });
    if (sterileGlovesClosed) {
        scene.remove(sterileGlovesClosed);
        sterileGlovesClosed.visible = false; // Hide the closed gloves
        kit = kit.filter(obj => obj !== sterileGlovesClosed);
    }
}
// Define lubricant animation state variables

let lubricantObject = null, deployedLubricant = null;
// Start the lubricant animation
function animateLubricant() {
    lubricantObject = kit.find(obj => obj?.userData?.path === "GLTF/catheterKit/4. Lubricant.glb");
    deployedLubricant = deployedInstruments.find(obj => obj?.userData?.path === "GLTF/deployed/4. Lubricant.glb");
    if (!lubricantObject || !deployedLubricant) {
        console.error("Lubricant object or deployed lubricant not found");
        return;
    }
    lubricantObject.visible = false;
    deployedLubricant.visible = true;  
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
    // if (!catheterModel) return false
    const catheter = kit.find(obj => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb");
    const syringe = kit.find(obj => obj.userData.path === "GLTF/catheterKit/3. Saline Syringe.glb");

    if (!syringe) {
        console.error("Saline Syringe not found in kit");
        return false;
    }

    // Create bounding boxes for both the catheter and syringe
    const catheterBox = new THREE.Box3().setFromObject(catheter);
    const syringeBox = new THREE.Box3().setFromObject(syringe);

    if (catheterBox.intersectsBox(syringeBox)) {
        console.log("Catheter and syringe are colliding!");
    } else {
        console.log("Catheter and syringe are not colliding.");
    }

    // Check if the bounding boxes intersect
    return catheterBox.intersectsBox(syringeBox);
    // const catheter = kit.find(obj => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb");
    // const syringe = kit.find(obj => obj.userData.path === "GLTF/catheterKit/3. Saline Syringe.glb");

    // if (!catheter || !syringe) {
    //     console.error("Catheter or syringe not found in kit");
    //     return false;
    // }

    // // Create bounding boxes for catheter, syringe, and attachmentBox
    // const catheterBox = new THREE.Box3().setFromObject(catheter);
    // const syringeBox = new THREE.Box3().setFromObject(syringe);
    // const attachmentBoxBounds = new THREE.Box3().setFromObject(attachmentBox);

    // // Check if both catheter and syringe intersect with the attachmentBox
    // const catheterCollides = catheterBox.intersectsBox(attachmentBoxBounds);
    // const syringeCollides = syringeBox.intersectsBox(attachmentBoxBounds);

    // if (catheterCollides && syringeCollides) {
    //     console.log("Both catheter and syringe are colliding with the attachment box");
    //     return true;
    // }
    // console.log("Catheter and syringe are not colliding with the attachment box");
    // return false;
}
function checkCatheterCollisionWithUrineBag() {
    const urineBag = kit.find(obj => obj.userData.path === "GLTF/catheterKit/9. Urine Collection Bag.glb");
    if (!urineBag || !catheterModel) return false;

    // Create bounding boxes for both the urine bag and catheter model
    const urineBagBox = new THREE.Box3().setFromObject(urineBag);
    const catheterBox = new THREE.Box3().setFromObject(catheterModel);

    // Check if the bounding boxes intersect
    return urineBagBox.intersectsBox(catheterBox);

}
function attachSyringeToCatheter() {
    const syringe = kit.find(obj => obj.userData.path === "GLTF/catheterKit/3. Saline Syringe.glb");
    const catheter = kit.find(obj => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb");
    if (!syringe || !catheter) {
        console.error("Syringe or catheter model not found");
        return;
    }
    catheter.visible = false; // Hide the catheter model
    syringe.visible = false; // Hide the syringe model
    catheterModel.visible = true; 
    
}
function attachUrineBagToCatheter() {
    const urineBag = kit.find(obj => obj.userData.path === "GLTF/catheterKit/9. Urine Collection Bag.glb");
    
    if (!urineBag || !catheterModel) {
        console.error("Urine bag or catheter model not found");
        return;
    }
    urineBag.visible = false; // Hide the urine bag model
    urineBagModel.visible = true;
}
// Function to check if the tipBox intersects with insertionBox instead of pelvicObject
function checkCollisionWithInsertionBox() {
    if (!tipBox || !insertionBox) return;

    // Create bounding boxes for both the tipBox and insertionBox
    const tipBoxBounds = new THREE.Box3().setFromObject(tipBox);
    const insertionBoxBounds = new THREE.Box3().setFromObject(insertionBox);

    // Check if the bounding boxes intersect
    return tipBoxBounds.intersectsBox(insertionBoxBounds);
}

// Create a bounding box for swabs collision
const swabsBoundingGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
const swabsBoundingMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
const swabsBounding = new THREE.Mesh(swabsBoundingGeometry, swabsBoundingMaterial);
swabsBounding.position.set(1.25, 1, 0.176); // Adjust position as needed
swabsBounding.visible = false; // Set to false if you don't want it visible
scene.add(swabsBounding);

const swabsBoundingBox = new THREE.Box3().setFromObject(swabsBounding);

let swab1Collided = false;
let swab2Collided = false;
let swab3Collided = false;

function checkSwabsCollision() {
    const swab1 = kit.find(obj => obj.userData.path === "GLTF/catheterKit/5. Swabsticks1.glb");
    const swab2 = kit.find(obj => obj.userData.path === "GLTF/catheterKit/6. Swabsticks2.glb");
    const swab3 = kit.find(obj => obj.userData.path === "GLTF/catheterKit/7. Swabsticks3.glb");

    if (swab1) {
        const swab1Box = new THREE.Box3().setFromObject(swab1);
        if (swab1Box.intersectsBox(swabsBoundingBox)) {
            swab1Collided = true;
            console.log("Swab 1 collided with the swabs bounding box");
            outputPanel("Swabsticks is successfully used.", false);
        }
    }

    if (swab2) {
        const swab2Box = new THREE.Box3().setFromObject(swab2);
        if (swab2Box.intersectsBox(swabsBoundingBox)) {
            swab2Collided = true;
            console.log("Swab 2 collided with the swabs bounding box");
            outputPanel("Swabsticks is successfully used.", false);
        }
    }

    if (swab3) {
        const swab3Box = new THREE.Box3().setFromObject(swab3);
        if (swab3Box.intersectsBox(swabsBoundingBox)) {
            swab3Collided = true;
            console.log("Swab 3 collided with the swabs bounding box");
            outputPanel("Swabsticks is successfully used.", false);
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

let fulldrapeDisposed = false;
let fenestratedDrapeDisposed = false;
let swab1Disposed = false, swab2Disposed = false, swab3Disposed = false;
let glovesDisposed = false, lubricantDisposed = false;
// 
function checkDrapesCollisionWithTrashcan() {
    const deployedFullDrape = deployedInstruments.find(obj => obj.userData.path === "GLTF/deployed/FullDrape.glb");
    const deployedFenestratedDrape = deployedInstruments.find(obj => obj.userData.path === "GLTF/deployed/FenestratedDrape.glb");
    const trashcan = envMaterials.find(obj => obj.userData.path === "GLTF/environment/Medical Trashcan.glb");

    if (!deployedFullDrape || !deployedFenestratedDrape || !trashcan) {
        console.error("One or more objects (drapes or trashcan) are missing");
        return false;
    }

    // Create bounding boxes for the drapes and trashcan
    const fullDrapeBox = new THREE.Box3().setFromObject(deployedFullDrape);
    const fenestratedDrapeBox = new THREE.Box3().setFromObject(deployedFenestratedDrape);
    const trashcanBox = new THREE.Box3().setFromObject(trashcan);

    // Check if either drape intersects with the trashcan
    const fullDrapeCollides = fullDrapeBox.intersectsBox(trashcanBox);
    const fenestratedDrapeCollides = fenestratedDrapeBox.intersectsBox(trashcanBox);

    if (!fulldrapeDisposed) {
        if (fullDrapeCollides) {
            console.log("Deployed Full Drape collided with the trashcan");
            playSFX('public/sfx/trashcan_sfx.wav');
            deployedFullDrape.visible = false; // Hide the full drape
            scene.remove(deployedFullDrape);
            fulldrapeDisposed = true;
        }
    }

    if (!fenestratedDrapeDisposed) {
        if (fenestratedDrapeCollides) {
            console.log("Deployed Fenestrated Drape collided with the trashcan");
            playSFX('public/sfx/trashcan_sfx.wav');
            deployedFenestratedDrape.visible = false; // Hide the fenestrated drape
            deployedFenestratedDrape.position.set(4,4,4);
            scene.remove(deployedFenestratedDrape);
            fenestratedDrapeDisposed = true;
        }
    }
    
    if (fulldrapeDisposed && fenestratedDrapeDisposed) {
        nextActive = true; // Allow progression to the next step
    }

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
    const swab1 = kit.find(obj => obj.userData.path === "GLTF/catheterKit/5. Swabsticks1.glb");
    const swab2 = kit.find(obj => obj.userData.path === "GLTF/catheterKit/6. Swabsticks2.glb");
    const swab3 = kit.find(obj => obj.userData.path === "GLTF/catheterKit/7. Swabsticks3.glb");

    
    if (swab1 && !swab1Disposed) {
        const swab1Box = new THREE.Box3().setFromObject(swab1);
        if (swab1Box.intersectsBox(trashcanBox)) {
            console.log("Swabsticks1 collided with the trashcan");
            playSFX('public/sfx/trashcan_sfx.wav');
            swab1.visible = false; // Hide swabsticks1
            scene.remove(swab1);
            swab1Disposed = true;
        }
    }

    if (swab2 && !swab2Disposed) {
        const swab2Box = new THREE.Box3().setFromObject(swab2);
        if (swab2Box.intersectsBox(trashcanBox)) {
            console.log("Swabsticks2 collided with the trashcan");
            playSFX('public/sfx/trashcan_sfx.wav');
            swab2.visible = false; // Hide swabsticks2
            scene.remove(swab2);
            swab2Disposed = true;
        }
    }

    if (swab3 && !swab3Disposed) {
        const swab3Box = new THREE.Box3().setFromObject(swab3);
        if (swab3Box.intersectsBox(trashcanBox)) {
            console.log("Swabsticks3 collided with the trashcan");
            playSFX('public/sfx/trashcan_sfx.wav');
            swab3.visible = false; // Hide swabsticks3
            scene.remove(swab3);
            swab3Disposed = true;
        }
    }

    return fullDrapeCollides || fenestratedDrapeCollides;
}

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

function setupController(controller) {
    if (!controller) {
        console.error("Controller is not properly initialized.");
        return;
    }
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
    
    // Add a laser guide to the controller
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -0.01) // Direction of the laser
    ]);

    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const laser = new THREE.Line(laserGeometry, laserMaterial);
    laser.scale.z = 2; // Adjust the length of the laser

    controller.add(laser);
}

// Add laser to both hands
setupController(hand1);
setupController(hand2);

function onSelectStart(event) {
    selectState = true;
    const controller = event.target;
    const intersections = getIntersections(controller);
    if (intersections.length > 0) {
        const object = intersections[0].object;
        const parentObject = object.parent || object;
        controller.attach(parentObject);
        grabbedObjects.set(controller, parentObject);

        

        if (instructionNumber === 1) {
            const sterileGloves = kit.find(obj => obj.userData.path === "GLTF/catheterKit/11. Sterile Gloves_Closed.glb");
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

    if (grabbedObjects.has(controller)) { // for grabbing functionality
        const object = grabbedObjects.get(controller);
        scene.attach(object); // Release the object from the controller
        grabbedObjects.delete(controller);
    }
    
    // for putting on drapes
    if (instructionNumber == 2) { // step 2
        const fullDrape = kit.find(obj => obj.userData.path === "GLTF/catheterKit/12. Full Drape.glb");
        const deployedFullDrape = deployedInstruments.find(obj => obj.userData.path === "GLTF/deployed/FullDrape.glb");
        const fenestratedDrape = kit.find(obj => obj.userData.path === "GLTF/catheterKit/13. Fenestrated Drape.glb");
        const deployedFenestratedDrape = deployedInstruments.find(obj => obj.userData.path === "GLTF/deployed/FenestratedDrape.glb");
        const fenestratedDrapeBox = new THREE.Box3().setFromObject(fenestratedDrape);
        const fullDrapeBox = new THREE.Box3().setFromObject(fullDrape);
        const deploymentBoxBounds = new THREE.Box3().setFromObject(deploymentBox);
            
        if (fullDrapeBox.intersectsBox(deploymentBoxBounds)) {
            scene.remove(fullDrape);
            deployedFullDrape.visible = true;
        } 
        if (fenestratedDrapeBox.intersectsBox(deploymentBoxBounds)) {
            scene.remove(fenestratedDrape);
            deployedFenestratedDrape.visible = true;
        }
        
        // Check if both fullDrape and fenestratedDrape are removed from the scene
        if (!scene.children.includes(fullDrape) && !scene.children.includes(fenestratedDrape)) {
            nextActive = true;
        }
    }  else if (instructionNumber === 4) { // step 3
        const lubricant = kit.find(obj => obj.userData.path === "GLTF/catheterKit/4. Lubricant.glb");
        const lubricantBox = new THREE.Box3().setFromObject(lubricant);
        const catheter = kit.find(obj => obj.userData.path === "GLTF/catheterKit/10. Catheter.glb");
        const catheterBox = new THREE.Box3().setFromObject(catheter);
        if (!lubricated){
            if (lubricantBox.intersectsBox(kitboundingBox) && catheterBox.intersectsBox(kitboundingBox)) {
                animateLubricant();
                lubricated = true;
                nextActive = true;  
            } 
     }
    } else if (instructionNumber === 5){ //step 4
        if (checkCatheterCollisionWithSyringe()){
            // nextActive = true;
            attachSyringeToCatheter();
        } if (checkCatheterCollisionWithUrineBag()){
            nextActive = true;
            attachUrineBagToCatheter();
        }
        
    }

    else if (instructionNumber === 3) {
        checkDrapesCollisionWithTrashcan();
    }
    
    else if (instructionNumber === 6) { // step 6
        // Check if the collision box is colliding 
        if (!nextActive) {
            if (checkCollisionWithInsertionBox()) {
                isError = false;
                message = "Great Job!";
                sphereIndicator.visible = false;
                outputPanel(message, isError);
                catheterModel.visible = false; // Hide the catheter model
                // catheterModel.position.set(offsetValue, 0, 0); //reset the position of catheter for syringe bounding box
                
                loadInsertedCatheter(); //Deploying inserted Catheter
                nextActive = true;
                inflateButton();
            } else {
                isError = true;
                message = "Reinsert the catheter into the urethral opening";
                outputPanel(message, isError);
            }
    }

    } else if (instructionNumber === 9 ) {
        if (checkDrapesCollisionWithTrashcan()) {
            console.log("Drapes has been disposed.");
            // nextActive = true;
        }
    }
    
    
}



// Set up controllers
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
scene.add(controller1);
scene.add(controller2);

// Attach helper spheres to visualize the controllers
const controller1Helper = new THREE.Mesh(
    new THREE.SphereGeometry(0.01),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
controller1.add(controller1Helper);

const controller2Helper = new THREE.Mesh(
    new THREE.SphereGeometry(0.01),
    new THREE.MeshBasicMaterial({ color: 0x0000ff })
);
controller2.add(controller2Helper);

// Add controller grips
const controllerGrip1 = renderer.xr.getControllerGrip(0);
const controllerGrip2 = renderer.xr.getControllerGrip(1);
scene.add(controllerGrip1);
scene.add(controllerGrip2);



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
    if (!catheterModel && kit.length === 0) {
        return [];
    }

    // Only raycast against layer 0 (grabbable objects)
    raycaster.layers.set(0);

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const targets = instructionNumber === 9
        ? [catheterModel, ...kit, ...deployedInstruments]
        : [catheterModel, ...kit];

    return raycaster.intersectObjects(targets, true);
}



// Handle controller interactions
setupController(controller1);
setupController(controller2);


const clock = new THREE.Clock();

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    if (urineBagMixer) {
        urineBagMixer.update(delta); // update the animation
    }

    // UI updates
    ThreeMeshUI.update();   
    updateButtons();

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
        requestAnimationFrame(animate);

        if (instructionNumber === 3) {
            checkSwabsCollision();
        }
    } 
    else {
        renderer.render(scene, camera);
    }
}

renderer.setAnimationLoop(animate);

// Handle window resize
window.addEventListener('resize', () => {
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
