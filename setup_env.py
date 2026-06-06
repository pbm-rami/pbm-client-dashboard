#!/usr/bin/env python3
import json, sys, os, glob

# Find the GCP key file
downloads = os.path.expanduser("~/Downloads")
matches = glob.glob(os.path.join(downloads, "*.json"))

# Filter to service account files
sa_files = []
for f in matches:
    try:
        with open(f) as fp:
            data = json.load(fp)
        if data.get("type") == "service_account":
            sa_files.append((f, data))
    except:
        pass

if not sa_files:
    print("ERROR: No service account JSON files found in ~/Downloads")
    print("Files found:", matches)
    sys.exit(1)

if len(sa_files) > 1:
    print("Multiple service account files found — using the most recent one:")
    sa_files.sort(key=lambda x: os.path.getmtime(x[0]), reverse=True)

filepath, data = sa_files[0]
print(f"Using: {filepath}")
print(f"Project: {data.get('project_id')}")
print(f"Account: {data.get('client_email')}")

# Write .env.local
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
json_str = json.dumps(data, separators=(',', ':'))  # compact, no extra spaces

with open(env_path, "w") as f:
    f.write(f"GCP_PROJECT_ID=pbm-pl-data-bank\n")
    f.write(f"GCP_SERVICE_ACCOUNT_JSON={json_str}\n")

print(f"\n.env.local written successfully to: {env_path}")
print(f"JSON length: {len(json_str)} characters")
