import subprocess
import time
import sys
import os

# Start uvicorn in background
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"],
    cwd=os.getcwd(),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

print("Started FastAPI with PID: {}".format(proc.pid))
print("Waiting for server to start...")
time.sleep(3)

# Check if process is still running
if proc.poll() is None:
    print("FastAPI server is running!")
    # Save PID to file
    with open("C:\\temp\\uvicorn.pid", "w") as f:
        f.write(str(proc.pid))
else:
    stdout, stderr = proc.communicate()
    print("Server failed to start:")
    print(stderr.decode())