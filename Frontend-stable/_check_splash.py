f=open('D:/DeltaJalan/Frontend-stable/dist/client/index.html','r',encoding='utf-8')
c=f.read()
# Find all script tags
import re
scripts = re.findall(r'<script[^>]*>.*?</script>', c, re.DOTALL)
print(f'Total scripts: {len(scripts)}')
for i, s in enumerate(scripts):
    preview = s[:120].replace('\n',' ').replace('\r','')
    print(f'  [{i}] {preview}...')
