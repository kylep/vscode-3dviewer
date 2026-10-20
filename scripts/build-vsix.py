from pathlib import Path
import hashlib, json, subprocess, zipfile
from xml.sax.saxutils import escape
root = Path(__file__).resolve().parents[1]
output = root / 'artifacts'
output.mkdir(exist_ok=True)
manifest = json.loads((root/'package.json').read_text())
files = ['package.json','README.md','LICENSE.md','icon.png','THIRD-PARTY-NOTICES.txt',
         'out/extension.js','out/MeshViewerProvider.js','out/model.js',
         'media/reviewed/viewer.js','media/reviewed/viewer.css']
identity = f"{manifest['publisher']}.{manifest['name']}"
xml = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
<Metadata><Identity Language="en-US" Id="{manifest['name']}" Version="{manifest['version']}" Publisher="{manifest['publisher']}"/>
<DisplayName>{escape(manifest['displayName'])}</DisplayName><Description xml:space="preserve">{escape(manifest['description'])}</Description>
<Tags>3d,mesh,stl,local,reviewed</Tags><Categories>Other</Categories><GalleryFlags>Public</GalleryFlags>
<Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.100.0"/>
<Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
<Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
<Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/></Properties>
<License>extension/LICENSE.md</License><Icon>extension/icon.png</Icon></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
<Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.md" Addressable="true"/>
<Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true"/></Assets>
</PackageManifest>'''
ct = '''<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="vsixmanifest" ContentType="text/xml"/><Default Extension="json" ContentType="application/json"/>
<Default Extension="js" ContentType="application/javascript"/><Default Extension="css" ContentType="text/css"/>
<Default Extension="md" ContentType="text/markdown"/><Default Extension="txt" ContentType="text/plain"/>
<Default Extension="png" ContentType="image/png"/></Types>'''
entries={'extension.vsixmanifest':xml.encode(),'[Content_Types].xml':ct.encode()}
entries.update({'extension/'+name:(root/name).read_bytes() for name in files})
vsix = output / f"3d-viewer-reviewed-{manifest['version']}.vsix"
with zipfile.ZipFile(vsix,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name, data in sorted(entries.items()):
        info=zipfile.ZipInfo(name,(2026,10,19,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o100644 << 16;z.writestr(info,data)
with zipfile.ZipFile(vsix) as z:
    assert set(z.namelist()) == set(entries)
    assert z.testzip() is None
    for name,data in entries.items(): assert z.read(name)==data
record={'extension':identity,'version':manifest['version'],
        'upstream_commit':'95408588d4f2987f0ae579b83e543f3f364bc467',
        'local_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
        'vsix_sha256':hashlib.sha256(vsix.read_bytes()).hexdigest(),
        'files':{name:hashlib.sha256(data).hexdigest() for name,data in sorted(entries.items())}}
(output/'reviewed-vsix-manifest.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'path':str(vsix),'files':len(entries),'sha256':record['vsix_sha256']}))
