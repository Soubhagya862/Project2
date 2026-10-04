# NAVIGATE-X

**GPS-Denied Autonomous Navigation & Emergency Path Planning System**

NAVIGATE-X is a MERN-based browser simulation of an autonomous device navigating in a GPS-denied environment. It combines a 3D React/Three.js simulator, six-direction simulated sensors, 3D A* path planning, dynamic obstacle detection, automatic replanning, emergency autopilot, live telemetry, MongoDB persistence, and a Socket.IO phone controller.

## Main Features

- React + Three.js 3D simulation
- 3D A* route planning with obstacle avoidance
- Front/back/left/right/up/down sensor visualization
- Dynamic obstacle injection during a mission
- Automatic route replanning
- GPS CONNECTED / GPS DENIED emergency mode
- Autonomous target navigation and landing
- 10-second landing wait
- Automatic return-to-home
- Mission completion state
- Live position, altitude, speed, heading, distance and sensor telemetry
- MongoDB mission/telemetry storage
- Express REST APIs
- Socket.IO real-time phone control
- Mobile controller at /phone

## Mission Flow

GPS CONNECTED -> Create Mission -> 3D A* -> Autonomous Navigation -> Target -> Landing -> Wait 10 seconds -> Return Home -> Home Landed -> Mission Complete

If GPS is lost: GPS DENIED -> EMERGENCY AUTOPILOT -> Sensor + A* navigation.

If an obstacle blocks the route: Sensor Detection -> Replanning -> New Safe A* Route -> Navigation.

## MERN Architecture

Frontend: React, Vite, Three.js, React Three Fiber, Drei, Socket.IO Client.

Backend: Node.js, Express, Mongoose, MongoDB, Socket.IO.

Frontend responsibilities: 3D scene, device movement, target, obstacles, sensor rays, route visualization, mission controls, telemetry and phone interaction.

Backend responsibilities: mission persistence, telemetry persistence, obstacle persistence, route calculation API and real-time communication.

## Important API Endpoints

GET /api/health

POST /api/missions
GET /api/missions
GET /api/missions/:id
PATCH /api/missions/:id
POST /api/missions/:id/start
POST /api/missions/:id/stop
POST /api/missions/:id/gps/disconnect
POST /api/missions/:id/gps/restore

POST /api/routes/calculate
POST /api/routes/replan

POST /api/telemetry
GET /api/telemetry/:missionId

POST /api/obstacles
GET /api/obstacles/:missionId

## Run Locally

Backend terminal:

cd "C:\\Users\\test\\OneDrive\\Desktop\\Tesr\\Project2\\backend"
npm install
npm run dev

Frontend terminal:

cd "C:\\Users\\test\\OneDrive\\Desktop\\Tesr\\Project2\\frontend"
npm install
npm run dev

Main application: http://localhost:5173
Phone controller: http://localhost:5173/phone
Backend: http://localhost:5000

## Environment

Backend .env:
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/navigate_x
CLIENT_URL=http://localhost:5173

Frontend .env:
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

MongoDB is required for persistent missions and telemetry. The route simulator can still operate when MongoDB is not configured.

## Demo Flow

1. Start backend and frontend.
2. Calculate 3D A*.
3. Create Mission.
4. Start Autonomous Mission.
5. Disconnect GPS to demonstrate emergency navigation.
6. Inject a Dynamic Obstacle.
7. Show sensor detection and automatic replanning.
8. Let the device reach the target and land.
9. Show the 10-second wait.
10. Show automatic return-to-home and Mission Complete.
11. Open /phone on another device to demonstrate remote commands and telemetry.

## Viva Explanation

The core problem is navigation when GPS cannot be trusted. NAVIGATE-X simulates alternative sensing and deterministic path planning. A* searches a 3D grid while rejecting obstacle cells. When the environment changes, the current route is discarded and a new route is calculated from the current position to the target. MongoDB stores mission and telemetry history, while Socket.IO provides real-time phone control and telemetry.

## Future Extensions

IMU/barometer simulation, visual odometry, SLAM-style mapping, camera/video feed, authentication, role-based dashboards, mission replay, analytics, multi-device fleet management, and an AI mission assistant.

## Repository

https://github.com/Soubhagya862/Project2
