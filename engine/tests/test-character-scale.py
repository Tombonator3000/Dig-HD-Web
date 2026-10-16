#!/usr/bin/env python3
"""Check scale registration without altering game state or normal saves.

Uses private game/mod data and a COPY of a saved room65 scene. Compares the
actor raster against the pre-change binary and verifies partial redraws.
The actor's original cel bounds exclude independently timed background effects.
Identity and anatomical correctness still require visual inspection.
"""
import argparse,json,os,re,shutil,subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image,ImageChops

def main():
 p=argparse.ArgumentParser(description=__doc__)
 for k in ('binary','baseline','game','mod','save','out'):p.add_argument('--'+k,type=Path,required=True)
 a=p.parse_args()
 for k in vars(a):setattr(a,k,getattr(a,k).resolve())
 (a.out/'saves').mkdir(parents=True,exist_ok=True);shutil.copy2(a.save,a.out/'saves/dig.s01')
 cases=[(c,s,d) for c in (14,15,18) for s in (96,150,255) for d in (2,6)]
 def run(item):
  c,s,d,which=item;name=f'{c}-{s}-{d}-{which}';folder=a.out/name;folder.mkdir(exist_ok=True);conf=folder/'scummvm.ini';conf.write_text('[scummvm]\nfullscreen=false\naspect_ratio=false\nconfirm_exit=false\n')
  env={k:v for k,v in os.environ.items() if not k.startswith('DIGHD_')};env.update(XDG_CONFIG_HOME=str(folder/'config'),XDG_CACHE_HOME=str(folder/'cache'),XDG_DATA_HOME=str(folder/'data'),SDL_VIDEODRIVER='dummy',SDL_AUDIODRIVER='dummy',DIGHD_MOD=str(a.mod),DIGHD_TEST_ROOM='65',DIGHD_TEST_COSTUME=str(c),DIGHD_TEST_ACTOR='3',DIGHD_TEST_POS='160,175',DIGHD_TEST_SCALE=str(s),DIGHD_TEST_ANIMATION='1',DIGHD_TEST_DIRECTION=str(d),DIGHD_TEST_CHORE_EVERY='10000',DIGHD_TEST_STATIC_SCENE='1',DIGHD_DUMP_DIR=str(folder),DIGHD_DUMP_EVERY='20',DIGHD_DUMP_FLAT='1',DIGHD_QUIT_AT='220',DIGHD_DEBUG_SOFT='1',DIGHD_VERIFY='1',DIGHD_TEXT='off',DIGHD_CLASSIC='0',DIGHD_MANGLER='0')
  binary=a.binary if which=='new' else a.baseline
  with (folder/'log.txt').open('w') as log:subprocess.run([str(binary),'--config='+str(conf),'--path='+str(a.game),'--savepath='+str(a.out/'saves'),'--save-slot=1','--no-fullscreen','--debuglevel=1','dig'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=120)
  text=(folder/'log.txt').read_text();checks=[(int(f),int(n)) for f,n in re.findall(r'verify frame (\d+): (\d+) screen pixels differ from the whole screen built again',text) if int(f)>=100];assert len(checks)>=5 and not any(n for f,n in checks),(name,checks)
  if which=='new' and s<255:assert re.search(fr'actor scale costume {c} cel',text),name+': scaled path not exercised'
  return name,len(checks)
 with ThreadPoolExecutor(max_workers=3) as pool:checks=dict(pool.map(run,[(c,s,d,w) for c,s,d in cases for w in ('old','new')]))
 results=[]
 for c,s,d in cases:
  old=a.out/f'{c}-{s}-{d}-old';new=a.out/f'{c}-{s}-{d}-new'
  text=(new/'log.txt').read_text();bounds=[tuple(map(int,m[1:])) for m in re.findall(fr'frame (\d+) soft cel \d+ costume {c} slot \d+ seq \d+ at (-?\d+),(-?\d+) (\d+)x(\d+)',text) if int(m[0])>=90];assert bounds,(c,s,d,'actor not drawn');crop=(min(x for x,y,w,h in bounds)*4,min(y for x,y,w,h in bounds)*4,max(x+w for x,y,w,h in bounds)*4,max(y+h for x,y,w,h in bounds)*4)
  for f in (120,160,200):
   stem=f'frame_{f:06d}_room065';op=old/(stem+'_flat.png');np=new/(stem+'_flat.png');assert op.exists() and np.exists(),'test save must be from room65';assert not ImageChops.difference(Image.open(op).convert('RGB').crop(crop),Image.open(np).convert('RGB').crop(crop)).getbbox(),(c,s,d,f,'actor original raster changed')
   if s==255:assert not ImageChops.difference(Image.open(old/(stem+'.png')).convert('RGB').crop(crop),Image.open(new/(stem+'.png')).convert('RGB').crop(crop)).getbbox(),(c,s,d,f,'full-size HD changed')
  results.append({'costume':c,'scale':s,'direction':d,'actor_original_raster_unchanged':True,'original_cel_bounds_hd':crop,'full_size_actor_hd_unchanged':s==255,'redraw_checks':checks[f'{c}-{s}-{d}-new']})
 (a.out/'result.json').write_text(json.dumps(results,indent=2));print('PASS:',len(cases),'scale cases, original raster unchanged; full-size HD identical; partial redraws agree')
if __name__=='__main__':main()
