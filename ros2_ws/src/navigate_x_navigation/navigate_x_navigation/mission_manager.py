import enum
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

class MissionState(enum.Enum):
    IDLE = "IDLE"
    ARMING = "ARMING"
    TAKEOFF = "TAKEOFF"
    EXPLORE = "EXPLORE"
    TARGET_REACHED = "TARGET_REACHED"
    LANDING = "LANDING"
    WAIT_10S = "WAIT_10S"
    RETURN_HOME = "RETURN_HOME"
    COMPLETE = "COMPLETE"
    EMERGENCY_NAV = "EMERGENCY_NAV"

class MissionManager(Node):
    def __init__(self):
        super().__init__("navigate_x_mission_manager")
        self.state = MissionState.IDLE
        self.pub = self.create_publisher(String, "/navigate_x/mission_state", 10)
        self.timer = self.create_timer(0.2, self.publish_state)

    def publish_state(self):
        msg = String()
        msg.data = self.state.value
        self.pub.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    node = MissionManager()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == "__main__":
    main()
