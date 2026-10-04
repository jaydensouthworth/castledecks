import http.client,json,os,socket,sqlite3,subprocess,tempfile,time,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BINARY=ROOT/'deploy/bin/server.test'
@unittest.skipUnless(BINARY.is_file(),'build native server.test first')
class ProcessTests(unittest.TestCase):
 def test_disabled_native_restart_and_shutdown(self):
  with tempfile.TemporaryDirectory() as d:
   database=Path(d)/'accounts.sqlite'
   def call(port,path,method='GET',host='castledecks.jaydensrealm.com'):
    connection=http.client.HTTPConnection('127.0.0.1',port,timeout=2)
    connection.request(method,path,headers={'Host':host,'Origin':'https://castledecks.jaydensrealm.com'})
    r=connection.getresponse();result=(r.status,r.read());connection.close();return result
   def start():
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env={'PATH':os.defpath,'PUBLIC_ORIGIN':'https://castledecks.jaydensrealm.com','DATABASE_PATH':str(database),'LISTEN_ADDR':f'127.0.0.1:{port}'}
    process=subprocess.Popen([str(BINARY)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    self.addCleanup(lambda: process.poll() is None and process.kill())
    deadline=time.monotonic()+5
    while time.monotonic()<deadline:
     try:
      response=call(port,'/api/health')
      if response[0]==200:return process,port,response
     except OSError:pass
     if process.poll() is not None:self.fail('server exited before probe')
     time.sleep(.025)
    self.fail('startup deadline')
   def stop(process):
    process.terminate();out,err=process.communicate(timeout=12);self.assertEqual(process.returncode,0);return out+err
   first,port,response=start()
   self.assertFalse(json.loads(response[1])['accountsEnabled'])
   self.assertEqual(call(port,'/api/ready')[0],503)
   self.assertEqual(call(port,'/api/health',host='wrong.invalid')[0],421)
   self.assertEqual(call(port,'/api/auth/google/start','POST')[0],503)
   stop(first)
   with sqlite3.connect(database) as db:
    db.execute("INSERT INTO accounts VALUES('fake-A','https://fake.invalid','fake-sub',1)")
    db.execute("INSERT INTO saves VALUES('fake-A','decks',1,1,'opaque-original',1)");db.commit()
   second,port,_=start();self.assertEqual(call(port,'/api/ready')[0],503);log=stop(second)
   with sqlite3.connect(database) as db:
    self.assertEqual(db.execute('SELECT revision,document FROM saves').fetchone(),(1,'opaque-original'))
    self.assertEqual(db.execute('PRAGMA integrity_check').fetchone(),('ok',))
   self.assertNotIn(b'fake-sub',log);self.assertNotIn(b'opaque-original',log)
if __name__=='__main__':unittest.main()
