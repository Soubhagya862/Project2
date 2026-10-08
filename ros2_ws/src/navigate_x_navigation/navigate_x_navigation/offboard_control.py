import rclpy
from rclpy.node import Node
from px4_msgs.msg import OffboardControlMode, TrajectorySetpoint, VehicleCommand

class OffboardController(Node):
    def __init__(self):
        super().__init__("navigate_x_offboard_controller")
        self.timer = self.create_timer(0.1, self.timer_callback)
        self.offboard_pub = self.create_publisher(
            OffboardControlMode, "/fmu/in/offboard_control_mode", 10
        )
        self.setpoint_pub = self.create_publisher(
            TrajectorySetpoint, "/fmu/in/trajectory_setpoint", 10
        )
        self.command_pub = self.create_publisher(
            VehicleCommand, "/fmu/in/vehicle_command", 10
        )
        self.counter = 0
        self.target_x = 10.0
        self.target_y = 0.0
        self.target_z = -3.0

    def timer_callback(self):
        now = self.get_clock().now().nanoseconds // 1000

        mode = OffboardControlMode()
        mode.timestamp = now
        mode.position = False
        mode.velocity = True
        mode.acceleration = False
        mode.attitude = False
        mode.body_rate = False
        self.offboard_pub.publish(mode)

        sp = TrajectorySetpoint()
        sp.timestamp = now
        sp.velocity = [0.0, 0.0, 0.0]
        sp.position = [self.target_x, self.target_y, self.target_z]
        self.setpoint_pub.publish(sp)

        self.counter += 1
        if self.counter == 20:
            self.publish_command(VehicleCommand.VEHICLE_CMD_DO_SET_MODE, 1.0, 6.0)
        if self.counter == 25:
            self.publish_command(VehicleCommand.VEHICLE_CMD_COMPONENT_ARM_DISARM, 1.0)

    def publish_command(self, command, param1=0.0, param2=0.0):
        msg = VehicleCommand()
        msg.timestamp = self.get_clock().now().nanoseconds // 1000
        msg.command = command
        msg.param1 = param1
        msg.param2 = param2
        msg.target_system = 1
        msg.target_component = 1
        msg.source_system = 1
        msg.source_component = 1
        msg.from_external = True
        self.command_pub.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    node = OffboardController()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == "__main__":
    main()
