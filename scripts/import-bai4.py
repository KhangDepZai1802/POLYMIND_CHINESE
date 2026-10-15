"""Import supplied audio and reconstruct the DOCX's fixed-page text overlays for rendering."""
import base64, html, io, json, pathlib, re, sys, zipfile, xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parent.parent
SCRATCH=ROOT/'.tmp-bai4-import'
SCRATCH.mkdir(exist_ok=True)
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','v':'urn:schemas-microsoft-com:vml','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
def attr(node,name,default=''):
    return node.get('{'+NS['w']+'}'+name,default) if node is not None else default
def pt(value):
    return float(re.sub('[^0-9.-]','',value) or 0)
if len(sys.argv)!=2:
    raise SystemExit('Usage: python scripts/import-bai4.py <lesson-4.zip>')
with zipfile.ZipFile(sys.argv[1]) as supplied:
    audio=sorted((int(re.search(r'Trang (\d+)\.m4a$',n).group(1)),n) for n in supplied.namelist() if n.endswith('.m4a'))
    target=ROOT/'public/audio/bai-4'
    target.mkdir(parents=True,exist_ok=True)
    for page,name in audio:
        (target/f'trang-{page:02}.m4a').write_bytes(supplied.read(name))
    source=next(n for n in supplied.namelist() if n.endswith('.docx'))
    with zipfile.ZipFile(io.BytesIO(supplied.read(source))) as doc:
        relationships={x.get('Id'):x.get('Target') for x in ET.fromstring(doc.read('word/_rels/document.xml.rels'))}
        root=ET.fromstring(doc.read('word/document.xml'))
        pages=root.findall('w:body/w:p',NS)
        assert len(pages)==42
        for number,_ in audio:
            p=pages[number-1]
            blip=p.find('.//a:blip',NS)
            data=doc.read('word/'+relationships[blip.get('{'+NS['r']+'}embed')])
            extent=p.find('.//wp:extent',NS)
            width=int(extent.get('cx'))/12700
            height=int(extent.get('cy'))/12700
            parts=[f'<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;background:white}}.sheet{{width:{width}px;height:{height}px;position:relative;overflow:hidden}}.background{{position:absolute;inset:0;width:100%;height:100%}}.shape{{position:absolute;white-space:pre;overflow:visible}}p{{margin:0;padding:0}}</style><div class="sheet"><img class="background" src="data:image/png;base64,{base64.b64encode(data).decode()}">']
            texts=[]
            for shape in p.findall('.//v:shape',NS):
                textbox=shape.find('v:textbox/w:txbxContent',NS)
                if textbox is None:continue
                styles=dict(x.split(':',1) for x in shape.get('style','').split(';') if ':' in x)
                left=pt(styles.get('margin-left','0')); top=pt(styles.get('margin-top','0'))
                width_shape=pt(styles.get('width','0'));height_shape=pt(styles.get('height','0'))
                shape_text=''.join(n.text or '' for n in textbox.findall('.//w:t',NS))
                # The Word export splits the final title letters into an overlapping box.
                # Rejoin this heading without altering its wording or the lesson body.
                if number==29 and top<100 and (shape_text=='NG' or 'IV. CÁCH DIỄN TẢ' in shape_text):
                    if 'IV. CÁCH DIỄN TẢ' in shape_text:
                        parts.append(f'<div class="shape" style="left:{left}px;top:{top}px;font:700 14px Arial,sans-serif;color:#005c46">IV. CÁCH DIỄN TẢ THỨ TỰ HÀNH ĐỘNG</div>')
                    continue
                parts.append(f'<div class="shape" style="left:{left}px;top:{top}px;width:{width_shape}px;min-height:{height_shape}px">')
                for para in textbox.findall('w:p',NS):
                    line=para.find('w:pPr/w:spacing',NS)
                    leading=float(attr(line,'line','240'))/20
                    align=attr(para.find('w:pPr/w:jc',NS),'val','left')
                    parts.append(f'<p style="line-height:{leading}px;text-align:{align}">')
                    for run in para.findall('w:r',NS):
                        value=''.join(n.text or '' for n in run.findall('w:t',NS))
                        texts.append(value)
                        props=run.find('w:rPr',NS)
                        fonts=props.find('w:rFonts',NS) if props is not None else None
                        family=attr(fonts,'eastAsia') if re.search('[\u3400-\u9fff]',value) else attr(fonts,'ascii')
                        size=float(attr(props.find('w:sz',NS) if props is not None else None,'val','24'))/2
                        color=attr(props.find('w:color',NS) if props is not None else None,'val','000000')
                        if not re.fullmatch('[0-9A-Fa-f]{6}',color):color='000000'
                        bold=props is not None and props.find('w:b',NS) is not None
                        italic=props is not None and props.find('w:i',NS) is not None
                        font_family=html.escape(json.dumps(family or 'Times New Roman')+',"Microsoft YaHei","SimSun",serif',quote=True)
                        css=f'font-family:{font_family};font-size:{size}px;color:#{color};font-weight:{700 if bold else 400};font-style:{"italic" if italic else "normal"}'
                        parts.append(f'<span style="{css}">{html.escape(value)}</span>')
                    parts.append('</p>')
                parts.append('</div>')
            parts.append('</div>')
            (SCRATCH/f'trang-{number}.html').write_text(''.join(parts),encoding='utf-8')
            (SCRATCH/f'trang-{number}.txt').write_text('\n'.join(texts),encoding='utf-8')
        (SCRATCH/'pages.json').write_text(json.dumps([p for p,_ in audio]))
        print('Imported audio/pages:',[p for p,_ in audio])
