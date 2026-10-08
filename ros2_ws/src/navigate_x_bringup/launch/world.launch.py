from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.substitutions import FindPackageShare

def generate_launch_description():
    world = PathJoinSubstitution([
        FindPackageShare("navigate_x_description"),
        "worlds",
        "subterranean.world.sdf",
    ])
    return LaunchDescription([
        DeclareLaunchArgument("paused", default_value="false"),
        ExecuteProcess(
            cmd=["gz", "sim", "-r", world],
            output="screen",
        ),
    ])
