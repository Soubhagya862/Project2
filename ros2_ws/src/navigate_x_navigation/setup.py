from setuptools import setup

package_name = "navigate_x_navigation"

setup(
    name=package_name,
    version="0.1.0",
    packages=[package_name],
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    entry_points={
        "console_scripts": [
            "offboard_control = navigate_x_navigation.offboard_control:main",
            "state_bridge = navigate_x_navigation.state_bridge:main",
        ],
    },
)
