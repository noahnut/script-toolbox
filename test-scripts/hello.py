import sys
import platform

print("Hello from Python!")
print(f"Version:  {sys.version.split()[0]}")
print(f"Platform: {platform.system()} {platform.machine()}")
