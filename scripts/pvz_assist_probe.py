"""Opt-in assist prototype for the verified HD game. Inspect is the default.
No process is opened until called. Never run --apply against an unverified board.
"""
import argparse, ctypes, hashlib, json, os, struct, sys, time
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')
from ctypes import wintypes

EXPECTED='05a3f55a3889b1820bca844b26bb6bea1a058522ba842711e1c7d2000efad8d0'
GLOBAL=0x7578F8
EXCLUDED_LEVELS={5,10,20,25,30,40,45,50}

class WinMemory:
    def __init__(self,pid,apply=False):
        if os.name!='nt': raise RuntimeError('仅支持 Windows')
        self.k=ctypes.WinDLL('kernel32',use_last_error=True)
        self.k.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];self.k.OpenProcess.restype=wintypes.HANDLE
        self.k.ReadProcessMemory.argtypes=[wintypes.HANDLE,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.POINTER(ctypes.c_size_t)];self.k.ReadProcessMemory.restype=wintypes.BOOL
        self.k.WriteProcessMemory.argtypes=[wintypes.HANDLE,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.POINTER(ctypes.c_size_t)];self.k.WriteProcessMemory.restype=wintypes.BOOL
        self.k.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)];self.k.QueryFullProcessImageNameW.restype=wintypes.BOOL
        self.k.CloseHandle.argtypes=[wintypes.HANDLE]
        self.k.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD];self.k.WaitForSingleObject.restype=wintypes.DWORD
        self.h=self.k.OpenProcess(0x1000|0x10|(0x20|0x8 if apply else 0),False,pid)
        if not self.h: raise OSError(ctypes.get_last_error(),'打开进程失败')
        buf=ctypes.create_unicode_buffer(32768);n=wintypes.DWORD(len(buf))
        if not self.k.QueryFullProcessImageNameW(self.h,0,buf,ctypes.byref(n)):raise OSError(ctypes.get_last_error(),'读取进程路径失败')
        digest=hashlib.sha256()
        with open(buf.value,'rb') as f:
            for chunk in iter(lambda:f.read(1024*1024),b''):digest.update(chunk)
        if digest.hexdigest()!=EXPECTED: raise RuntimeError('游戏版本指纹不匹配')
    def read(self,addr,size):
        buf=ctypes.create_string_buffer(size);n=ctypes.c_size_t()
        if not self.k.ReadProcessMemory(self.h,addr,buf,size,ctypes.byref(n)) or n.value!=size:raise RuntimeError('读取进程内存失败')
        return buf.raw
    def write(self,addr,data):
        n=ctypes.c_size_t();buf=ctypes.create_string_buffer(data)
        if not self.k.WriteProcessMemory(self.h,addr,buf,len(data),ctypes.byref(n)) or n.value!=len(data):raise RuntimeError('写入进程内存失败')
    def close(self):self.k.CloseHandle(self.h)

def inspect(mem):
    def u32(a):return struct.unpack('<I',mem.read(a,4))[0]
    def byte(a):return mem.read(a,1)[0]
    app=u32(GLOBAL)
    if app<0x10000 or u32(app)!=0x710D80:raise RuntimeError('游戏对象校验失败')
    scene=u32(app+0x91c);mode=u32(app+0x918);board=u32(app+0x868);result=u32(app+0x9a8)
    if scene!=3 or mode not in range(16) or not board or result not in ((0,1,4) if mode in range(1,16) else (0,)): return {'eligible':False,'reason':'非支持的冒险或生存对局'}
    # 生存模式的胜利或退出结果可能沿用上一局；仍须通过战斗棋盘和阶段检查。
    if mode in range(1,16) and (u32(app+0x874) or byte(board+0x5614) or byte(board+0x5624)
                                or u32(board+0x561c) or u32(board+0x5618)!=0xffffffff):
        return {'eligible':False,'reason':'生存模式正在选卡或切换阶段'}
    paused=byte(board+0x17c);level=u32(board+0x5568)
    if paused or (mode==0 and (level<1 or level>50 or level in EXCLUDED_LEVELS)):return {'eligible':False,'reason':'暂停或特殊关卡'}
    bank=u32(board+0x15c);count=u32(bank+0x24) if bank else 0
    if not 1<=count<=10:raise RuntimeError('卡槽校验失败')
    sun=u32(board+0x5578)
    if sun>9990:raise RuntimeError('阳光值异常')
    cards=[]
    for slot in range(count):
        p=bank+0x28+slot*0x50;ptype=u32(p+0x34);active=byte(p+0x48);refreshing=byte(p+0x49);counter=u32(p+0x24);duration=u32(p+0x28)
        if ptype>48 or active>1 or refreshing>1 or counter>1000000 or duration>1000000:raise RuntimeError('卡片字段校验失败')
        cards.append({'slot':slot,'type':ptype,'active':bool(active),'refreshing':bool(refreshing),'counter':counter,'duration':duration,'address':p})
    if u32(GLOBAL)!=app or u32(app+0x868)!=board:raise RuntimeError('棋盘变化，请重试')
    return {'eligible':True,'app':app,'board':board,'bank':bank,'mode':mode,'level':level,'sun':sun,'cards':cards}

def apply_once(mem, before, sun_floor=1000, sun_enabled=True, cooldown_enabled=True):
    if not before.get('eligible'):raise RuntimeError('当前场景不支持辅助')
    now=inspect(mem)
    if not now.get('eligible') or (now['app'],now['board'],now['bank'],now['mode'])!=(before['app'],before['board'],before['bank'],before['mode']):raise RuntimeError('棋盘已变化，取消写入')
    if sun_enabled and now['sun']<sun_floor:mem.write(now['board']+0x5578,struct.pack('<I',sun_floor))
    count=0
    for c in now['cards']:
        if cooldown_enabled and c['refreshing']:
            mem.write(c['address']+0x24,struct.pack('<I',0))
            mem.write(c['address']+0x49,b'\0')
            mem.write(c['address']+0x48,b'\1');count+=1
    return count

