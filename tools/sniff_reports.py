import hid

VENDOR_ID = 0x10C4
PRODUCT_ID = 0x86B9

device = hid.device()
device.open(VENDOR_ID, PRODUCT_ID)

report_ids = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
              0x10, 0x11, 0x12, 0x13, 0x20, 0x21, 0x30, 0x40,
              0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x50]

for rid in report_ids:
    try:
        data = device.get_feature_report(rid, 64)
        if data:
            hex_str = " ".join(f"{b:02X}" for b in data)
            print(f"Report 0x{rid:02X}: {hex_str}")
    except Exception as e:
        print(f"Report 0x{rid:02X}: {e}")

device.close()
