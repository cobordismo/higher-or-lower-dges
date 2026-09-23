# Extrai os cursos do PDF da DGES. Usa a ordem de desenho dos caracteres para separar
# o nome da instituição do nome do curso quando o primeiro transborda para a coluna seguinte.
import pdfplumber, json, re, collections

COL_CURSO = 350.2  # x onde começa a coluna "Nome do Curso"

def segmentos(chars):
    segs, cur = [], []
    for c in chars:
        if cur:
            p = cur[-1]
            if c['x0'] < p['x1'] - 1 or c['x0'] - p['x1'] > 6:
                segs.append(cur); cur = []
        cur.append(c)
    if cur: segs.append(cur)
    # se nenhum segmento começa na coluna do curso, a instituição e o curso vieram colados:
    # separar no primeiro caractere que já está na coluna do curso
    if not any(COL_CURSO - 4 < s[0]['x0'] < COL_CURSO + 7 for s in segs):
        novos = []
        for s in segs:
            k = next((j for j, c in enumerate(s) if j and c['x0'] >= COL_CURSO and s[j-1]['x0'] < COL_CURSO), None)
            if k and s[0]['x0'] < COL_CURSO: novos += [s[:k], s[k:]]
            else: novos.append(s)
        segs = novos
    return [(s[0]['x0'], ''.join(ch['text'] for ch in s).strip()) for s in segs]

linhas = []
with pdfplumber.open('medias.pdf') as pdf:
    for pg in pdf.pages:
        hdr = {w['text']: w['x0'] for w in pg.extract_words()}
        # agrupar caracteres por linha (top arredondado), mantendo a ordem do stream
        porlinha = collections.OrderedDict()
        for c in pg.chars:
            porlinha.setdefault(round(c['top']), []).append(c)
        # juntar linhas com top a ±1
        chaves = sorted(porlinha)
        grupos = []
        for k in chaves:
            if grupos and k - grupos[-1][0] <= 1: grupos[-1][1].extend(porlinha[k])
            else: grupos.append([k, list(porlinha[k])])
        for _, chars in grupos:
            segs = [s for s in segmentos(chars) if s[1]]
            if not segs or not re.fullmatch(r'\d{4}', segs[0][1][:4]): continue
            linhas.append(segs)

cursos, insts, fora, estranhas = [], [], collections.Counter(), []
for segs in linhas:
    # campos numéricos à direita: grau, vagas, colocados, desemp, semclass, vagaadic, nota, sobras
    esq = ' '.join(t for x, t in segs if x < 330)
    inst_seg = [re.sub(r'^\d{4} \w{4} ', '', esq)]  # tirar os códigos da instituição e do curso
    curso_seg = [t for x, t in segs if 330 < x < 555]
    cauda = [t for x, t in segs if x >= 555]
    m2 = re.search(r'(L1|MI|PM|PL)$', curso_seg[-1]) if curso_seg else None
    if m2 and not re.fullmatch(r'L1|MI|PM|PL', (cauda[0] if cauda else '')):
        curso_seg[-1] = curso_seg[-1][:m2.start()]; cauda.insert(0, m2.group(1))
    toks = ' '.join(cauda).split()
    estranhas.append((segs, toks)) if len(toks) not in (7, 8) else None
    if len(toks) not in (7, 8): continue
    grau = toks[0]
    if grau not in ('L1', 'MI'): fora['grau ' + grau] += 1; continue
    vag, col = int(toks[1]), int(toks[2])
    if len(toks) == 7: fora['sem nota'] += 1; continue
    nota = float(toks[6].replace(',', '.'))
    inst = ' '.join(inst_seg); curso = ' '.join(curso_seg)
    if inst not in insts: insts.append(inst)
    cursos.append([insts.index(inst), curso, grau, nota, vag, col])

print('linhas', len(linhas), 'cursos', len(cursos), dict(fora), 'estranhas', len(estranhas))
for e in estranhas[:8]: print(e)

json.dump({'i': insts, 'c': cursos}, open('dados.json', 'w'), ensure_ascii=False)
with open('data.js', 'w') as f:
    f.write('// Gerado a partir do PDF da DGES (CNA 2026, 1.ª fase, contingente geral).\n')
    f.write('// i = instituições; c = [índice da instituição, curso, grau, nota do último colocado, vagas iniciais, colocados]\n')
    f.write('const DADOS = ' + json.dumps({'i': insts, 'c': cursos}, ensure_ascii=False, separators=(',', ':')) + ';\n')
