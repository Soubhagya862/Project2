import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped
from nav_msgs.msg import Odometry
from sensor_msgs.msg import Imu, PointCloud2

class StateBridge(Node):
    def __init__(self):
        super().__init__("navigate_x_state_bridge")
        self.pose_pub = self.create_publisher(PoseStamped, "/navigate_x/vps/pose", 10)
        self.odom_sub = self.create_subscription(
            Odometry, "/fast_lio/odometry", self.odom_callback, 20
        )
        self.imu_sub = self.create_subscription(
            Imu, "/imu/data", self.imu_callback, 20
        )
        self.lidar_sub = self.create_subscription(
            PointCloud2, "/livox/lidar", self.lidar_callback, 5
        )
        self.last_imu = None
        self.last_cloud = None

    def imu_callback(self, msg):
        self.last_imu = msg

    def lidar_callback(self, msg):
        self.last_cloud = msg

    def odom_callback(self, msg):
        pose = PoseStamped()
        pose.header = msg.header
        pose.header.frame_id = "map"
        pose.pose = msg.pose.pose
        self.pose_pub.publish(pose)

def main(args=None):
    rclpy.init(args=args)
    node = StateBridge()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == "__main__":
    main()
