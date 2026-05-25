import time

# Tests Python streaming output — each number prints with a short delay.
print("Fibonacci sequence:")
a, b = 0, 1
for _ in range(15):
    print(f"  {a}")
    a, b = b, a + b
    time.sleep(0.2)

print("Done.")
