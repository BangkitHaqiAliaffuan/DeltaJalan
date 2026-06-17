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
"""

ERROR_SCRIPT = """
<script>
console.log('[DeltaJalan] html loaded',new Date().toISOString());
window.__jkError=function(m){var e=document.getElementById('__jkError');if(!e){e=document.createElement('div');e.id='__jkError';e.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:14px 20px;background:#DC2626;color:#fff;font:600 14px/1.4 system-ui,sans-serif;text-align:center';document.body.appendChild(e)}e.textContent=m;e.style.display='block'};
window.addEventListener('error',function(e){console.error('[DeltaJalan] GLOBAL ERROR:',e.message);__jkError(e.message||'Unknown error')});
window.addEventListener('unhandledrejection',function(e){console.error('[DeltaJalan] UNHANDLED REJECTION:',e.reason);__jkError(String(e.reason)||'Promise rejected')});
</script>
"""

def inject_into_html(content):
    """Inject splash CSS + error script into HTML content right before </head>."""
    splash_tag = f"<style>{SPLASH_CSS}</style>"
    error_tag = ERROR_SCRIPT
    if splash_tag not in content:
        content = content.replace("</head>", f"{splash_tag}\n{error_tag}\n</head>")
    return content


def build():
    print("=== Build SPA ===")
    r = subprocess.run(["npx", "vite", "build", "--config", "vite.config.capacitor.ts"], shell=True)
    if r.returncode != 0:
        print(f"[FAIL] Build -- exit {r.returncode}"); sys.exit(1)

    shell = f"{DIST}/_shell.html"
    existing_index = HTML

    if os.path.exists(shell):
        # TanStack Start SPA mode: patch _shell.html into clean index.html
        with open(shell, "r", encoding="utf-8") as f:
            content = f.read()

        head_tags = re.findall(
            r'<(?:meta|link)[^>]*/?>|'
            r'<title>.*?</title>|'
            r'<style>.*?</style>',
            content, re.DOTALL
        )

        module_match = re.search(
            r'<script\s+type="module"[^>]*>.*?</script>',
            content, re.DOTALL
        )
        module_script = module_match.group(0) if module_match else ''

        head_inner = '\n'.join(head_tags)

        html = f'''<!DOCTYPE html>
<html lang="id">
<head>
{head_inner}
<style>{SPLASH_CSS}</style>
{ERROR_SCRIPT}
</head>
<body>
  <div id="root"></div>
  {module_script}
</body>
</html>'''

        with open(HTML, "w", encoding="utf-8") as f:
            f.write(html)

        print("Generated clean index.html from _shell.html head + custom body")

    elif os.path.exists(existing_index):
        # index.html already exists (e.g. from npm run build:mobile or earlier run)
        # Just inject splash CSS + error script
        print("Found existing index.html — injecting splash CSS + error script")
        with open(existing_index, "r", encoding="utf-8") as f:
            content = f.read()

        content = inject_into_html(content)

        with open(existing_index, "w", encoding="utf-8") as f:
            f.write(content)

        print("Patched index.html with splash CSS + error script")

    else:
        print("[FAIL] Build selesai tapi _shell.html DAN index.html tidak ditemukan di dist/client/.")
        print("       Kemungkinan: npm run build (SSR) pernah dijalankan dan menimpa output SPA.")
        print("       Fix: jalankan 'python build.py --build-only' untuk rebuild SPA.")
        sys.exit(1)

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
