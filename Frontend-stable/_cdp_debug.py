import json, urllib.request, asyncio, websockets

async def intercept():
    pages = json.loads(urllib.request.urlopen('http://localhost:9222/json', timeout=5).read())
    ws_url = pages[0]['webSocketDebuggerUrl']
    print('Connecting to CDP...')
    async with websockets.connect(ws_url, max_size=2**20, open_timeout=8) as ws:
        await ws.send(json.dumps({'id':1,'method':'Page.enable'}))
        await asyncio.wait_for(ws.recv(), timeout=2)
        await ws.send(json.dumps({'id':2,'method':'Runtime.enable'}))
        await asyncio.wait_for(ws.recv(), timeout=2)
        await ws.send(json.dumps({'id':3,'method':'Console.enable'}))
        await asyncio.wait_for(ws.recv(), timeout=2)
        
        # Inject BEFORE reload - runs on every new document
        interceptor = """
        // Intercept before any page script
        (function() {
            var origError = Error;
            window.__APP_ERRORS__ = [];
            window.__APP_LOG__ = [];
            
            // Monkey-patch Error constructor to capture stack traces globally
            var origOnError = window.onerror;
            window.onerror = function(msg, url, line, col, err) {
                window.__APP_ERRORS__.push({msg: String(msg), err: err});
                console.log('[INTERCEPT] onerror:', msg);
                return false;
            };
            
            var origOnRejection = window.onunhandledrejection;
            window.onunhandledrejection = function(e) {
                window.__APP_ERRORS__.push({msg: String(e.reason), err: e.reason});
                console.log('[INTERCEPT] rejection:', String(e.reason));
            };
            
            // Monkey-patch setTimeout to wrap all timer callbacks
            var origSetTimeout = window.setTimeout;
            window.setTimeout = function(fn, ms) {
                return origSetTimeout.call(window, function() {
                    try {
                        if (typeof fn === 'function') fn();
                        else if (typeof fn === 'string') eval(fn);
                    } catch(e) {
                        window.__APP_ERRORS__.push({msg: 'setTimeout: ' + (e.message || e), err: e});
                        console.log('[INTERCEPT] setTimeout error:', e.message);
                    }
                }, ms);
            };
        })();
        """
        await ws.send(json.dumps({'id':4,'method':'Page.addScriptToEvaluateOnNewDocument','params':{
            'source': interceptor
        }}))
        r = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        print('Interceptor registered:', r.get('result', {}).get('identifier', '?'))

        # Reload
        await ws.send(json.dumps({'id':5,'method':'Page.reload'}))
        
        # Collect for 8 seconds
        msgs = []
        while True:
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
                method = msg.get('method', '')
                if method in ('Console.messageAdded','Runtime.consoleAPICalled','Runtime.exceptionThrown'):
                    msgs.append(msg)
                if method == 'Page.frameStoppedLoading':
                    print('Frame loaded!')
            except asyncio.TimeoutError:
                break
        
        print(f'\n=== {len(msgs)} console messages ===')
        for m in msgs:
            method = m.get('method','')
            if method == 'Runtime.consoleAPICalled':
                typ = m.get('params',{}).get('type','?')
                args = m.get('params',{}).get('args',[])
                vals = []
                for a in args:
                    v = a.get('value','') or a.get('description','') or str(a.get('type',''))
                    vals.append(str(v)[:300])
                print(f'  [{typ}] {" | ".join(vals)[:500]}')
            elif method == 'Runtime.exceptionThrown':
                desc = m.get('params',{}).get('exceptionDetails',{}).get('text','')
                print(f'  [EXCEPTION] {desc[:500]}')
            elif method == 'Console.messageAdded':
                lvl = m.get('params',{}).get('message',{}).get('level','?')
                txt = m.get('params',{}).get('message',{}).get('text','')
                print(f'  CONSOLE [{lvl}] {txt[:500]}')
        
        # Now check our error array
        print('\n=== Checking error array ===')
        await ws.send(json.dumps({'id':6,'method':'Runtime.evaluate','params':{
            'expression': 'JSON.stringify(window.__APP_ERRORS__)',
            'returnByValue': True,
            'timeout': 3000
        }}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        result = resp.get('result',{}).get('result',{})
        print('Errors captured:', result.get('value', 'none')[:500])
        
        # Also check log
        await ws.send(json.dumps({'id':7,'method':'Runtime.evaluate','params':{
            'expression': 'JSON.stringify(window.__APP_LOG__)',
            'returnByValue': True,
            'timeout': 3000
        }}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        result = resp.get('result',{}).get('result',{})
        print('Logs captured:', result.get('value', 'none')[:500])
        
        # Also check if document.body has any children
        await ws.send(json.dumps({'id':8,'method':'Runtime.evaluate','params':{
            'expression': 'document.body.innerHTML.length',
            'returnByValue': True
        }}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        result = resp.get('result',{}).get('result',{})
        print('Body length:', result.get('value', '?'))
        
        # Check document.title
        await ws.send(json.dumps({'id':9,'method':'Runtime.evaluate','params':{
            'expression': 'document.title',
            'returnByValue': True
        }}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        result = resp.get('result',{}).get('result',{})
        print('Title:', result.get('value', '?'))

asyncio.run(intercept())
