import json,os,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class PackageTests(unittest.TestCase):
 def test_default_and_opt_in_topology(self):
  c=json.loads((ROOT/'deploy/compose.json').read_text());a=c['services']['accounts'];s=c['services']['static']
  self.assertEqual(a['profiles'],['accounts']);self.assertNotIn('ports',a)
  self.assertEqual(a['environment']['ENABLE_ACCOUNTS'],'${ENABLE_ACCOUNTS:-false}')
  self.assertEqual(a['environment']['ENABLE_PRIVATE_ROOMS'],'false')
  self.assertIn('./nginx/off.conf:/etc/nginx/conf.d/default.conf:ro',s['volumes'])
  self.assertIn('deletion_data:/journal',a['volumes']);self.assertEqual(s['ports'],['127.0.0.1:8090:80']);self.assertEqual(a['stop_grace_period'],'15s');self.assertTrue(a['read_only'])
 def test_gateway_transport_contract(self):
  off=(ROOT/'deploy/nginx/off.conf').read_text();on=(ROOT/'deploy/nginx/accounts.conf').read_text();self.assertNotIn('proxy_pass',off)
  for token in ['proxy_next_upstream off','proxy_cache off','proxy_set_header Host $host','proxy_set_header X-Forwarded-For $remote_addr','location = /api/ready { return 404; }','location ^~ /api/rooms { return 404; }','location ^~ /api/lobby { return 404; }','access_log off','error_log /dev/stderr crit']:self.assertIn(token,on)
 def test_startup_fails_closed_without_secrets_and_recovery(self):
  cases=[{}, {'ENABLE_ACCOUNTS':'true'}, {'ENABLE_ACCOUNTS':'true','PUBLIC_ORIGIN':'https://castledecks.jaydensrealm.com'}, {'ENABLE_ACCOUNTS':'true','PUBLIC_ORIGIN':'https://castledecks.jaydensrealm.com','ENABLE_PRIVATE_ROOMS':'true'}, {'ENABLE_ACCOUNTS':'true','PUBLIC_ORIGIN':'https://castledecks.jaydensrealm.com','GOOGLE_CLIENT_SECRET':'fake-never-log-this'}]
  for env in cases:
   with self.subTest(env=list(env)):
    r=subprocess.run(['/bin/sh',str(ROOT/'deploy/bin/entrypoint.sh')],env={'PATH':os.defpath,**env},capture_output=True,text=True);self.assertEqual(r.returncode,78);self.assertNotIn('fake-never-log-this',r.stderr+r.stdout)
if __name__=='__main__':unittest.main()
