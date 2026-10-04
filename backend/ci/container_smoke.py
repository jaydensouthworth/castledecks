"""Disposable Docker/Nginx exercise. No provider, credentials or deployment."""
import json,os,pathlib,subprocess,tempfile,time,urllib.request,urllib.error,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
prefix='castledecks-ci-'+uuid.uuid4().hex[:10]
containers=[];volumes=[]
def run(*args,**kwargs):return subprocess.check_output(['docker',*args],text=True,**kwargs).strip()
def fetch(port,path='/',host='castledecks.jaydensrealm.com',data=None):
 req=urllib.request.Request(f'http://127.0.0.1:{port}{path}',data=data,headers={'Host':host,'Origin':'https://castledecks.jaydensrealm.com'})
 try:
  with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
def start(name,*args):
 containers.append(name);return run('run','-d','--name',name,*args)
def port(name):return run('port',name,'80/tcp').rsplit(':',1)[1]
with tempfile.TemporaryDirectory() as tmp:
 # Nginx workers must traverse the bind-mounted disposable static root.
 tmp=pathlib.Path(tmp);tmp.chmod(0o755);(tmp/'index.html').write_text('ci-static-ok');(tmp/'probe.mjs').write_text('export const probe=true;')
 policy=tmp/'policy.json';policy.write_text(json.dumps({'backupHours':24,'tombstoneHours':48,'maxRecords':1000}))
 env={**os.environ,'STATIC_DIST':str(tmp)}
 # Validates the real profile/override structure without starting it.
 run('compose','-f',str(ROOT/'deploy/compose.json'),'config',env=env)
 run('compose','-f',str(ROOT/'deploy/compose.json'),'-f',str(ROOT/'deploy/accounts.override.json'),'--profile','accounts','config',env=env)
 image=prefix+':test';run('build','--secret','id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt','-f',str(ROOT/'deploy/Dockerfile'),'-t',image,str(ROOT))
 run('network','create',prefix)
 try:
  for suffix in ['data','journal']:
   name=prefix+'-'+suffix;run('volume','create',name);volumes.append(name)
  mounts=['-v',volumes[0]+':/data','-v',volumes[1]+':/journal','-v',str(policy)+':/run/policy.json:ro']
  # Explicit fake-only journal policy; no OAuth environment variables exist.
  run('run','--rm',*mounts,'--entrypoint','/app/recoveryctl',image,'-command','init','-journal','/journal/deletions.sqlite','-policy','/run/policy.json')
  backend=prefix+'-backend';start(backend,'--network',prefix,'--network-alias','accounts','--read-only','--tmpfs','/tmp:rw,size=16m','--cap-drop','ALL','--security-opt','no-new-privileges',*mounts,'-e','PUBLIC_ORIGIN=https://castledecks.jaydensrealm.com','-e','DELETION_JOURNAL_PATH=/journal/deletions.sqlite','-e','RECOVERY_POLICY_FILE=/run/policy.json','--entrypoint','/app/server',image)
  for mode in ['off','accounts']:
   conf=str(ROOT/f'deploy/nginx/{mode}.conf');run('run','--rm','--network',prefix,'-v',conf+':/etc/nginx/conf.d/default.conf:ro','nginx:1.30.5-alpine3.24','nginx','-t')
   name=prefix+'-'+mode;start(name,'--network',prefix,'-p','127.0.0.1::80','-v',str(tmp)+':/usr/share/nginx/html:ro','-v',conf+':/etc/nginx/conf.d/default.conf:ro','nginx:1.30.5-alpine3.24');p=port(name)
   for attempt in range(50):
    try:
     if fetch(p)[0]==200:break
    except OSError:pass
    time.sleep(.1)
   static_response=fetch(p)
   assert static_response==(200,b'ci-static-ok'), (mode,static_response)
   assert fetch(p,'/probe.mjs')[0]==200
   if mode=='off':assert fetch(p,'/api/health')[0]==503
   else:
    status,body=fetch(p,'/api/health');assert status==200 and json.loads(body)['accountsEnabled'] is False
    assert fetch(p,'/api/ready')[0]==404
    assert fetch(p,'/api/rooms')[0]==404
    assert fetch(p,'/api/health',host='wrong.invalid')[0]==421
    assert fetch(p,'/api/auth/google/start',data=b'{}')[0]==503
    assert fetch(p,'/api/auth/google/start',data=b'x'*(3*1024*1024+1))[0]==413
  run('stop','--time','15',backend);assert run('inspect','--format','{{.State.ExitCode}}',backend)=='0'
  run('start',backend)
  for attempt in range(50):
   if fetch(port(prefix+'-accounts'),'/api/health')[0]==200:break
   time.sleep(.1)
  assert fetch(port(prefix+'-accounts'),'/api/health')[0]==200
  print('PASS: Compose, image, Nginx syntax, static/off/proxy paths, limits, shutdown and persistent-volume restart; provider stayed disabled')
 finally:
  for name in reversed(containers):subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  for name in volumes:subprocess.run(['docker','volume','rm',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  subprocess.run(['docker','network','rm',prefix],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
