"""Convert the original hover relationships to local CSS; no platform runtime."""
import ast
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path('audit/tooling').resolve()))
from bs4 import BeautifulSoup

source = BeautifulSoup(Path('audit/source/home.html').read_text('utf-8-sig'), 'html.parser')
nodes = json.loads(Path('audit/migrated-nodes.json').read_text('utf-8'))
mapped = {(n['sourceBlock'], n['key']): n for n in nodes}
css = ['''/* Original interaction states, with platform class names removed.
   Hover trigger relationships below are compiled from the audited source. */
.design-node.mobile-ico:hover svg path{fill:#a38773}
.design-node.gray{transition:all 700ms cubic-bezier(.4,0,.2,1)}
.design-node.gray:hover{filter:grayscale(0%)!important}
.design-node.filter-br{transition:all 300ms cubic-bezier(.4,0,.2,1)}
.design-node.card:hover .filter-br,.design-node.card:focus-visible .filter-br{filter:brightness(.8)}
.design-node.bg > .design-node:not(.reveal-layer){transition:color 150ms cubic-bezier(.4,0,.2,1),background-color 150ms cubic-bezier(.4,0,.2,1),border-color 150ms cubic-bezier(.4,0,.2,1),fill 150ms cubic-bezier(.4,0,.2,1),stroke 150ms cubic-bezier(.4,0,.2,1),text-decoration-color 150ms cubic-bezier(.4,0,.2,1)}
/* The original direct-child selector also excludes its inserted animation wrapper. */
.design-node.bg:hover > .design-node:not(.reveal-layer){background-image:linear-gradient(0turn,#fff 0%,#fff 100%)!important}
.design-node.str{cursor:pointer}
.design-node.str svg path{stroke:#000;fill:#000}
.design-node.str:hover svg path{stroke:#8b6f5c;fill:#8b6f5c}
.design-node.line{width:0%!important;transition:all 500ms cubic-bezier(.4,0,.2,1)}
.design-node.btn-text{transition:all 500ms cubic-bezier(.4,0,.2,1)}
.design-node.btn-anim:hover .line,.design-node.btn-anim:focus-visible .line{width:100%!important}
.design-node.btn-anim:hover .btn-text,.design-node.btn-anim:focus-visible .btn-text{opacity:.8}
''']
relationships = []

def responsive(node, name, width):
    for bp in [320, 480, 640, 960]:
        if width <= bp and node.has_attr(f'{name}-res-{bp}'):
            return node[f'{name}-res-{bp}']
    return node.get(name)

def transform(step):
    return (f"translate({float(step.get('mx', 0)):g}px,{float(step.get('my', 0)):g}px) "
            f"scale({float(step.get('sx', 1)):g},{float(step.get('sy', 1)):g}) "
            f"rotate({float(step.get('ro', 0)):g}deg)")

widths = [320, 480, 640, 960, 1200]
rules_by_width = {}
for width in widths:
    rules = []
    for element in source.select('[data-animate-sbs-event="hover"]'):
        record = element.find_parent(class_='r')['id']
        key = element.get('data-elem-id') or element.get('data-group-id')
        target = mapped.get((record, key))
        if not target:
            continue
        steps = ast.literal_eval(responsive(element, 'data-animate-sbs-opts', width))
        end = steps[-1]
        trigger_ids = responsive(element, 'data-animate-sbs-trgels', width)
        triggers = [mapped[(record, k)] for k in (trigger_ids or key).split(',') if (record, k) in mapped]
        if not triggers:
            continue
        duration = float(end.get('ti', 300))
        easing = end.get('ea', '0')
        if easing == '0':
            easing = 'linear'
        base = f".section-{target['section']} .{target['class']} > .reveal-layer"
        rules.append(f'{base}{{transition:transform {duration:g}ms {easing},opacity {duration:g}ms {easing}}}')
        selectors = ','.join(f".{t['class']}:hover,.{t['class']}:focus-visible" for t in triggers)
        active = f".section-{target['section']}:has(:is({selectors})) .{target['class']} > .reveal-layer"
        rule = f"{active}{{opacity:{float(end.get('op', 1)):g}!important;transform:{transform(end)}!important}}"
        rules.append(rule)
        if width == 1200:
            relationships.append({'section':target['section'],'target':target['class'],'triggers':[t['class'] for t in triggers],'opacity':float(end.get('op',1)),'transform':transform(end),'duration':duration})
    rules_by_width[width] = rules

# Share identical rules and bound responsive trigger relationships to their range.
rule_widths = {}
for width, rules in rules_by_width.items():
    for rule in rules:
        rule_widths.setdefault(rule, []).append(width)
for rule, active_widths in rule_widths.items():
    if active_widths == widths:
        css.append(rule)
        continue
    ranges = []
    for width in active_widths:
        index = widths.index(width)
        if ranges and index == ranges[-1][1] + 1:
            ranges[-1][1] = index
        else:
            ranges.append([index, index])
    queries = []
    for start, end in ranges:
        conditions = []
        if start:
            conditions.append(f'(min-width:{widths[start]}px)')
        if end < len(widths) - 1:
            conditions.append(f'(max-width:{widths[end + 1] - .02:g}px)')
        queries.append(' and '.join(conditions))
    css.append('@media ' + ','.join(queries) + '{' + rule + '}')

Path('src/styles/interaction-states.css').write_text('\n'.join(css), 'utf-8')
Path('audit/hover-relationships.json').write_text(json.dumps(relationships, ensure_ascii=False, indent=2), 'utf-8')
print(f'{len(relationships)} hover targets; CSS {Path("src/styles/interaction-states.css").stat().st_size} bytes')
