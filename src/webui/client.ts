import type {
  WebUiClientBundle,
  WebUiPanelContext,
  WebUiPanel,
} from 'cortico/web/shared/client-panel.ts';

interface PvzGameState {
  phase: 'stopped' | 'starting' | 'running' | 'recovering' | 'error';
  detail: string | null;
  pid: number | null;
  stoppable: boolean;
  sunAssist?: boolean;
  cooldownAssist?: boolean;
  pickupBonus?: boolean;
  assistError?: string;
}

const PHASE_LABEL: Record<PvzGameState['phase'], string> = {
  stopped: '未启动',
  starting: '启动中',
  running: '运行中',
  recovering: '恢复中',
  error: '启动失败',
};

const gamePanel: WebUiPanel = {
  mount(ctx: WebUiPanelContext) {
    const { root, ui } = ctx;
    const card = ui.sheet({
      title: '植物大战僵尸',
      en: 'game',
      desc: '由 worlds-pvz 启动游戏并连接植入件。手动关掉游戏窗口后 World 停在未启动，不会自己把它拉回来。',
    });
    const stateBox = ui.h('div');
    const message = ui.msgline('');
    const stop = ui.button('停止', { variant: 'danger' });
    const start = ui.button('启动游戏', { variant: 'primary' });
    const sun = ui.button('开启阳光辅助');
    const cooldown = ui.button('开启冷却辅助');
    const addSun = ui.button('阳光 +200');
    const bonus = ui.button('开启捡阳光奖励');
    const assistText = ui.h('p', '阳光辅助补到 1000；冷却辅助让卡片快速可用；捡阳光奖励在自动收取成功后每份加 200。支持普通冒险和生存模式，重启默认关闭。');
    const assistActions = ui.actions();assistActions.append(sun, cooldown, addSun, bonus);
    const actions = ui.actions();
    actions.append(ui.h('span', 'grow'), stop, start);
    card.body.append(stateBox, message, actions, assistText, assistActions);
    root.appendChild(card.el);

    let state: PvzGameState | null = null;
    /** 有动作在飞的时候两个键都不能按,也不让轮询把它们重新点亮。 */
    let busy = false;

    const render = (next: PvzGameState): void => {
      if (ctx.signal.aborted) return;
      state = next;
      const active = next.phase === 'running';
      const pending = next.phase === 'starting' || next.phase === 'recovering';
      stateBox.replaceChildren(ui.kv([
        { k: '状态', v: ui.pill(PHASE_LABEL[next.phase], active ? 'on' : 'off') },
        { k: '阳光辅助', v: ui.pill(next.sunAssist ? '已开启' : '已关闭', next.sunAssist ? 'on' : 'off') },
        { k: '冷却辅助', v: ui.pill(next.cooldownAssist ? '已开启' : '已关闭', next.cooldownAssist ? 'on' : 'off') },
        { k: '捡阳光奖励', v: ui.pill(next.pickupBonus ? '已开启' : '已关闭', next.pickupBonus ? 'on' : 'off') },
        { k: '进程', v: next.pid === null ? '—' : `PID ${next.pid}` },
        { k: '说明', v: next.detail ?? '—' },
      ]));
      start.disabled = busy || active || pending;
      start.textContent = next.phase === 'error' ? '重新启动' : '启动游戏';
      stop.disabled = busy || !next.stoppable;
      sun.disabled = busy || !active;cooldown.disabled = busy || !active;addSun.disabled = busy || !active;bonus.disabled = busy || !active;
      sun.textContent = next.sunAssist ? '关闭阳光辅助' : '开启阳光辅助';
      cooldown.textContent = next.cooldownAssist ? '关闭冷却辅助' : '开启冷却辅助';
      bonus.textContent = next.pickupBonus ? '关闭捡阳光奖励' : '开启捡阳光奖励';
      if(next.assistError) message.textContent = next.assistError;
    };

    const refresh = async (): Promise<void> => {
      try {
        render(await ctx.invoke<PvzGameState>('state'));
      } catch (error) {
        if (!ctx.signal.aborted) message.textContent = `状态读取失败:${errorText(error)}`;
      }
    };

    const act = (method: 'start' | 'stop' | 'sun-on' | 'sun-off' | 'cooldown-on' | 'cooldown-off' | 'sun-add' | 'bonus-on' | 'bonus-off', working: string, done: string): void => {
      busy = true;
      start.disabled = true;
      stop.disabled = true;sun.disabled = true;cooldown.disabled = true;addSun.disabled = true;bonus.disabled = true;
      message.textContent = working;
      void ctx.invoke<PvzGameState>(method).then(
        async (next) => {
          busy = false;
          render(next);
          message.textContent = method === 'start' ? (next.phase === 'running' ? done : '') : done;
          await ctx.refresh();
        },
        async (error: unknown) => {
          busy = false;
          message.textContent = `操作失败:${errorText(error)}`;
          await refresh();
          await ctx.refresh();
        },
      );
    };

    start.addEventListener('click', () => {
      if (state?.phase === 'running') return;
      act('start', '正在启动…', '游戏已连接');
    }, { signal: ctx.signal });

    stop.addEventListener('click', () => {
      act('stop', '正在停止…', '已停止');
    }, { signal: ctx.signal });

    sun.addEventListener('click', () => {const on=!state?.sunAssist;act(on?'sun-on':'sun-off','正在切换阳光辅助…',on?'阳光辅助已开启':'阳光辅助已关闭')}, { signal: ctx.signal });
    cooldown.addEventListener('click', () => {const on=!state?.cooldownAssist;act(on?'cooldown-on':'cooldown-off','正在切换冷却辅助…',on?'冷却辅助已开启':'冷却辅助已关闭')}, { signal: ctx.signal });

    addSun.addEventListener('click', () => act('sun-add','正在增加阳光…','已增加 200 阳光'), { signal: ctx.signal });
    bonus.addEventListener('click', () => {const on=!state?.pickupBonus;act(on?'bonus-on':'bonus-off','正在切换捡阳光奖励…',on?'捡阳光奖励已开启':'捡阳光奖励已关闭')}, { signal: ctx.signal });

    void refresh();
    ctx.interval(() => { if (!busy) void refresh(); }, 1000);
  },
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const bundle: WebUiClientBundle = { panels: { game: gamePanel } };

export default bundle;
