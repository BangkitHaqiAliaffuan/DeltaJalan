import json, urllib.request, asyncio, websockets

async def capture():
    pages = json.loads(urllib.request.urlopen('http://localhost:9222/json', timeout=5).read())
    print('Available pages:')
    for p in pages:
        pid = (p.get('id') or '?')[:20]
        print(f'  id={pid!r} title={p.get("title")!r} url={p.get("url")!r} has_ws={p.get("webSocketDebuggerUrl") is not None}')
    
    ws_url = pages[0]['webSocketDebuggerUrl']
    print(f'\nUsing ws: {ws_url}')
    
    async with websockets.connect(ws_url, max_size=2**20, open_timeout=8) as ws:
        await ws.send(json.dumps({'id':1,'method':'Runtime.enable'}))
        await asyncio.wait_for(ws.recv(), timeout=2)
        
        await ws.send(json.dumps({'id':2,'method':'Runtime.evaluate','params':{
            'expression':'console.log("CDP_HELLO", document.title, document.body.innerHTML.length)',
            'returnByValue':True
        }}))
        await asyncio.wait_for(ws.recv(), timeout=3)
        
        # Collect console messages
        msgs = []
        while True:
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
                method = msg.get('method','')
                if method in ('Console.messageAdded','Runtime.consoleAPICalled'):
                    msgs.append(msg)
            except asyncio.TimeoutError:
                break
        
        print(f'\nCaptured {len(msgs)} console messages:')
        for m in msgs:
            method = m.get('method','')
            if method == 'Console.messageAdded':
                txt = m.get('params',{}).get('message',{}).get('text','')
                print(f'  Console: {txt[:300]}')
            elif method == 'Runtime.consoleAPICalled':
                typ = m.get('params',{}).get('type','?')
                args = m.get('params',{}).get('args',[])
                vals = [str(a.get('value','') or a.get('description',''))[:150] for a in args]
                print(f'  Runtime [{typ}]: {" | ".join(vals)[:400]}')

asyncio.run(capture())
