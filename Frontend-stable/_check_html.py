import re

with open("D:/DeltaJalan/Frontend-stable/dist/client/index.html", "r", encoding="utf-8") as f:
    content = f.read()

body = content.split("<body")[1].split("</body>")[0]

print("remove() occurrences in body:", body.count("remove()"))
print("currentScript.remove occurrences:", body.count("currentScript.remove"))

for m in re.finditer(r".{0,30}currentScript\.remove.{0,30}", body):
    print(f"  MATCH: ...{m.group()}...")
