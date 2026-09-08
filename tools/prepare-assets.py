import json
from pathlib import Path
import shutil

root=Path(__file__).resolve().parents[1]
bundle=root/'source-archive/assets/71b7a956-b011-4510-8eb2-8e2c71c9ed23'
destination=root/'src/assets'
destination.mkdir(parents=True,exist_ok=True)
mapping={}
for asset in json.loads((bundle/'manifest.json').read_text(encoding='utf-8'))['assets']:
    source=bundle/Path(asset['path']).name
    if asset['kind']=='image' and source.exists() and 'picsum.photos' not in asset['url']:
        shutil.copy2(source,destination/source.name)
        mapping[asset['url']]='/assets/'+source.name
extra=root/'source-archive/extra-assets'
for url,filename in json.loads((extra/'manifest.json').read_text(encoding='utf-8')).items():
    shutil.copy2(extra/filename,destination/filename)
    mapping[url]='/assets/'+filename
(root/'src/content/image-map.json').write_text(json.dumps(mapping,indent=2),encoding='utf-8')
print('Prepared',len(mapping),'source image mappings')
