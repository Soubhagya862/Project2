# NAVIGATE-X

GPS-Denied Autonomous Exploration and Navigation System

## Mission
NAVIGATE-X is a ROS 2 + PX4 SITL simulation for autonomous navigation inside subterranean tunnels and caves without GPS.

Initial stack:
- Ubuntu 22.04 LTS
- ROS 2 Humble
- Gazebo / Gazebo Sim
- PX4 SITL
- Iris quadcopter
- Simulated 3D LiDAR + IMU + RGB camera
- FAST-LIO2-ready sensor pipeline
- OctoMap-ready occupancy mapping
- Autonomous exploration planner interface
- PX4 Offboard velocity-control interface
- RViz2 visualization

GPS is intentionally not used by the navigation stack.

## Build
cd ros2_ws
source /opt/ros/humble/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 launch navigate_x_bringup simulation.launch.py

Milestone 1 establishes the clean ROS 2 workspace, package structure, subterranean world, drone model, and bringup structure. Estimation, mapping, exploration, and Offboard control are integrated incrementally.
