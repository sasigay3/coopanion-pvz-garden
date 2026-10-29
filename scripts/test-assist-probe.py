import importlib.util,struct,unittest
s=importlib.util.spec_from_file_location('assist','scripts/pvz_assist_probe.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
class Fake:
 def __init__(self):self.buf={};self.writes=[]
 def put(self,at,n,v):self.buf[at]=(v.to_bytes(n,'little'))
 def read(self,at,n):return self.buf.get(at,b'\0'*n)
 def write(self,at,data):self.writes.append((at,data));self.buf[at]=data
 def setup(self):
  self.put(a.GLOBAL,4,0x100000);self.put(0x100000,4,0x710D80);self.put(0x100000+0x91c,4,3);self.put(0x100000+0x918,4,0);self.put(0x100000+0x868,4,0x200000);self.put(0x200000+0x5568,4,32);self.put(0x200000+0x5578,4,75);self.put(0x200000+0x15c,4,0x300000);self.put(0x300000+0x24,4,1);self.put(0x300000+0x28+0x34,4,1);self.put(0x300000+0x28+0x48,1,1);self.put(0x300000+0x28+0x49,1,1);self.put(0x300000+0x28+0x24,4,20);self.put(0x300000+0x28+0x28,4,100)
class Tests(unittest.TestCase):
 def setUp(self):self.m=Fake();self.m.setup()
 def test_inspection_is_read_only(self):self.assertTrue(a.inspect(self.m)['eligible']);self.assertEqual(self.m.writes,[])
 def test_apply_writes_only_sun_and_active_cooldown(self):
  before=a.inspect(self.m);self.assertEqual(a.apply_once(self.m,before),1);self.assertEqual([x[0] for x in self.m.writes],[0x200000+0x5578,0x300000+0x28+0x24,0x300000+0x28+0x49,0x300000+0x28+0x48])
 def test_sun_only_never_writes_cooldown(self):
  a.apply_once(self.m,a.inspect(self.m),cooldown_enabled=False);self.assertEqual([x[0] for x in self.m.writes],[0x200000+0x5578])
 def test_cooldown_only_never_writes_sun(self):
  a.apply_once(self.m,a.inspect(self.m),sun_enabled=False);self.assertNotIn(0x200000+0x5578,[x[0] for x in self.m.writes]);self.assertEqual(len(self.m.writes),3)
 def test_add_sun_exactly_once_and_reject_overflow(self):
  self.assertEqual(a.add_sun(self.m,a.inspect(self.m)),275);self.assertEqual(a.add_sun(self.m,a.inspect(self.m)),475)
  self.m.put(0x200000+0x5578,4,9900)
  with self.assertRaises(RuntimeError):a.add_sun(self.m,a.inspect(self.m))
 def test_paused_and_conveyor_disallowed(self):
  self.m.put(0x200000+0x17c,1,1);self.assertFalse(a.inspect(self.m)['eligible']);self.m.put(0x200000+0x17c,1,0);self.m.put(0x200000+0x5568,4,40);self.assertFalse(a.inspect(self.m)['eligible'])
 def test_changed_board_rejected(self):
  state=a.inspect(self.m);self.m.put(0x100000+0x868,4,0x400000)
  with self.assertRaises(RuntimeError):a.apply_once(self.m,state)
  self.assertEqual(self.m.writes,[])
 def test_survival_and_other_modes(self):
  self.m.put(0x200000+0x5568,4,0)
  self.m.put(0x200000+0x5618,4,0xffffffff)
  for mode in range(1,16):
   self.m.put(0x100000+0x918,4,mode);self.assertTrue(a.inspect(self.m)['eligible'])
  self.m.put(0x100000+0x918,4,16);self.assertFalse(a.inspect(self.m)['eligible'])
 def test_survival_stale_win_and_transition_guards(self):
  self.m.put(0x100000+0x918,4,2);self.m.put(0x100000+0x9a8,4,1);self.m.put(0x200000+0x5618,4,0xffffffff)
  self.assertTrue(a.inspect(self.m)['eligible'])
  self.m.put(0x100000+0x9a8,4,4);self.assertTrue(a.inspect(self.m)['eligible'])
  for addr,size,val in [(0x100000+0x874,4,0x400000),(0x200000+0x5614,1,1),(0x200000+0x5624,1,1),(0x200000+0x561c,4,1),(0x200000+0x5618,4,0)]:
   old=self.m.read(addr,size);self.m.put(addr,size,val);self.assertFalse(a.inspect(self.m)['eligible']);self.m.buf[addr]=old
  self.m.put(0x100000+0x9a8,4,2);self.assertFalse(a.inspect(self.m)['eligible'])
 def test_mode_change_rejects_write(self):
  before=a.inspect(self.m);self.m.put(0x100000+0x918,4,1)
  with self.assertRaises(RuntimeError):a.add_sun(self.m,before)
  self.assertEqual(self.m.writes,[])
 def survival_bonus_setup(self):
  self.m.put(0x100000+0x918,4,3);self.m.put(0x200000+0x5618,4,0xffffffff)
  self.m.put(0x200000+0x178,4,0x400000);self.m.put(0x400000+0x6c,4,2)
 def test_bonus_retries_transient_state_once(self):
  self.survival_bonus_setup();self.m.put(0x100000+0x9a8,4,2);clock=[0]
  def wait(t):clock[0]+=t;self.m.put(0x100000+0x9a8,4,0)
  result=a.apply_pickup_bonus(self.m,200,3,3,sleep=wait,clock=lambda:clock[0])
  self.assertTrue(result['applied']);self.assertEqual(result['sun'],275);self.assertEqual(len(self.m.writes),1)
 def test_bonus_never_crosses_stage_or_board(self):
  self.survival_bonus_setup();self.m.put(0x100000+0x9a8,4,2);clock=[0]
  def wait(t):clock[0]+=t;self.m.put(0x400000+0x6c,4,3)
  result=a.apply_pickup_bonus(self.m,200,3,3,sleep=wait,clock=lambda:clock[0])
  self.assertFalse(result['applied']);self.assertEqual(self.m.writes,[])
 def test_bonus_timeout_and_sun_cap(self):
  self.survival_bonus_setup();self.m.put(0x100000+0x9a8,4,2);clock=[0]
  def wait(t):clock[0]+=t
  result=a.apply_pickup_bonus(self.m,200,3,3,timeout=.3,sleep=wait,clock=lambda:clock[0])
  self.assertFalse(result['applied']);self.assertEqual(self.m.writes,[])
  self.m.put(0x100000+0x9a8,4,0);self.m.put(0x200000+0x5578,4,9900)
  result=a.apply_pickup_bonus(self.m,200,3,3);self.assertEqual(result['sun'],9990);self.assertEqual(result['added'],90)
unittest.main()
