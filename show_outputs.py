import json

with open('detection_output.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for i, cell in enumerate(nb['cells']):
    outputs = cell.get('outputs', [])
    if outputs:
        print(f'=== Cell {i} ===')
        for out in outputs:
            otype = out.get('output_type', '')
            if otype == 'stream':
                txt = out.get('text', '')
                if isinstance(txt, list):
                    txt = ''.join(txt)
                print(txt)
            elif otype in ('execute_result', 'display_data'):
                txt = out.get('data', {}).get('text/plain', '')
                if isinstance(txt, list):
                    txt = ''.join(txt)
                if txt.strip():
                    print(txt)
