# Loading Manager Implementation Documentation

## Overview

This document details the comprehensive loading manager system implemented in the VR Catheter Simulation application. The system coordinates the loading of multiple GLB model categories and provides user feedback through an HTML loading overlay while ensuring the XR experience only starts when all required assets are ready.

## Architecture

### Loading Manager Object

The core loading manager is implemented as a JavaScript object that tracks and coordinates multiple model loading operations:

```javascript
let loadingManager = {
    totalLoaders: 0,
    completedLoaders: 0,
    isMainMenuLoaded: false,
    
    registerLoader: function() {
        this.totalLoaders++;
        console.log(`Registered loader ${this.totalLoaders}`);
    },
    
    completeLoader: function(loaderName) {
        this.completedLoaders++;
        console.log(`Completed loader: ${loaderName} (${this.completedLoaders}/${this.totalLoaders})`);
        
        if (this.completedLoaders >= this.totalLoaders && !this.isMainMenuLoaded) {
            this.hideLoadingIndicator();
        }
    },
    
    hideLoadingIndicator: function() {
        this.isMainMenuLoaded = true;
        console.log("🎉 All main models loaded! Hiding loading indicator...");
        
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            // Update loading text to indicate completion
            const loadingText = loadingOverlay.querySelector('.loading-text');
            const loadingSubtext = loadingOverlay.querySelector('.loading-subtext');
            if (loadingText && loadingSubtext) {
                loadingText.textContent = "Loading Complete!";
                loadingSubtext.textContent = "VR experience is ready to start";
            }
            
            // Wait a moment to show the completion message, then hide
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
                
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
            xrButton.style.opacity = '1';
            xrButton.style.cursor = 'pointer';
            xrButton.style.pointerEvents = 'auto';
            xrButton.style.filter = 'none'; // Remove grayscale filter
            console.log("✅ XR button enabled - ready to start VR experience!");
        }
    }
};
```

## Model Loading Categories

### 1. Environment Models

**Purpose**: Non-grabbable scene objects (table, patient, bed, etc.)
**Registration**: Called in `loadEnvironment()`

```javascript
function loadEnvironment() {
    loadingManager.registerLoader();
    
    let loadedCount = 0;
    const totalItems = environment.length;
    
    environment.forEach(({ path }) => {
        loader.load(
            path,
            (gltf) => {
                // Model processing...
                loadedCount++;
                if (loadedCount === totalItems) {
                    loadingManager.completeLoader('Environment');
                }
            },
            undefined,
            (error) => console.error("Error loading assets", error)
        );
    });
}
```

**Models Loaded**:
- Table.glb
- Patient_Upper.glb  
- Patient_Lower.glb
- Delivery Bed.glb
- Medical Trashcan.glb
- 1. Foley Pack_Whole.glb

### 2. Catheter Kit Models

**Purpose**: Interactive medical instruments
**Registration**: Called in `loadKit()`

```javascript
function loadKit(){
    loadingManager.registerLoader();
    
    let loadedCount = 0;
    const totalItems = catheterKit.length;
    
     catheterKit.forEach(({ path }) => {
        loader.load(
            path,
            (gltf) => {
                // Model processing...
                loadedCount++;
                if (loadedCount === totalItems) {
                    loadingManager.completeLoader('Kit');
                }
            },
            undefined,
            (error) => console.error(`Error loading ${path}`, error)
        );
    });
}
```

**Models Loaded** (12 items):
- 2. Empty Pack.glb
- 3. Saline Syringe.glb
- 4. Lubricant.glb
- 5-7. Swabsticks1-3.glb
- 8. Povidone Iodine Solution.glb
- 9. Urine Collection Bag.glb
- 10. Catheter.glb
- 11. Sterile Gloves_Closed.glb
- 12. Full Drape.glb
- 13. Fenestrated Drape.glb

### 3. Deployed Instrument Models

**Purpose**: Pre-positioned/animated versions of instruments
**Registration**: Called in `loadDeployed()`

```javascript
function loadDeployed(){
    loadingManager.registerLoader();
    
    const deployedName = [
        { path: "GLTF/deployed/FenestratedDrape.glb" },
        { path: "GLTF/deployed/FullDrape.glb" },
        { path: "GLTF/deployed/4. Lubricant.glb" }
    ];
    
    let loadedCount = 0;
    const totalItems = deployedName.length;

    deployedName.forEach(({ path }) => {
        loader.load(
            path,
            (gltf) => {
                // Model processing...
                loadedCount++;
                if (loadedCount === totalItems) {
                    loadingManager.completeLoader('Deployed');
                }
            },
            undefined,
            (error) => console.error(`Error loading ${path}`, error)
        );
    });
}
```

### 4. Combined Catheter Models

**Purpose**: Pre-assembled catheter combinations for workflow
**Registration**: Called in `loadCombinedCatheterModels()`

