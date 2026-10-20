#!/usr/bin/env python3
"""Build reference contact sheets from an actual PPTX rendering receipt.

This script verifies source and page hashes. It does not claim a visual review.
"""
from pathlib import Path
from hashlib import sha256
import argparse
import json
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--render-root', required=True, help='PPTX renderer output directory containing artifacts/')
parser.add_argument('--output', default=str(Path(__file__).resolve().parents[1] / 'skills/dsh-academic-ppt/references/templates'))
parser.add_argument('--font', help='Optional local font file for Chinese contact-sheet labels')
args = parser.parse_args()
out = Path(args.output).resolve()
render = Path(args.render_root).resolve()
artifacts = render if (render / 'render-receipt.json').is_file() else render / 'artifacts'
receipt = json.loads((artifacts / 'render-receipt.json').read_text())
manifest_path = out / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
digest = lambda data: sha256(data).hexdigest()
source_hash = digest((out / manifest['collection']['file']).read_bytes())
if source_hash != manifest['collection']['sha256'] or source_hash != receipt['source']['sha256']:
    raise SystemExit('The render receipt does not match the current reference PPTX.')
if receipt['slideCount'] != 48 or len(receipt['pngs']) != 48:
    raise SystemExit('The reference rendering must contain all 48 pages.')

pages = {}
for record in receipt['pngs']:
    path = (artifacts / record['file']).resolve()
    if not path.is_relative_to(artifacts.resolve()):
        raise SystemExit('The receipt contains a page outside its artifacts directory.')
    data = path.read_bytes()
    if digest(data) != record['sha256']:
        raise SystemExit(f"Rendered page {record['page']} changed after the receipt was written.")
    pages[record['page']] = path
if sorted(pages) != list(range(1, 49)):
    raise SystemExit('The render receipt has missing or duplicate page numbers.')

font = ImageFont.truetype(args.font, 18) if args.font else ImageFont.load_default(size=18)
thumb_font = ImageFont.truetype(args.font, 14) if args.font else ImageFont.load_default(size=14)
montages = out / 'montages'
montages.mkdir(parents=True, exist_ok=True)
records = []
for ci, category in enumerate(manifest['categories']):
    sheet = Image.new('RGB', (1464, 1330), '#E8EDF2')
    draw = ImageDraw.Draw(sheet)
    title = category['name'] if args.font else category['id']
    draw.text((12, 7), f"{title} / Actual PPTX rendering / Synthetic template content", font=font, fill='#173C70')
    category_pages = []
    for j in range(6):
        n = ci * 6 + j + 1
        im = Image.open(pages[n]).convert('RGB')
        im.thumbnail((714, 402), Image.Resampling.LANCZOS)
        x = 12 + (j % 2) * 728
        y = 40 + (j // 2) * 430
        sheet.paste(im, (x, y))
        template = manifest['templates'][n - 1]
        draw.text((x, y + 402), f"{n:02d}  {template['id']}", font=thumb_font, fill='#263648')
        category_pages.append(n)
    target = montages / (category['id'] + '.png')
    sheet.save(target, optimize=True)
    records.append({'category': category['id'], 'path': 'montages/' + target.name, 'pages': category_pages,
                    'sha256': digest(target.read_bytes()), 'byteLength': target.stat().st_size})

manifest['checks']['pptxVisual'] = {
    'status': 'rendered-needs-visual-review',
    'renderer': receipt['renderer'],
    'sourceSha256': source_hash,
    'slideCount': 48,
    'missingFonts': receipt['missingFonts'],
    'reviewedPages': [],
    'montages': records,
    'sourcePageHashes': [{'page': p['page'], 'sha256': p['sha256']} for p in receipt['pngs']]
}
manifest['previewNotice'] = 'previews/*.svg are scene previews; montages/*.png come from the actual exported PPTX.'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

gallery_path = out / 'gallery.html'
gallery = gallery_path.read_text()
marker = '<!-- ACTUAL-PPTX-PREVIEWS -->'
start, end = '<!-- ACTUAL-PPTX-PREVIEWS-START -->', '<!-- ACTUAL-PPTX-PREVIEWS-END -->'
links = ' · '.join(f'<a href="{r["path"]}">{c["name"]} 6 页拼图</a>' for c, r in zip(manifest['categories'], records))
section = f'{start}<p><strong>实际 PPTX 渲染：</strong>{links}</p><p>下方 48 张逐页图为 SVG 场景预览。分类拼图来自实际导出的 PPTX；源文件哈希与审查状态见 manifest.json。<a href="../../../../docs/USER_TEMPLATE_STUDY.md">两份用户模板的结构研究</a></p>{end}'
if start in gallery and end in gallery:
    a = gallery.index(start)
    b = gallery.index(end) + len(end)
    gallery = gallery[:a] + section + gallery[b:]
elif marker in gallery:
    gallery = gallery.replace(marker, section)
else:
    gallery = gallery.replace('<nav>', section + '<nav>', 1)
gallery_path.write_text(gallery)
print(json.dumps({'output': str(out), 'sourceSha256': source_hash, 'montages': len(records),
                  'status': 'rendered-needs-visual-review'}, ensure_ascii=False))
