"""Validate recorded browser evidence for the named UI corrections.

This consumes observations; it does not launch or automate a browser.
Run: python scripts/check-ui-regressions.py /path/to/browser-evidence
Refresh browser observations and correction-evidence.json after a public-source
change. Never refresh only the source stamp to make stale observations pass.
"""
from pathlib import Path
import hashlib,json,sys

def main(root,evidence):
    def load(name):return json.loads((evidence/name).read_text(encoding='utf-8'))
    def require(ok,message):
        if not ok:raise ValueError(message)
    source=hashlib.sha256((root/'web-manifest.json').read_bytes()).hexdigest()
    receipt=load('correction-evidence.json')
    require(receipt['source_manifest_sha256']==source,'Stale evidence: recollect the affected browser cases for the current public source.')
    results=[]
    def check(key,work):
        try:work();results.append({'id':key,'status':'pass'})
        except (ValueError,KeyError,TypeError) as ex:results.append({'id':key,'status':'fail','finding':str(ex)})
    def edges(r):return [r['x'],r['y'],r['x']+r['width'],r['y']+r['height']]
    def stable(rects):return all(max(v)-min(v)<=1 for v in zip(*(edges(r) for r in rects)))
    def modal():
        data=load('final-modal-cases.json');require(len(data)==4,'Expected four modal viewport cases.')
        for m in data:
            states=[m[k] for k in ['empty','few','none','populated','scrolled']]
            require(stable([s.get('close',s.get('rect')) for s in states]),'Close moved across result states.')
            require(stable([s['query'] for s in states]),'Query moved across result states.')
            require(abs(m['empty']['scrollY']-m['scrolled']['scrollY'])<=1,'Background page scrolled behind search.')
            require(m['scrolled']['enabled'] and m['scrolled']['hit_target_or_descendant'],'Close is not reachable.')
            require(m['reset']==0,'New query retained the old result scroll.')
        d=next(x for x in load('runtime-observations.json') if x['case']=='diagram-stable-controls-final')
        require(stable([d['before']['close'],d['after']['close']]),'Diagram Close moved with canvas scroll.')
        require(d['after']['canvasScroll']>0 and abs(d['after']['scrollY']-d['before']['scrollY'])<=1,'Diagram scroll ownership failed.')
    check('modal-controls-and-background-scroll',modal)
    current=load('final-supported-acceptance.json')
    def navigation():
        d=current['reducedMotionResult']
        require(not d['open'] and d['focus']=='os-processes--process-control-block-data-structure','Same-page search did not close and focus the intended heading.')
        require(d['hash']=='#'+d['focus'] and d['targetTop']>=d['controlsBottom']+8,'Destination is incorrect or obscured by sticky controls.')
    check('same-page-search-destination',navigation)
    def focus():
        require('none' in current['pointerFocus']['outline'],'Pointer-only focus has an authored ring.')
        require('solid' in current['mixedFocus']['outline'] and not current['mixedFocus']['pointer'],'Keyboard focus feedback was not restored.')
        d=current['escapeReturn'];require(not d['open'] and d['focusClass']=='search-open' and 'solid' in d['outline'],'Escape did not restore visible search-button focus.')
        require(current['forcedColors']['active'] and 'solid' in current['forcedColors']['outline'],'Forced-color focus was not visible.')
        require('solid' in current['renderedRoles']['programmaticFocus']['outline'],'Destination focus was not visible.')
    check('pointer-keyboard-restored-focus',focus)
    def vectors():
        for state in current['vectorMarks']:
            visible=[m for m in state['marks'] if not m['hiddenByAncestor']]
            require(len(visible)>=2,'Expected navigation marks are absent.')
            require(all(m['width']>=12 and m['height']>=12 and m['path'] and m['stroke']!='none' for m in visible),'A visible vector mark did not render.')
    check('local-vector-navigation-marks',vectors)
    def alignment():
        rows=load('reader-alignment-current.json')['controls'];require(len(rows)==3,'Expected three reader controls.')
        require(max(r['height'] for r in rows)-min(r['height'] for r in rows)<=1,'Reader control heights differ.')
        require(max(r['y'] for r in rows)-min(r['y'] for r in rows)<=1,'Reader controls are misaligned.')
        require(all(r['height']>=44 for r in rows),'Reader control target is too small.')
    check('narrow-reader-control-alignment',alignment)
    def spacing():
        report=load('responsive-copy-clearance-report.json')
        require(report['source_manifest_sha256']==source,'Responsive evidence belongs to an older source.')
        require(report['state_count']==80 and report['failure_count']==0,'A responsive relationship failed.')
        require(all(report['calibration'].values()),'Bad-state/nearby-valid calibration failed.')
        rows=load('responsive-sweep-copy-clearance.json')
        require(len(rows)==80 and all(m.get('heroTextBlocks') for m in rows if m['art']),'Hero text relationships were omitted.')
        def overlap(a,b):return min(a['right'],b['right'])-max(a['x'],b['x'])>.5 and min(a['bottom'],b['bottom'])-max(a['y'],b['y'])>.5
        for m in rows:
            where=m['path']+' at '+str(m['viewport']['width'])
            require(not m['overflow'],'Document overflow: '+where)
            for a,b in [('brand','nav'),('nav','search'),('brand','search')]:
                require(not overlap(m[a],m[b]),'Header overlap: '+where)
            n,s=m['nav'],m['search']
            if s['y']>=n['bottom']-.5:
                require(abs(s['y']-n['bottom']-12)<=1,'Wrapped header row lost its gap: '+where)
                require(abs(s['x']-n['x'])<=1 and abs(s['right']-(m['header']['right']-n['x']))<=1,'Isolated search row is inconsistently sized: '+where)
            require(all(l['height']<=float(l['lineHeight'].removesuffix('px'))+1 for l in m['navLinks']),'Subject label wrapped: '+where)
            if m['art']:
                a=m['art'];require(not overlap(a,m['cta']),'Art overlaps Resume: '+where)
                require(m['doors']['y']-a['bottom']>=8,'Art crowds the subject divider: '+where)
                if m['stackedHero']:require(a['y']-m['cta']['bottom']>=8,'Stacked art crowds Resume: '+where)
                for b in m['heroTextBlocks']:
                    for text in [b['rect']]+b['fragments']:
                        if min(text['bottom'],a['bottom'])-max(text['y'],a['y'])>.5:
                            require(a['x']-text['right']>=23,'Text/art clearance failed for '+b['selector']+': '+where)
    check('header-and-hero-text-action-art-divider-spacing',spacing)
    def preservation():
        data=load('source-checks.json');require(all(c['exit_code']==0 for c in data),'A source/build/link/privacy/preservation check failed.')
        p=next(json.loads(c['stdout']) for c in data if 'byte_identical_chapter_articles' in c['stdout'])
        require(p['source_manifest_sha256']==source,'Source checks are stale.')
        require(p['byte_identical_chapter_articles']==55 and p['exact_ui_guidance_paragraph_corrections']==1 and p['sql_code_tables_figures_unchanged'],'Unexpected authored-content changes.')
    check('static-practice-guidance-and-content-preservation',preservation)
    print(json.dumps({'source_manifest_sha256':source,'scope':'Scripted assertions over recorded browser evidence; not an automated browser run or whole-product certification.','results':results,'unverified':['native 200% zoom','trusted wheel/touch takeover','physical phone','screen-reader session','changed cloud render'],'evidence_reuse':receipt['evidence_reuse']},indent=2))
    return int(any(r['status']=='fail' for r in results))

if __name__=='__main__':
    try:
        require_args=len(sys.argv)==2
        if not require_args:raise ValueError('Usage: python scripts/check-ui-regressions.py EVIDENCE_DIRECTORY')
        sys.exit(main(Path(__file__).resolve().parents[1],Path(sys.argv[1]).resolve()))
    except (ValueError,OSError,KeyError) as ex:
        print(json.dumps({'status':'incomplete','finding':str(ex)}));sys.exit(2)
