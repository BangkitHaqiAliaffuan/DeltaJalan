import json, urllib.request, asyncio, websockets

PORT = 9226

async def capture():
    pages = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json', timeout=5).read())
    ws_url = pages[0]["webSocketDebuggerUrl"]

    async with websockets.connect(ws_url, max_size=2**20, open_timeout=8) as ws:
        await ws.send(json.dumps({"id":1,"method":"Runtime.enable"}))
        await ws.send(json.dumps({"id":2,"method":"Log.enable"}))
        await asyncio.sleep(1)

        # Check body child structure
        await ws.send(json.dumps({"id":3,"method":"Runtime.evaluate","params":{
            "expression": """
JSON.stringify({
  className: document.documentElement.className,
  bodyChildren: document.body.children.length,
  bodyHTMLlen: document.body.innerHTML.length,
  bodyScripts: Array.from(document.body.querySelectorAll('script')).map(s => s.className || s.id || s.type || 'inline').join(', '),
  hasBarrier: !!document.getElementById('$tsr-stream-barrier'),
  barrierInDOM: !!document.querySelector('script.$tsr'),
  scripts: document.scripts.length,
  headScripts: document.head.querySelectorAll('script').length
})
""",
            "returnByValue": True
        }}))
        await asyncio.sleep(2)

        msgs = []
        try:
            while True:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
                msgs.append(msg)
        except asyncio.TimeoutError:
            pass

        for m in msgs:
            if "id" in m and m.get("id") == 3:
                print("STATE:", m.get("result",{}).get("result",{}).get("value","N/A"))

        # Check CONSOLE ERRORS specifically
        errors = [m for m in msgs if m.get("method") == "Runtime.consoleAPICalled" and m["params"]["type"] == "error"]
        if errors:
            print(f"\nERRORS ({len(errors)}):")
            for e in errors:
                args = e["params"]["args"]
                txt = " ".join(str(a.get("value","") or a.get("description",""))[:300] for a in args)
                print(f"  {txt[:500]}")

asyncio.run(capture())
