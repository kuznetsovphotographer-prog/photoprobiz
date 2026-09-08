"""Build every audited gallery with local images; never fall back to Tilda URLs."""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TITLES = {
    'office1': 'Портрет на однотонном фоне',
    'office2': 'Интерьерный бизнес-портрет',
    'savina': 'Корпоративная фотосессия',
    'studio1': 'Студийный бизнес-портрет',
    'studio2': 'Интерьерная съёмка в студии',
    'outdoor': 'Деловая фотосессия на улице',
    'eduard': 'Деловой портрет',
    'eduard1': 'Студийная фотосессия',
    'eduard2': 'Фотосессия для личного бренда',
    'eduard3': 'Имиджевая фотосессия',
    'stanislav': 'Станислав Паулаускас',
    'person1': 'Портфолио — серия 1',
    'person2': 'Портфолио — серия 2',
    'person3': 'Портфолио — серия 3',
    'person4': 'Портфолио — серия 4',
    'person5': 'Портфолио — серия 5',
    'person6': 'Портфолио — серия 6',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, default=ROOT / 'src/data/assets.json')
    parser.add_argument('--source', type=Path, default=ROOT / 'audit/secondary-galleries.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/data/galleries.json')
    args = parser.parse_args()
    if not args.assets.is_file():
        raise SystemExit(f'Asset manifest is not ready: {args.assets}. Run this script after local image generation.')
    source = json.loads(args.source.read_text(encoding='utf-8-sig'))
    assets = json.loads(args.assets.read_text(encoding='utf-8-sig'))
    output = {}
    missing = []
    for hook, gallery in source.items():
        images = []
        for image in gallery['images']:
            asset = assets.get(image['url'])
            if not asset or not asset.get('src') or not asset.get('width') or not asset.get('height'):
                missing.append(image['url'])
                continue
            if asset['src'].startswith(('https:', 'http:', '//')):
                raise SystemExit(f'Expected a local image path: {asset["src"]}')
            result = {key: asset[key] for key in ('src', 'width', 'height')}
            result['src'] = result['src'].lstrip('/')
            if asset.get('srcSet'):
                result['srcSet'] = asset['srcSet']
            result['alt'] = image.get('alt', '')
            images.append(result)
        output[hook] = {'title': TITLES.get(hook.removeprefix('#popup:'), 'Фотографии серии'), 'images': images}
    if missing:
        raise SystemExit(f'{len(missing)} gallery images missing from local manifest; first: {missing[:5]}')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Built {len(output)} galleries / {sum(len(g["images"]) for g in output.values())} slides: {args.output}')


if __name__ == '__main__':
    main()
