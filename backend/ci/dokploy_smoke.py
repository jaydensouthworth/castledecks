"""Exercise the exact Dokploy Compose in a disposable code/files layout."""
import json,os,pathlib,shutil,subprocess,tempfile,time,urllib.request,urllib.error,uuid
REPO=pathlib.Path(__file__).resolve().parents[2]
project='castledecks-dokploy-ci-'+uuid.uuid4().hex[:8]
def fetch(port,path='/',host='castledecks.jaydensrealm.com'):
 req=urllib.request.Request(f'http://127.0.0.1:{port}{path}',headers={'Host':host})
 try:
  with urllib.request.urlopen(req,timeout=3) as response:return response.status,response.read()
 except urllib.error.HTTPError as e:return e.code,e.read()

def check_runtime(port,enabled):
 req=urllib.request.Request(f'http://127.0.0.1:{port}/castledecks-runtime.js',headers={'Host':'castledecks.jaydensrealm.com'})
 with urllib.request.urlopen(req,timeout=3) as response:
  body=response.read()
  expected=("'use strict';\nwindow.CASTLEDECKS_ACCOUNTS = "+str(enabled).lower()+";\n").encode()
  assert body==expected,body
  assert response.headers.get('Cache-Control')=='no-store'
  assert response.headers.get('X-Content-Type-Options')=='nosniff'
  assert 'javascript' in response.headers.get('Content-Type','')
 original=(REPO/'site/dist/battle.html').read_bytes()
 assert b'castledecks-runtime.js' not in original
 expected_html=original.replace(b'</head>',b'<script src="/castledecks-runtime.js"></script></head>')
 for path in ['/battle','/battle.html']:
  status,html=fetch(port,path)
  assert status==200 and html==expected_html
  assert html.count(b'<script src="/castledecks-runtime.js"></script>')==1
  assert html.index(b'castledecks-runtime.js')<html.index(b'src="./battle.mjs')

with tempfile.TemporaryDirectory() as temporary:
 root=pathlib.Path(temporary);root.chmod(0o755);code=root/'code';code.mkdir();files=root/'files';files.mkdir()
 shutil.copytree(REPO/'backend',code/'backend',ignore=shutil.ignore_patterns('__pycache__','*.test'))
 shutil.copytree(REPO/'site/dist',code/'site/dist')
 shutil.copy2(REPO/'docker-compose.dokploy.yml',code/'docker-compose.dokploy.yml')
 # Include the restrictive real root ignore file to prove the Dockerfile-specific
 # allowlist works and does not require changing the deployed static build.
 if (REPO/'.dockerignore').exists():shutil.copy2(REPO/'.dockerignore',code/'.dockerignore')
 compose=code/'docker-compose.dokploy.yml';spec=json.loads(compose.read_text())
 assert not any('ports' in service for service in spec['services'].values())
 assert spec['services']['accounts']['profiles']==['accounts']
 assert spec['services']['recovery-init']['profiles']==['recovery-init']
 assert set(spec['volumes'])=={'account_data','deletion_data'}
 override=root/'ci-override.json';override.write_text(json.dumps({'services':{'gateway':{'ports':['127.0.0.1::80']},'accounts':{'entrypoint':['/app/server'],'healthcheck':{'disable':True}}}}))
 environment={**os.environ,'COMPOSE_PROFILES':'','ENABLE_ACCOUNTS':'false','ACCOUNT_ROUTES':'false'}
 base=['docker','compose','-p',project,'-f',str(compose)]
 def command(*args,override_enabled=False):
  flags=['-f',str(override)] if override_enabled else []
  return subprocess.check_output([*base,*flags,*args],env=environment,text=True).strip()
 def port():return command('port','gateway','80',override_enabled=True).rsplit(':',1)[1]
 def wait_for(path,status):
  deadline=time.monotonic()+30
  while time.monotonic()<deadline:
   try:
    result=fetch(port(),path)
    if result[0]==status:return result
   except OSError:pass
   time.sleep(.2)
  raise AssertionError(('timeout',path,status))
 try:
  assert command('config','--services').splitlines()==['gateway']
  command('--profile','accounts','--profile','recovery-init','build','gateway','accounts','recovery-init')
  command('up','-d','gateway',override_enabled=True)
  status,body=wait_for('/',200);assert body==(REPO/'site/dist/index.html').read_bytes()
  assert fetch(port(),'/api/health')[0]==503
  check_runtime(port(),False)
  # Fake configuration is created only after default static mode has passed.
  (files/'recovery-policy.json').write_text(json.dumps({'backupHours':24,'tombstoneHours':48,'maxRecords':1000}))
  (files/'google-client-id').write_text('fake-not-used')
  (files/'google-client-secret').write_text('fake-not-used')
  initialized=json.loads(command('--profile','recovery-init','run','--rm','recovery-init'));assert initialized['sequence']==0
  command('--profile','accounts','up','-d','accounts',override_enabled=True)
  environment['ACCOUNT_ROUTES']='true'
  command('--profile','accounts','up','-d','gateway',override_enabled=True)
  status,body=wait_for('/api/health',200);assert json.loads(body)['accountsEnabled'] is False
  check_runtime(port(),True)
  assert fetch(port(),'/api/ready')[0]==404
  assert fetch(port(),'/api/health',host='wrong.invalid')[0]==421
  assert fetch(port(),'/api/rooms')[0]==404
  assert fetch(port())[1]==(REPO/'site/dist/index.html').read_bytes()
  environment['ACCOUNT_ROUTES']='false'
  command('up','-d','gateway',override_enabled=True)
  wait_for('/api/health',503)
  check_runtime(port(),False)
  print('PASS: exact Dokploy Compose default-off, real static build, file layout, explicit init, internal provider-disabled route, runtime flag/order/cache and route rollback')
 finally:
  subprocess.run([*base,'-f',str(override),'--profile','accounts','--profile','recovery-init','down','-v','--remove-orphans'],env=environment,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
