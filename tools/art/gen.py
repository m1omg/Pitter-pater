#!/usr/bin/env python3
"""Generate art through the Codex CLI's built-in image_gen tool.

Usage:  python3 tools/art/gen.py [--phase N] [--only name1,name2] [--workers 3] [--dry]
Uses a cheap model (gpt-reserve, low reasoning) purely as a relay for image_gen.
Stops everything as soon as a usage-limit error is seen.
"""
import argparse, json, os, re, shutil, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
RAW = os.path.join(ROOT, 'art_raw')
LOGS = os.path.join(HERE, 'logs')
sys.path.insert(0, HERE)
from jobs import JOBS  # noqa: E402

ASPECT = {
    'landscape': 'Make the image landscape, 3:2 (1536x1024).',
    'square': 'Make the image square (1024x1024).',
    'portrait': 'Make the image portrait, 2:3 (1024x1536).',
}
stop = threading.Event()
lock = threading.Lock()


def log(msg):
    with lock:
        print(time.strftime('%H:%M:%S'), msg, flush=True)


def build_prompt(j, out_path):
    parts = [
        'You are only an image-generation relay. Call the built-in image_gen tool exactly ONCE with the prompt between the markers.',
        ASPECT[j['aspect']],
    ]
    if j['transparent']:
        parts.append('Ask image_gen for a genuinely transparent background and keep the alpha channel.')
    if j['refs']:
        parts.append('The attached image(s) are design references: keep exactly the same character designs, colours and proportions as in them, but follow the prompt for pose, layout and content.')
    parts.append('<<<PROMPT\n' + j['prompt'] + '\nPROMPT>>>')
    parts.append('After the image is generated, reply with exactly DONE. Do not run any shell commands, do not copy or move '
                 'files, do not inspect other files, do not generate a second image.')
    return '\n\n'.join(parts)


def rescue_from_session(logtext, out_path, started=0):
    """Take the image from THIS run's own session folder (parallel runs never mix up)."""
    m = re.search(r'session id:\s*([0-9a-f-]{20,})', logtext)
    if not m:
        return False
    folder = os.path.join(os.path.expanduser('~/.codex/generated_images'), m.group(1))
    if not os.path.isdir(folder):
        return False
    cands = [os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith(('.png', '.webp', '.jpg', '.jpeg'))]
    cands = [p for p in cands if os.path.getmtime(p) >= started - 5]
    if not cands:
        return False
    cands.sort(key=os.path.getmtime)
    shutil.copy(cands[-1], out_path)
    return True


def resync():
    """Re-copy every generated image from its own job's session folder (fixes racy copies)."""
    fixed = []
    for f in sorted(os.listdir(LOGS)):
        if not f.endswith('.log'):
            continue
        name = f[:-4]
        text = open(os.path.join(LOGS, f)).read()
        if rescue_from_session(text, os.path.join(RAW, name + '.png')):
            fixed.append(name)
    print('resynced', len(fixed), 'images:', ' '.join(fixed))


def run_job(j, dry=False):
    if stop.is_set():
        return j['name'], 'skipped'
    out_path = os.path.join(RAW, j['name'] + '.png')
    if os.path.exists(out_path):
        return j['name'], 'exists'
    refs = [os.path.join(RAW, r + '.png') for r in j['refs']]
    missing = [r for r in refs if not os.path.exists(r)]
    if missing:
        return j['name'], 'missing refs: ' + ', '.join(os.path.basename(m) for m in missing)
    prompt = build_prompt(j, out_path)
    cmd = ['codex', 'exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', ROOT,
           '-m', 'gpt-reserve', '-c', 'model_reasoning_effort="low"']
    for r in refs:
        cmd += ['-i', r]
    cmd += ['--', prompt]
    if dry:
        return j['name'], 'dry: ' + ' '.join(cmd[:12]) + ' ...'
    log(f'start {j["name"]}')
    started = time.time()
    try:
        p = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=900)
        text = (p.stdout or '') + '\n' + (p.stderr or '')
    except subprocess.TimeoutExpired as e:
        text = 'TIMEOUT\n' + str(e.stdout or '') + str(e.stderr or '')
    with open(os.path.join(LOGS, j['name'] + '.log'), 'w') as f:
        f.write(text)
    if re.search(r'usage limit|usage_limit_reached|429 Too Many', text, re.I):
        stop.set()
        return j['name'], 'USAGE LIMIT'
    if rescue_from_session(text, out_path, started):
        log(f'{j["name"]}: took image from its own session folder')
    ok = os.path.exists(out_path)
    return j['name'], ('ok %.0fs' % (time.time() - started)) if ok else 'FAILED'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--phase', type=int)
    ap.add_argument('--only')
    ap.add_argument('--workers', type=int, default=3)
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--resync', action='store_true')
    a = ap.parse_args()
    if a.resync:
        resync()
        return
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(LOGS, exist_ok=True)
    jobs = JOBS
    if a.only:
        names = set(a.only.split(','))
        jobs = [j for j in jobs if j['name'] in names]
    if a.phase is not None:
        jobs = [j for j in jobs if j['phase'] == a.phase]
    jobs = sorted(jobs, key=lambda j: (j['phase'], j['prio']))
    results = []
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        for name, status in ex.map(lambda j: run_job(j, a.dry), jobs):
            log(f'{name}: {status}')
            results.append((name, status))
    bad = [r for r in results if not (r[1].startswith('ok') or r[1] == 'exists' or r[1].startswith('dry'))]
    print(json.dumps({'done': len(results) - len(bad), 'problems': bad}, indent=1))


if __name__ == '__main__':
    main()
