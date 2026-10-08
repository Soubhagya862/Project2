# NAVIGATE-X

## GPS-Denied Autonomous Navigation & Dynamic Path Planning

NAVIGATE-X is a MERN-based 3D web simulator for autonomous navigation in GPS-denied environments.

### Core concept
- 5 km × 5 km simulated environments
- Mountain and multi-cave environment with night vision
- Forest environment
- Plain environment with scattered trees
- User-defined waypoint/path planning
- Manual controller mode
- AI autonomous navigation mode
- Emergency autonomous return mode
- VPS (Visual Positioning System) simulation instead of GPS
- Camera and distance-sensor obstacle detection
- Dynamic local obstacle avoidance
- Navigation memory
- Target landing, 10-second wait, automatic takeoff and return-to-home

### Stack
- React + Vite
- Three.js + React Three Fiber + Drei
- Node.js + Express
- MongoDB + Mongoose

> This repository starts the clean implementation of NAVIGATE-X. Real ML/computer-vision models will only be described as AI when an actual model is integrated; the initial navigation engine uses deterministic planning and sensor simulation.