```javascript
function loadCombinedCatheterModels() {
    loadingManager.registerLoader();
    
    let loadedCount = 0;
    const totalItems = 2;
    
    // Load catheter with syringe model
    loader.load('GLTF/deployed/Catheter_With_Syringe.glb', (gltf) => {
        // Model processing...
        loadedCount++;
        if (loadedCount === totalItems) {
            loadingManager.completeLoader('CombinedCatheter');
        }
    });

    // Load catheter with syringe and urine bag model
    loader.load('GLTF/deployed/Catheter_with_Syringe_and_Bag.glb', (gltf) => {
        // Model processing...
        loadedCount++;
        if (loadedCount === totalItems) {
            loadingManager.completeLoader('CombinedCatheter');
        }
    });
}
```

## HTML Loading Overlay Integration

### Required HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VR Catheter Simulation</title>
    <style>
        /* Loading overlay styles */
        #loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            transition: opacity 0.5s ease-out;
        }
        
        #loading-overlay.hidden {
            opacity: 0;
            pointer-events: none;
        }
        
        .loading-text {
            color: white;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .loading-subtext {
            color: #ccc;
            font-size: 16px;
        }
        
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 20px 0;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <!-- Loading Overlay -->
    <div id="loading-overlay">
        <div class="loading-text">Loading VR Experience</div>
        <div class="loading-spinner"></div>
        <div class="loading-subtext">Preparing medical simulation assets...</div>
    </div>
    
    <!-- Main Canvas -->
    <canvas class="webGL"></canvas>
    
    <!-- Scripts -->
    <script type="module" src="main.js"></script>
</body>
</html>
```

## XR Button Management

### Initial Disabled State

```javascript
const xrButton = XRButton.createButton(renderer, sessionInit);

// Disable the XR button initially until models are loaded
xrButton.disabled = true;
xrButton.style.opacity = '0.5';
xrButton.style.cursor = 'not-allowed';
xrButton.style.pointerEvents = 'none';
xrButton.style.filter = 'grayscale(1)';

document.body.appendChild(xrButton);
```

### Enabled State (After Loading Complete)

The loading manager automatically enables the XR button:

```javascript
// Enable the XR button now that all models are loaded
if (xrButton) {
    xrButton.disabled = false;
    xrButton.style.opacity = '1';
    xrButton.style.cursor = 'pointer';
    xrButton.style.pointerEvents = 'auto';
    xrButton.style.filter = 'none'; // Remove grayscale filter
    console.log("XR button enabled - ready to start VR experience!");
}
```

## Implementation Flow

### 1. Application Startup

```javascript
// Initialize loading manager (automatic - object literal)
let loadingManager = { /* ... */ };

// Create disabled XR button
const xrButton = XRButton.createButton(renderer, sessionInit);
// ... disable button styling

// Start loading all model categories
function mainMenu() {
    loadDeployed();              // Registers 1 loader
    loadCombinedCatheterModels(); // Registers 1 loader  
    loadEnvironment();           // Registers 1 loader
    loadKit();                   // Registers 1 loader
    // Total: 4 loaders registered
}
```

### 2. Model Loading Process

```javascript
// Each loader function:
// 1. Calls loadingManager.registerLoader()
// 2. Loads models asynchronously
// 3. Tracks completion count
// 4. Calls loadingManager.completeLoader(name) when done
```

### 3. Completion Detection

```javascript
// When completedLoaders >= totalLoaders:
// 1. Update loading overlay text
// 2. Hide overlay with smooth transition
// 3. Enable XR button
// 4. Remove overlay from DOM
```

## Benefits

### User Experience
- **Visual Feedback**: Users see loading progress and status updates
- **Smooth Transitions**: Animated overlay hide with completion message
- **Clear State**: XR button is clearly disabled until ready

### Technical Benefits
- **Race Condition Prevention**: Ensures all assets loaded before VR starts
- **Memory Management**: Proper cleanup of loading overlay
- **Error Handling**: Individual loader error handling
- **Debugging**: Console logging for development tracking

### Performance
- **Parallel Loading**: All model categories load simultaneously
- **Resource Optimization**: Models only become visible when needed
- **State Management**: Clean separation of loading vs. runtime state

## Usage Guidelines

### Adding New Model Categories

1. **Register the loader**:
   ```javascript
   function loadNewCategory() {
       loadingManager.registerLoader(); // Add this line
       // ... loading logic
   }
   ```

2. **Complete the loader**:
   ```javascript
   if (loadedCount === totalItems) {
       loadingManager.completeLoader('NewCategory'); // Add this line
   }
   ```

3. **Call from main initialization**:
   ```javascript
   function mainMenu() {
       // ... existing loaders
       loadNewCategory(); // Add new category
   }
   ```

### Debugging Loading Issues

- Check console for loader registration/completion logs
- Verify `totalLoaders` matches number of `registerLoader()` calls
- Ensure each category calls `completeLoader()` exactly once
- Validate HTML overlay elements exist with correct IDs

## Best Practices

1. **Always register before loading**: Call `registerLoader()` at the start of each loading function
2. **Handle errors gracefully**: Include error callbacks in loader.load() calls  
3. **Use descriptive names**: Pass meaningful names to `completeLoader()`
4. **Test loading states**: Verify behavior with slow network conditions
5. **Cleanup properly**: Ensure overlay removal and XR button state management

This loading manager implementation provides a robust foundation for coordinating complex 3D asset loading while maintaining excellent user experience in VR applications. 