def add_sun(mem, before, amount=200, expected_mode=None):
    if not before.get('eligible'):raise RuntimeError('请在支持的冒险或生存关卡对战中使用')
    now=inspect(mem)
    if expected_mode is not None and now.get('mode')!=expected_mode:raise RuntimeError('游戏模式已变化，请重试')
    if not now.get('eligible') or (now['app'],now['board'],now['bank'],now['mode'])!=(before['app'],before['board'],before['bank'],before['mode']):raise RuntimeError('棋盘已变化，请重试')
    if now['sun']+amount>9990:raise RuntimeError('阳光接近上限，无法再加 200')
    mem.write(now['board']+0x5578,struct.pack('<I',now['sun']+amount))
    return now['sun']+amount

def apply_pickup_bonus(mem, amount, expected_mode, expected_stage, timeout=3, sleep=time.sleep, clock=time.monotonic):
    def u32(addr):return struct.unpack('<I',mem.read(addr,4))[0]
    app=u32(GLOBAL)
    if app<0x10000 or u32(app)!=0x710D80:raise RuntimeError('游戏对象校验失败')
    board=u32(app+0x868);mode=u32(app+0x918)
    if not board or mode!=expected_mode:return {'applied':False,'reason':'棋盘或模式已变化'}
    if mode in range(1,16) and (expected_stage is None or expected_stage<1):return {'applied':False,'reason':'生存阶段不可确认'}
    def same_scope():
        if u32(GLOBAL)!=app or u32(app+0x868)!=board or u32(app+0x918)!=mode:return False
        if mode in range(1,16):
            challenge=u32(board+0x178)
            return bool(challenge) and u32(challenge+0x6c)+1==expected_stage
        return True
    deadline=clock()+timeout
    while True:
        if not same_scope():return {'applied':False,'reason':'棋盘或阶段已变化'}
        current=inspect(mem)
        if current.get('eligible'):
            # inspect 再次校验场景与棋盘；成功后不重试，避免一次领取重复加钱。
            now=inspect(mem)
            if not now.get('eligible') or not same_scope() or (now['app'],now['board'],now['bank'],now['mode'])!=(current['app'],current['board'],current['bank'],current['mode']):
                return {'applied':False,'reason':'写入前棋盘已变化'}
            new_sun=min(9990,now['sun']+amount)
            if new_sun!=now['sun']:mem.write(board+0x5578,struct.pack('<I',new_sun))
            return {'applied':True,'sun':new_sun,'added':new_sun-now['sun']}
        if clock()>=deadline:return {'applied':False,'reason':'棋盘暂不可写入，奖励已跳过'}
        sleep(.15)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pid',type=int,required=True);ap.add_argument('--apply',action='store_true');ap.add_argument('--add-sun',action='store_true');ap.add_argument('--bonus',action='store_true');ap.add_argument('--amount',type=int,default=200);ap.add_argument('--expected-mode',type=int);ap.add_argument('--expected-stage',type=int);ap.add_argument('--continuous',type=int,default=0);ap.add_argument('--parent-pid',type=int,default=0);group=ap.add_mutually_exclusive_group();group.add_argument('--sun-only',action='store_true');group.add_argument('--cooldown-only',action='store_true');args=ap.parse_args();
    if args.amount<1 or args.amount>9990:raise RuntimeError('阳光增量无效')
    if args.add_sun and (args.continuous or args.apply):raise RuntimeError('加阳光不能与其他操作同时执行')
    if args.continuous and (not args.apply or not 1<=args.continuous<=43200):raise RuntimeError('持续辅助需要 --apply，时间须为 1 至 43200 秒')
    if args.bonus and (args.apply or args.add_sun or args.continuous or args.expected_mode is None):raise RuntimeError('阳光奖励参数无效')
    mem=WinMemory(args.pid,args.apply or args.add_sun or args.bonus)
    try:
        if args.bonus:
            print(json.dumps(apply_pickup_bonus(mem,args.amount,args.expected_mode,args.expected_stage),ensure_ascii=False));return
        data=inspect(mem)
        if args.add_sun:
            result=add_sun(mem,data,args.amount,args.expected_mode);print(json.dumps({'sun':result},ensure_ascii=False));return
        if args.continuous:
            deadline=time.monotonic()+args.continuous;total=0;parent=None
            if args.parent_pid:
                parent=mem.k.OpenProcess(0x00100000,False,args.parent_pid)
                if not parent:raise RuntimeError('无法验证辅助所属进程')
            print('ASSIST_ACTIVE',flush=True)
            while time.monotonic()<deadline:
                if parent and mem.k.WaitForSingleObject(parent,0)!=0x102:break
                data=inspect(mem)
                if data.get('eligible'):total+=apply_once(mem,data,sun_enabled=not args.cooldown_only,cooldown_enabled=not args.sun_only)
                time.sleep(.2)
            if parent:mem.k.CloseHandle(parent)
            print(json.dumps({'finished':True,'cardsAdjusted':total},ensure_ascii=False),flush=True);return
        if args.apply:data['cardsAdjusted']=apply_once(mem,data,sun_enabled=not args.cooldown_only,cooldown_enabled=not args.sun_only)
        for c in data.get('cards',[]):c.pop('address',None)
        for key in ('app','board','bank'):data.pop(key,None)
        print(json.dumps(data,ensure_ascii=False))
    finally:mem.close()
if __name__=='__main__':
    try:main()
    except Exception as e:print(json.dumps({'error':str(e)},ensure_ascii=False),file=sys.stderr);sys.exit(1)
