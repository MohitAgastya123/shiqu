"""Prove copy exits with JSON and no input even when stdin and stderr are real terminals."""
import errno
import json
import os
from pathlib import Path
import pty
import select
import subprocess
import sys
import time

repo, node, source, target, story_id, request_id = sys.argv[1:7]
extra = sys.argv[7:]
master, slave = pty.openpty()
program = (
    "globalThis.fetch=async()=>{throw Error('TEST_EXTERNAL_NETWORK_DISABLED')};"
    "const {runCli}=await import(" + json.dumps((Path(repo) / "server/cli.ts").as_uri()) + ");"
    "await runCli(process.argv[1],process.argv.slice(2));"
)
args = [node, "--experimental-strip-types", "--input-type=module", "-e", program, repo,
        "stories", "copy", story_id, "--from-data-dir", source, "--data-dir", target,
        "--request-id", request_id, *extra]
child = subprocess.Popen(args, stdin=slave, stdout=subprocess.PIPE, stderr=slave, start_new_session=True)
os.close(slave)
transcript = b""
try:
    deadline = time.monotonic() + 5
    while child.poll() is None and time.monotonic() < deadline:
        if select.select([master], [], [], 0.1)[0]:
            try:
                chunk = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
            transcript += chunk
            assert "是否复制".encode() not in transcript, transcript.decode(errors="replace")
    stdout, _ = child.communicate(timeout=5)
    assert child.returncode == 0, (child.returncode, stdout, transcript.decode(errors="replace"))
    receipt = json.loads(stdout)
    assert receipt["ok"] is True
    print(json.dumps({"receipt": receipt}, ensure_ascii=False))
finally:
    if child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
    os.close(master)
