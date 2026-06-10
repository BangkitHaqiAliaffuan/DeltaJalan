import subprocess, sys, os, re, argparse

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PACKAGE = "com.jalankita.app"
DIST = "dist/client"
HTML = f"{DIST}/index.html"

SPLASH_CSS = """
body::before {
  content: '';
  position: fixed; inset: 0; z-index: 9999;
  background: linear-gradient(135deg, #F1F5F9 0%, #EFF6FF 100%);
  pointer-events: none;
  transition: opacity 0.5s ease-out;
}
body::after {
  content: '';
  position: fixed; inset: 0; z-index: 10000;
  background: url(/logo.png) center 38% no-repeat;
  background-size: 88px;
  pointer-events: none;
  transition: opacity 0.5s ease-out;
}
html.app-ready body::before,
html.app-ready body::after {
  opacity: 0;
}
#root body::before,
#root body::after {
  display: none !important;
}
"""

ERROR_SCRIPT = """
<script>
console.log('[DeltaJalan] html loaded',new Date().toISOString());
window.__jkError=function(m){var e=document.getElementById('__jkError');if(!e){e=document.createElement('div');e.id='__jkError';e.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:14px 20px;background:#DC2626;color:#fff;font:600 14px/1.4 system-ui,sans-serif;text-align:center';document.body.appendChild(e)}e.textContent=m;e.style.display='block'};
window.addEventListener('error',function(e){console.error('[DeltaJalan] GLOBAL ERROR:',e.message);__jkError(e.message||'Unknown error')});
window.addEventListener('unhandledrejection',function(e){console.error('[DeltaJalan] UNHANDLED REJECTION:',e.reason);__jkError(String(e.reason)||'Promise rejected')});
</script>
"""

def build():
    print("=== Build SPA ===")
    r = subprocess.run(["npx", "vite", "build", "--config", "vite.config.capacitor.ts"], shell=True)
    if r.returncode != 0:
        print(f"[FAIL] Build -- exit {r.returncode}"); sys.exit(1)

    shell = f"{DIST}/_shell.html"
    if not os.path.exists(shell):
        print("[FAIL] _shell.html not found"); sys.exit(1)

    os.rename(shell, HTML)
    print("_shell.html -> index.html")

    with open(HTML, "r", encoding="utf-8") as f:
        content = f.read()

    # Strip TSR stream markers from <body>, keep only:
    #   - <div id="root">        (React mounts here via createRoot)
    #   - $tsr-stream-barrier    (router state for hydrateStart)
    #   - module import script   (client entry point)
    # This eliminates the #418 hydration error caused by TSR SPA shell
    # prerender producing <!--$--> stream markers instead of route content.
    tsr_script = re.search(
        r'<script\s+class="\$tsr"[^>]*>.*?</script>', content, re.DOTALL
    )
    module_script = re.search(
        r'<script\s+type="module"[^>]*>.*?</script>', content, re.DOTALL
    )
    parts = ['<div id="root"></div>']
    if tsr_script:
        parts.append(tsr_script.group(0))
    if module_script:
        parts.append(module_script.group(0))
    new_body_inner = '\n'.join(parts) + '\n'

    def replace_body(m):
        return m.group(1) + new_body_inner + m.group(2)

    content = re.sub(
        r'(<body[^>]*>).*?(</body>)',
        replace_body,
        content,
        flags=re.DOTALL,
    )

    # Inject splash CSS + error handlers before </head>
    content = content.replace("</head>", f"<style>{SPLASH_CSS}\n</style>\n{ERROR_SCRIPT}\n</head>")

    # Patch: strip document.currentScript.remove() from TanStack inline scripts.
    # These self-removals delete script nodes from DOM *before* React hydration starts,
    # causing React Error #418 (hydration mismatch: expected SCRIPT node, found COMMENT).
    # By keeping the script nodes in DOM, React finds the expected structure and hydrates cleanly.
    content = re.sub(r';?\s*document\.currentScript\.remove\(\)', '', content)
    print("Patched: stripped document.currentScript.remove() from TanStack inline scripts")

    with open(HTML, "w", encoding="utf-8") as f:
        f.write(content)

    print("Pseudo-element splash + error handlers injected into index.html")

def device_available():
    r = subprocess.run(["adb", "devices"], capture_output=True, text=True)
    for line in r.stdout.strip().split("\n")[1:]:
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == "device":
            return parts[0]
    return None

def deploy():
    dev = device_available()
    if not dev:
        print("[WARN] No device/emulator. Run: start emulator, then:")
        print("       npx cap copy && npx cap run android")
        return False
    print(f"=== Deploy to {dev} ===")
    return subprocess.run(["npx", "cap", "run", "android", "--target", dev], shell=True).returncode == 0

def find_apk():
    candidates = [
        "android/app/build/outputs/apk/debug/app-debug.apk",
        "android/app/build/outputs/apk/release/app-release.apk",
    ]
    for path in candidates:
        full = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)
        if os.path.exists(full):
            return full

def is_installed(device):
    r = subprocess.run(
        ["adb", "-s", device, "shell", "pm", "list", "packages", PACKAGE],
        capture_output=True, text=True
    )
    return PACKAGE in r.stdout

def build_apk():
    print("=== Build APK Android ===")
    r = subprocess.run(["npx", "cap", "copy"], shell=True)
    if r.returncode != 0:
        print("[FAIL] cap copy gagal"); return False

    gradlew = os.path.join(os.path.dirname(os.path.abspath(__file__)), "android", "gradlew.bat")
    if not os.path.exists(gradlew):
        gradlew = os.path.join(os.path.dirname(os.path.abspath(__file__)), "android", "gradlew")
    r = subprocess.run([gradlew, "assembleDebug"], cwd=os.path.dirname(gradlew))
    return r.returncode == 0

def install_to_device(device):
    apk = find_apk()
    if not apk:
        print("[FAIL] APK tidak ditemukan setelah build.")
        return False

    print(f"=== Install ke {device} ===")
    installed = is_installed(device)
    if installed:
        print(f"   {PACKAGE} sudah terinstall — update (adb install -r)...")
        r = subprocess.run(["adb", "-s", device, "install", "-r", apk])
    else:
        print(f"   {PACKAGE} belum terinstall — install baru...")
        r = subprocess.run(["adb", "-s", device, "install", apk])

    if r.returncode == 0:
        print(f"   [OK] Sukses")
        return True
    else:
        print(f"   [FAIL] Gagal (exit {r.returncode})")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delta Jalan Build & Install")
    parser.add_argument("--install", "--install-samsung", action="store_true",
                        help="Build + install APK ke HP via ADB")
    parser.add_argument("--build-only", action="store_true",
                        help="Build SPA + patch only, skip deploy")
    args = parser.parse_args()

    build()

    if args.install:
        dev = device_available()
        if not dev:
            print("[FAIL] Tidak ada device terdeteksi via ADB.")
            print("       Pastikan USB debugging aktif dan HP terhubung.")
            sys.exit(1)
        print(f"\n[DEVICE] Target device: {dev}")
        if not build_apk():
            print("[FAIL] Build APK gagal")
            sys.exit(1)
        install_to_device(dev)
    elif args.build_only:
        print("[SKIP] Deploy dilewati (--build-only). Jalankan: npx cap copy && npx cap run android")
    else:
        deploy()

    print("\n=== DONE ===")
