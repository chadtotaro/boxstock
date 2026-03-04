import hid, time

VENDOR_ID = 0x10C4
PRODUCT_ID = 0x86B9

device = hid.device()
device.open(VENDOR_ID, PRODUCT_ID)
device.set_nonblocking(True)

# Set 38400 baud properly
device.send_feature_report([0x41, 0x00])
time.sleep(0.05)
baud = 38400
device.send_feature_report([
    0x50,
    (baud >> 24) & 0xFF, (baud >> 16) & 0xFF,
    (baud >> 8) & 0xFF, baud & 0xFF,
    0x00, 0x00, 0x03, 0x00,
])
time.sleep(0.05)
device.send_feature_report([0x41, 0x01])
time.sleep(0.2)

# Drain
for _ in range(100):
    device.read(64)
    time.sleep(0.003)

# Send init
device.write([0x01, 0x00])
time.sleep(0.5)

# Drain post-init
for _ in range(100):
    device.read(64)
    time.sleep(0.003)

print("=== IDLE - Do NOT drive. 10 seconds... ===\n")
idle = []
start = time.time()
while time.time() - start < 10:
    data = device.read(64)
    if data:
        uart = bytes(data[1:1+data[0]])
        idle.append(uart)
        h = " ".join(f"{b:02X}" for b in uart)
        print(f"IDLE: {h}")
    time.sleep(0.01)

print(f"\n=== {len(idle)} idle packets ===")
print("=== ACTIVE - Drive car over loop NOW! 20 seconds... ===\n")

active = []
start = time.time()
while time.time() - start < 20:
    data = device.read(64)
    if data:
        uart = bytes(data[1:1+data[0]])
        active.append(uart)
        h = " ".join(f"{b:02X}" for b in uart)
        t = f"{time.time() - start:.2f}s"
        print(f"CAR [{t}]: {h}")
    time.sleep(0.01)

print(f"\n=== {len(active)} active packets ===")
device.close()
print("Done.")
