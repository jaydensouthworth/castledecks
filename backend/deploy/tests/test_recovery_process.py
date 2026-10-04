import http.client,json,os,pathlib,socket,subprocess,tempfile,time,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
SERVER=ROOT/'deploy/bin/server.test';CTL=ROOT/'deploy/bin/recoveryctl.test'
@unittest.skipUnless(SERVER.is_file() and CTL.is_file(),'build native server and recoveryctl first')
class RecoveryProcessTests(unittest.TestCase):
 def test_explicit_journal_quarantine_prepare_and_restart(self):
  with tempfile.TemporaryDirectory() as d:
   d=pathlib.Path(d);policy=d/'policy';policy.write_text(json.dumps({'backupHours':24,'tombstoneHours':48,'maxRecords':1000}));journal=d/'journal';database=d/'live'
   def ctl(command,*args):
    result=subprocess.run([str(CTL),'-command',command,'-journal',str(journal),'-policy',str(policy),*map(str,args)],capture_output=True,text=True)
    self.assertEqual(result.returncode,0,result.stderr);return json.loads(result.stdout)
   ctl('init')
   def serve(path,blocked=False):
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env={'PATH':os.defpath,'PUBLIC_ORIGIN':'https://castledecks.jaydensrealm.com','LISTEN_ADDR':f'127.0.0.1:{port}','DATABASE_PATH':str(path),'DELETION_JOURNAL_PATH':str(journal),'RECOVERY_POLICY_FILE':str(policy)}
    p=subprocess.Popen([str(SERVER)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
     if blocked:
      _,error=p.communicate(timeout=5);self.assertEqual(p.returncode,1);self.assertIn(b'quarantined',error);return
     deadline=time.monotonic()+5
     while time.monotonic()<deadline:
      try:
       c=http.client.HTTPConnection('127.0.0.1',port,timeout=.3);c.request('GET','/api/health',headers={'Host':'castledecks.jaydensrealm.com'});r=c.getresponse();r.read();c.close()
       if r.status==200:break
      except OSError:pass
      time.sleep(.025)
     else:self.fail('startup failed')
     p.terminate();p.communicate(timeout=12);self.assertEqual(p.returncode,0)
    finally:
     if p.poll() is None:p.kill();p.communicate()
   serve(database)
   backup=d/'backup';metadata=d/'backup.json';metadata.write_text(json.dumps(ctl('backup','-db',database,'-output',backup,'-service-stopped')))
   serve(backup,blocked=True)
   anchor=d/'anchor.json';anchor.write_text(json.dumps(ctl('anchor')))
   candidate=d/'candidate';candidate_meta=d/'candidate.json';candidate_meta.write_text(json.dumps(ctl('restore','-input',backup,'-output',candidate,'-metadata',metadata,'-expected-anchor',anchor,'-service-stopped')))
   serve(candidate,blocked=True)
   prepared=d/'prepared';result=ctl('prepare','-input',candidate,'-output',prepared,'-metadata',candidate_meta,'-expected-anchor',anchor,'-service-stopped');self.assertEqual(result['status'],'PREPARED_FOR_STARTUP');serve(prepared)
