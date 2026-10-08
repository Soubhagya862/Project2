import math
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist

class FrontierPlanner(Node):
    def __init__(self):
        super().__init__("navigate_x_frontier_planner")
        self.cmd_pub = self.create_publisher(Twist, "/navigate_x/planner/cmd_vel", 10)
        self.timer = self.create_timer(0.2, self.tick)
        self.enabled = False

    def tick(self):
        cmd = Twist()
        if self.enabled:
            cmd.linear.x = 0.5
        self.cmd_pub.publish(cmd)

def main(args=None):
    rclpy.init(args=args)
    node = FrontierPlanner()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == "__main__":
    main()
