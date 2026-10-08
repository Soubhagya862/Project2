from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare

def generate_launch_description():
    world_launch = PathJoinSubstitution([
        FindPackageShare("navigate_x_bringup"), "launch", "world.launch.py"
    ])
    return LaunchDescription([
        IncludeLaunchDescription(PythonLaunchDescriptionSource(world_launch)),
        Node(
            package="navigate_x_navigation",
            executable="mission_manager",
            name="mission_manager",
            output="screen",
        ),
        Node(
            package="navigate_x_navigation",
            executable="frontier_planner",
            name="frontier_planner",
            output="screen",
        ),
        Node(
            package="navigate_x_navigation",
            executable="state_bridge",
            name="state_bridge",
            output="screen",
        ),
    ])
