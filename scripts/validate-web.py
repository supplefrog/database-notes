from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,re

root=Path(__file__).resolve().parents[1]
web=root/'web'
manifest=json.loads((root/'web-manifest.json').read_text('utf-8'))
files={f.relative_to(web).as_posix():f for f in web.rglob('*') if f.is_file()}
assert set(files)==set(manifest),'Missing or extra publication files'
for name,f in files.items():assert hashlib.sha256(f.read_bytes()).hexdigest()==manifest[name],name

class Page(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.ids=[];self.refs=[];self.resources=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if 'id' in attrs:self.ids.append(attrs['id'])
  for key in ['href','src','poster']:
   if attrs.get(key):self.refs.append(attrs[key])
  if tag in ['script','img','iframe','link']:
   value=attrs.get('src') if tag!='link' else attrs.get('href')
   if value:self.resources.append(value)

pages={}
for name,f in files.items():
 if f.suffix=='.html':
  page=Page();page.feed(f.read_text('utf-8'));assert len(page.ids)==len(set(page.ids)),f'Duplicate IDs: {name}';pages[name]=page

checked=0
def check_ref(source,ref):
 global checked
 url=urlsplit(ref)
 if url.scheme or url.netloc:return
 assert not ref.startswith('//'),ref
 target=(web/unquote(url.path.lstrip('/'))) if url.path.startswith('/') else (web/source).parent/unquote(url.path)
 if not url.path:target=web/source
 target=target.resolve();assert target.is_relative_to(web.resolve()),f'Escaping path: {source}: {ref}'
 if target.is_dir():target=target/'index.html'
 assert target.is_file(),f'Missing destination: {source}: {ref}'
 if url.fragment:
  dest=target.relative_to(web).as_posix()
  if dest in pages:assert unquote(url.fragment) in pages[dest].ids,f'Missing fragment: {source}: {ref}'
 checked+=1

for name,page in pages.items():
 for ref in page.refs:check_ref(name,ref)
 for ref in page.resources:
  assert not urlsplit(ref).scheme or ref.startswith('data:'),f'Remote runtime resource: {name}: {ref}'
for name,f in files.items():
 if f.suffix=='.css':
  for ref in re.findall(r'url\([\'"]?([^\)\'\"]+)',f.read_text('utf-8')):check_ref(name,ref)
 if f.suffix in ['.html','.css','.js','.json']:
  s=f.read_text('utf-8')
  for pat in [r'(?:AKIA|ASIA)[A-Z0-9]{16}',r'gh[pousr]_[A-Za-z0-9]{25,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY',r'\bsk-[A-Za-z0-9_-]{25,}',r'C:[\\/]+Users[\\/]']:
   assert not re.search(pat,s),f'Potential private data: {name}: {pat}'
base='design/handbook-lab/'
search=json.loads((web/base/'search-index.json').read_text('utf-8'))
print('Search structure:', type(search).__name__)
for entry in search:
 assert entry.get('url'), 'Search entry has no destination'
 check_ref(base+'index.html',entry['url'])
registry=json.loads((web/base/'registry.json').read_text('utf-8'))
assert len(registry)==56
for chapter,anchors in registry.items():
 for anchor in anchors:check_ref(base+'index.html',f'chapters/{chapter}.html#{anchor}')
assert len(list((web/base/'chapters').glob('*.html')))==56
assert len(list((web/base/'tasks').glob('*.html')))==8
print(json.dumps({'files':len(files),'html_pages':len(pages),'local_links_and_assets':checked,'search_entries':len(search),'hashes':'pass','private_data_scan':'pass'}))
